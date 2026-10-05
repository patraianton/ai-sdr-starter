#!/usr/bin/env node
// scripts/report.mjs
// Guide: Step 6 (the report). Builds the one report the owner reads, from the cards and the calendar.
//
// The shape is fixed:
//   1. First line: "Calls booked: N · held: M (since <date>)". Only bookings made after the AI agent's first email
//      to that company count, not every booking on the company calendar.
//   2. One row per booking: the company, the meeting time, what the lead asked, what the AI agent answered,
//      and what a person must do.
//   3. "Replies waiting for a person": each one with how long it has waited and who it waits on.
//   4. Never the number of emails sent. Zero bookings is written as zero.
// A call counts as held only when its card says so (the label "Call held" or a "call-held" note). A call that
// ended more than one working day ago with no confirmation is marked as a no-show.
//
// Usage:
//   node scripts/report.mjs                  run on fixtures (DRY_RUN=1 is the default), prints, writes nothing
//   DRY_RUN=0 node scripts/report.mjs        run for real (or: node scripts/report.mjs --live)
//   node scripts/report.mjs --help
// Live, it prints the report, writes runs/report-YYYY-MM-DD.md, and posts to Slack when SLACK_CHANNEL_CARDS is set.
// Exit codes: 0 ok, 3 could not run.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as calendly from './lib/adapters/calendly.mjs';
import * as mailbox from './lib/adapters/mailbox.mjs';
import { listCards } from './lib/github.mjs';
import { isDryRun, out, redact, warn } from './lib/http.mjs';
import {
  callStatus,
  describeTime,
  formatWaited,
  isAttributedBooking,
  lastNote,
  localDate,
  matchBookingToCard,
  parseCard,
  waitingList,
  zonedToUtc,
} from './lib/match.mjs';
import { postMessage, slackConfigured } from './lib/slack.mjs';
import { ROOT, loadEnv, loadFixture, loadSettings, parseArgs, resolveRulesDir, settingsProblems } from './lib/settings.mjs';

const HELP = `report: the owner report, built from the cards and the calendar.

Usage:
  node scripts/report.mjs [--rules <folder>] [--since <YYYY-MM-DD>] [--now <iso time>] [--live]

Options:
  --rules <folder>      rules folder to read (default: rules/ when live, examples/northstar/rules when DRY_RUN=1)
  --since <YYYY-MM-DD>  count from the start of this day (default: the last report, or 7 days back)
  --now <iso time>      pretend it is this moment (dry run default: the fixtures' clock)
  --live                same as DRY_RUN=0
  --help                this text

DRY_RUN=1 (default): reads scripts/fixtures/, prints the report, writes and posts nothing.
Live: also writes runs/report-YYYY-MM-DD.md and posts to the Slack cards channel when it is set.
Exit codes: 0 ok, 3 could not run.`;

const DAY = 24 * 3600 * 1000;

// The text of a note without its email header lines (From, To, Subject, ...), the "Reply from X:" line,
// the quote marks and the greeting, so a row shows what was said.
function noteText(note) {
  if (!note) return '';
  const lines = note.body.split('\n').map((line) => line.replace(/^\s*>+\s?/, ''));
  while (lines.length && /^\s*$/.test(lines[0])) lines.shift();
  while (lines.length && /^(from|to|subject|message-id|thread|approved by|follow-up due|waits for|material):/i.test(lines[0])) lines.shift();
  if (lines.length && /^reply from .*:\s*$/i.test(lines[0].trim())) lines.shift();
  while (lines.length && /^\s*$/.test(lines[0])) lines.shift();
  if (lines.length && /^(hi|hello|dear)\b[^.?!]*,\s*$/i.test(lines[0].trim())) lines.shift();
  while (lines.length && /^\s*$/.test(lines[lines.length - 1])) lines.pop();
  // The sign-off: a last line that is only a name, after a blank line ("Pete", "Dana Reyes"), is not part of what was said.
  if (lines.length > 2 && /^[A-Z][\w'-]*(?: [A-Z][\w'-]*)?$/.test(lines[lines.length - 1].trim()) && /^\s*$/.test(lines[lines.length - 2])) lines.pop();
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

// Cuts at the end of a sentence that fits in the limit. Only a single sentence longer than the limit is cut at a word.
function shorten(text, limit = 220) {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  const ends = [...head.matchAll(/[.!?](?=\s|$)/g)];
  if (ends.length) return head.slice(0, ends[ends.length - 1].index + 1);
  return `${head.replace(/\s+\S*$/, '')}...`;
}

// The value of a "Name: value" line in a note, or "".
function noteLine(note, name) {
  if (!note) return '';
  const match = new RegExp(`^${name}:[ \\t]*(.*)$`, 'im').exec(note.body);
  return match ? match[1].trim() : '';
}

// The first sentence of a text.
const firstSentence = (text) => text.split(/(?<=[.!?])\s+(?=[A-Z])/)[0];

const latestBefore = (card, kind, moment) =>
  [...card.notes].reverse().find((note) => note.kind === kind && note.at <= moment) ?? lastNote(card, kind);

function nextStepFor(status, booking, card, settings) {
  const host = settings.approval?.call_host || booking.host_name || 'the host';
  if (status === 'held') {
    // The next step the call-held note names; failing that, a next-step note owned by a person (not the AI agent).
    const named = noteLine(lastNote(card, 'call-held'), 'Next step');
    const owned = [...card.notes].reverse().find((note) => note.kind === 'next-step' && !/^AI agent$/i.test(noteLine(note, 'Owner')) && noteLine(note, 'Owner'));
    const step = named || noteLine(owned, 'Do');
    return step ? shorten(step, 160) : `${host} writes the next step on the card.`;
  }
  if (status === 'upcoming') {
    // What the handover note asks of a person: its Needs line, first sentence.
    const needs = firstSentence(noteLine(lastNote(card, 'handover'), 'Needs'));
    return needs ? `${needs.charAt(0).toUpperCase()}${needs.slice(1)}` : `${host} hosts the call. Read the card first: ${card.url}`;
  }
  if (status === 'unconfirmed') return `${host} adds a "call-held" note to the card once the call has happened.`;
  return `No recording and no note: counted as a no-show. ${host} confirms on the card, or decides whether to rebook.`;
}

const STATUS_WORDS = { held: 'held', upcoming: 'upcoming', unconfirmed: 'ended, not confirmed yet', 'no-show': 'NO-SHOW' };

// Returns { text, booked, held, rows, waiting }.
export function buildReport({ settings, cards: rawCards, bookings, mailboxMessages = null, now, since }) {
  const tz = settings.email?.timezone || 'UTC';
  const cards = rawCards.map((raw) => parseCard(raw, tz));
  const rows = [];
  const seen = new Set();
  for (const booking of bookings) {
    const { card } = matchBookingToCard(booking, cards);
    if (!card || !isAttributedBooking(booking, card)) continue;
    const key = `${card.number}|${booking.start_time}`; // two guests on one event are one booking
    if (seen.has(key)) continue;
    seen.add(key);
    const status = callStatus(booking, card, now, tz);
    const start = new Date(booking.start_time);
    const booked = new Date(booking.created_at) >= since;
    const held = status === 'held' && start >= since && start <= now;
    if (!booked && !held) continue;
    rows.push({ booking, card, status, start, booked, held });
  }
  rows.sort((a, b) => a.start - b.start);
  const booked = rows.filter((row) => row.booked).length;
  const held = rows.filter((row) => row.held).length;

  const waiting = waitingList(cards, settings, now, mailboxMessages);

  const lines = [`Calls booked: ${booked} · held: ${held} (since ${localDate(since, tz)})`, ''];
  if (rows.length === 0) {
    lines.push('Bookings: none in this period.', '');
  } else {
    lines.push('Bookings');
    rows.forEach((row, index) => {
      const { booking, card, status } = row;
      const asked = shorten(noteText(latestBefore(card, 'reply', new Date(booking.created_at))));
      const answered = shorten(noteText(latestBefore(card, 'sent', new Date(booking.created_at))));
      lines.push(
        `${index + 1}. ${card.company} (card #${card.number}, ${card.url})`,
        `   Meeting: ${describeTime(row.start, tz)} with ${booking.host_name || 'the host'}. Status: ${STATUS_WORDS[status]}.`,
        `   The lead asked: ${asked ? `"${asked}"` : 'nothing on the card'}`,
        `   The AI agent answered: ${answered ? `"${answered}"` : 'nothing yet'}`,
        `   A person must: ${nextStepFor(status, booking, card, settings)}`,
        '',
      );
    });
  }
  lines.push(`Replies waiting for a person: ${waiting.length}`);
  for (const { card, wait } of waiting) {
    lines.push(`- ${card.company} (card #${card.number}, ${card.url}): waited ${formatWaited(wait.waitedMs)} on ${wait.person}`);
  }
  return { text: `${lines.join('\n')}\n`, booked, held, rows, waiting };
}

// ---------------------------------------------------------------------------

function sinceFromArgs(args, { dry, now, tz }) {
  if (args.since) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.since)) throw new Error('--since must look like 2026-03-05');
    return zonedToUtc(args.since, '00:00', tz);
  }
  if (dry) return zonedToUtc(loadFixture('cards.json').report_since, '00:00', tz);
  try {
    const last = JSON.parse(fs.readFileSync(path.join(ROOT, 'runs', 'last-report.json'), 'utf8'));
    const at = new Date(last.at);
    if (!Number.isNaN(+at)) return at;
  } catch {
    // no earlier report: fall through
  }
  return new Date(+now - 7 * DAY);
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv, { options: ['rules', 'since', 'now'] });
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  loadEnv();
  const dry = isDryRun();
  const rulesDir = resolveRulesDir(args, dry);
  const settings = loadSettings(rulesDir);
  const problems = settingsProblems(settings);
  if (problems.length) throw new Error(`${path.relative(ROOT, rulesDir)}/settings.yml: ${problems.join('; ')}`);
  const tz = settings.email.timezone || 'UTC';
  const now = args.now ? new Date(args.now) : dry ? new Date(loadFixture('cards.json').now) : new Date();
  if (Number.isNaN(+now)) throw new Error('--now is not a valid time');
  const since = sinceFromArgs(args, { dry, now, tz });

  const cards = await listCards({ state: 'all' });
  const bookings = await calendly.listBookings({ since: new Date(+since - 60 * DAY) });
  const mailboxMessages = dry || process.env.MAILBOX_PROVIDER ? await mailbox.listRecentMessages({ since: new Date(+now - 90 * DAY) }) : null;
  const report = buildReport({ settings, cards, bookings, mailboxMessages, now, since });
  out(report.text.trimEnd());

  const date = localDate(now, tz);
  if (dry) {
    out('');
    out(`[dry run] would write runs/report-${date}.md${slackConfigured('cards') ? ' and post it to the Slack cards channel' : ''}`);
    return 0;
  }
  const dir = path.join(ROOT, 'runs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `report-${date}.md`), redact(report.text));
  fs.writeFileSync(path.join(dir, 'last-report.json'), `${JSON.stringify({ at: now.toISOString() })}\n`);
  out(`Wrote runs/report-${date}.md`);
  if (slackConfigured('cards')) {
    await postMessage({ kind: 'cards', text: report.text });
    out('Posted the report to the Slack cards channel.');
  }
  return 0;
}

const isEntry = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntry) {
  run().then(
    (code) => process.exit(code),
    (error) => {
      warn(`cannot run: ${redact(error.message)}`);
      process.exit(3);
    },
  );
}
