#!/usr/bin/env node
// scripts/daily-check.mjs
// Guide: Step 6 (the daily check). It has no model inside.
//
// Once a day, outside the AI agent, it answers three questions and raises an alarm for every "no":
//   1. Was every reply in the inbox handled?  Each reply from the sending service, explee or the mailbox must
//      have a note on a card. A reply with no card, or a card with no note for it, is a missed reply.
//      In the mailbox (setup 3) a message counts only when it comes from an address or company on a card, or
//      answers an email the AI agent sent (same subject, or the id it replies to). Other mail is ignored.
//      It reads every campaign, finished ones too, because replies to the last email of a sequence arrive late.
//   2. Is anyone waiting too long?  A draft, a reply or a handover that waits on a person for more than one
//      working day (weekends do not count) raises the same alarm as a missed reply, and the alarm names the person.
//      An email from a colleague to that company, read from the mailbox, ends the wait.
//   3. Did the calls happen?  A booked call that ended more than one working day ago with no "call-held"
//      note on its card is raised, naming the host. The report counts it as a no-show.
//
// Where the alarms go: the Slack channel for alarms (SLACK_BOT_TOKEN and SLACK_CHANNEL_ALARMS), or, without
// Slack, the file alarms/YYYY-MM-DD-daily-check.md in this folder, which you see when you open Claude Code here.
// The script owns that file and rewrites it on every run. It never touches alarms/YYYY-MM-DD.md, where the
// AI agent and run-agent.sh append their own lines, so a second run on the same day erases nothing.
// If the check itself cannot run, that is an alarm too: it never fails quietly.
//
// Usage:
//   node scripts/daily-check.mjs                run on fixtures (DRY_RUN=1 is the default), writes nothing
//   DRY_RUN=0 node scripts/daily-check.mjs      run for real (or: node scripts/daily-check.mjs --live)
//   node scripts/daily-check.mjs --help
// Exit codes: 0 ok, no alarm. 1 at least one alarm raised. 3 could not run.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as calendly from './lib/adapters/calendly.mjs';
import * as explee from './lib/adapters/explee.mjs';
import * as mailbox from './lib/adapters/mailbox.mjs';
import * as smartlead from './lib/adapters/smartlead.mjs';
import { listCards } from './lib/github.mjs';
import { isDryRun, out, redact, warn } from './lib/http.mjs';
import {
  answersAiSend,
  buildAiSendIndex,
  callStatus,
  describeTime,
  formatWaited,
  isAttributedBooking,
  isSystemMessage,
  localDate,
  localDateTime,
  matchBookingToCard,
  matchReplyToCard,
  parseCard,
  replyIsLogged,
  waitingList,
  isWaitingTooLong,
} from './lib/match.mjs';
import { postMessage, slackConfigured } from './lib/slack.mjs';
import { ROOT, loadEnv, loadFixture, loadSettings, parseArgs, resolveRulesDir, settingsProblems } from './lib/settings.mjs';

const HELP = `daily-check: no model inside. Finds missed replies, drafts waiting too long and calls nobody confirmed.

Usage:
  node scripts/daily-check.mjs [--rules <folder>] [--days <n>] [--now <iso time>] [--live]

Options:
  --rules <folder>   rules folder to read (default: rules/ when live, examples/northstar/rules when DRY_RUN=1)
  --days <n>         how far back to read replies and bookings (default 30)
  --now <iso time>   pretend it is this moment, for example 2026-03-12T15:00:00Z (dry run default: the fixtures' clock)
  --live             same as DRY_RUN=0
  --help             this text

DRY_RUN=1 (default): reads scripts/fixtures/, prints what it would do, writes nothing and posts nothing.
Alarms go to Slack (SLACK_CHANNEL_ALARMS) or to alarms/YYYY-MM-DD-daily-check.md.
Exit codes: 0 no alarm, 1 alarm raised, 3 could not run.`;

const DAY = 24 * 3600 * 1000;

// The zone that names the alarm files. run() sets it from rules/settings.yml; until then (a failure while reading
// the settings) it is UTC. deliver() and reportFailure() both name the file through alarmDate().
let alarmZone = 'UTC';
const alarmDate = (now, tz = alarmZone) => localDate(now, tz);

// ---------------------------------------------------------------------------
// The checks (pure: they take data in and give alarms out)
// ---------------------------------------------------------------------------

const cardRef = (card) => `card #${card.number} ${card.company} (${card.url})`;

// replies: the shape the adapters return. cards: raw cards from github.listCards().
// bookings: the shape calendly.mjs returns. Returns { alarms, stats }.
export function evaluate({ settings, cards: rawCards, replies, bookings = [], mailboxMessages = null, now }) {
  const tz = settings.email?.timezone || 'UTC';
  const cards = rawCards.map((raw) => parseCard(raw, tz));
  const alarms = [];
  const stats = { replies: replies.length, systemSkipped: 0, ignored: 0, matched: 0, cards: cards.length };
  const sendIndex = buildAiSendIndex(cards);

  // 1. Every reply needs a note on a card.
  for (const reply of [...replies].sort((a, b) => new Date(a.received_at) - new Date(b.received_at))) {
    if (isSystemMessage(reply)) {
      stats.systemSkipped += 1;
      continue;
    }
    const when = localDateTime(new Date(reply.received_at), tz);
    const who = `${reply.from_name || reply.from_email} <${reply.from_email}>`;
    const { card, by } = matchReplyToCard(reply, cards);
    if (!card && reply.source === 'mailbox' && !answersAiSend(reply, sendIndex)) {
      // The mailbox is a person's or a shared address: newsletters and internal mail are not replies from a lead.
      stats.ignored += 1;
      continue;
    }
    if (!card) {
      alarms.push({
        kind: 'missed-reply',
        card: null,
        lead: reply.from_email,
        person: null,
        text: `Missed reply: ${who} wrote on ${when}${reply.campaign ? ` (campaign "${reply.campaign}")` : ''}. No card matches this address or its company domain. Subject: "${reply.subject}". Create the card and answer in the next run.`,
      });
    } else if (!replyIsLogged(reply, card)) {
      alarms.push({
        kind: 'missed-reply',
        card,
        lead: reply.from_email,
        person: null,
        text: `Missed reply: ${who} wrote on ${when}. ${cardRef(card)} matches by ${by}, but it has no note with this reply. Subject: "${reply.subject}". Log it and answer in the next run.`,
      });
    } else {
      stats.matched += 1;
    }
  }

  // 2. Nobody waits more than one working day.
  for (const { card, wait } of waitingList(cards, settings, now, mailboxMessages)) {
    if (!isWaitingTooLong(wait.since, now, tz)) continue;
    alarms.push({
      kind: 'waiting-too-long',
      card,
      lead: card.company,
      person: wait.person,
      text: `Waiting too long: ${cardRef(card)} has waited ${formatWaited(wait.waitedMs)} for ${wait.person}. The reply, draft or handover is dated ${localDateTime(wait.since, tz)}. ${wait.person}, open the card and answer.`,
    });
  }

  // 3. Every call that ended needs a confirmation on its card, and every call needs a named host.
  const seen = new Set();
  const booked = [];
  for (const booking of bookings) {
    const { card } = matchBookingToCard(booking, cards);
    if (!card || !isAttributedBooking(booking, card)) continue;
    const key = `${card.number}|${booking.start_time}`; // two guests on one event are one booking
    if (seen.has(key)) continue;
    seen.add(key);
    booked.push({ booking, card });
    if (callStatus(booking, card, now, tz) !== 'no-show') continue;
    const host = settings.approval?.call_host || booking.host_name || 'the host';
    alarms.push({
      kind: 'no-show',
      card,
      lead: booking.invitee_email,
      person: host,
      text: `Call not confirmed: "${booking.event_name}" with ${booking.invitee_name || booking.invitee_email} (${cardRef(card)}) ended ${describeTime(new Date(booking.end_time), tz)} and the card has no "call-held" note. ${host}: add the note if the call happened. Until then the report counts it as a no-show.`,
    });
  }

  if (booked.length > 0 && !settings.approval?.call_host) {
    const upcoming = booked.filter(({ booking }) => new Date(booking.end_time) > now).length;
    alarms.push({
      kind: 'no-host',
      card: null,
      lead: booked[0].card.company,
      person: settings.approval?.switch_owner || null,
      text: `No host named: ${booked.length} booked call${booked.length === 1 ? '' : 's'} (${upcoming} still ahead) and approval.call_host in rules/settings.yml is empty. Name who hosts the calls, or a lead arrives to find nobody there.`,
    });
  }

  return { alarms, stats };
}

// ---------------------------------------------------------------------------
// Delivering alarms
// ---------------------------------------------------------------------------

export function alarmFileText(alarms, { date, stamp }) {
  const lines = [`# Alarms ${date}`, '', `Raised by scripts/daily-check.mjs at ${stamp}. Each alarm names the lead and the card. Answer them in the next run.`, ''];
  alarms.forEach((alarm, index) => lines.push(`${index + 1}. ${alarm.text}`, ''));
  return lines.join('\n');
}

// The check's own file, alarms/YYYY-MM-DD-daily-check.md: rewritten on each run, never the shared alarms/YYYY-MM-DD.md.
export function writeCheckFile(dir, date, body) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${date}-daily-check.md`);
  fs.writeFileSync(file, body);
  return file;
}

// One line appended to the shared alarms/YYYY-MM-DD.md. Everything written there earlier today stays.
export function appendAlarmLine(dir, date, line) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${date}.md`);
  fs.appendFileSync(file, line.endsWith('\n') ? line : `${line}\n`);
  return file;
}

async function deliver(alarms, { dry, now, tz }) {
  const date = alarmDate(now, tz);
  const stamp = describeTime(now, tz);
  const body = alarmFileText(alarms, { date, stamp });
  const slack = slackConfigured('alarms');
  const fileName = `${date}-daily-check.md`;
  if (dry) {
    out(`[dry run] would send ${alarms.length} alarm(s) to ${slack ? 'the Slack alarms channel' : `alarms/${fileName}`}`);
    return;
  }
  if (slack) {
    await postMessage({ kind: 'alarms', text: `Daily check: ${alarms.length} alarm(s)\n\n${alarms.map((a, i) => `${i + 1}. ${a.text}`).join('\n\n')}` });
    out(`Posted ${alarms.length} alarm(s) to the Slack alarms channel.`);
  } else {
    writeCheckFile(path.join(ROOT, 'alarms'), date, redact(body));
    out(`Wrote ${alarms.length} alarm(s) to alarms/${fileName}. Open Claude Code in this folder to see them.`);
  }
}

// ---------------------------------------------------------------------------
// Running it
// ---------------------------------------------------------------------------

async function collectReplies(settings, since) {
  const replies = [];
  const bySource = {};
  const add = (source, list) => {
    bySource[source] = list.length;
    replies.push(...list);
  };
  if (settings.setups.includes(1)) add('smartlead', await smartlead.listReplies({ since }));
  if (settings.setups.includes(2)) add('explee', await explee.listReplies({ since }));
  if (settings.setups.includes(3)) add('mailbox', await mailbox.listInbound({ since }));
  return { replies, bySource };
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv, { options: ['rules', 'days', 'now'] });
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

  const now = args.now ? new Date(args.now) : dry ? new Date(loadFixture('cards.json').now) : new Date();
  if (Number.isNaN(+now)) throw new Error('--now is not a valid time');
  const days = args.days ? Number(args.days) : 30;
  if (!(days > 0)) throw new Error('--days must be a positive number');
  const since = new Date(+now - days * DAY);
  const tz = settings.email.timezone || 'UTC';
  alarmZone = tz;

  out(`Daily check${dry ? ' (dry run, fixtures)' : ''}: ${describeTime(now, tz)}`);
  out(`Rules: ${path.relative(ROOT, rulesDir) || '.'}. Setup ${settings.setups.join(' and ')}. Reading the last ${days} days.`);
  if (dry) out('Fixtures only, nothing real was checked. A scheduled check needs DRY_RUN=0 (or --live).');

  const { replies, bySource } = await collectReplies(settings, since);
  const cards = await listCards({ state: 'all' });
  const bookings = await calendly.listBookings({ since });
  // Mail in both directions, as report.mjs reads it: a colleague's email to a company ends a wait even when no note says so.
  const mailboxMessages = dry || process.env.MAILBOX_PROVIDER ? await mailbox.listRecentMessages({ since: new Date(+now - 90 * DAY) }) : null;
  const { alarms, stats } = evaluate({ settings, cards, replies, bookings, mailboxMessages, now });

  const sources = Object.entries(bySource).map(([name, count]) => `${name} ${count}`).join(', ');
  out(`Replies pulled: ${stats.replies} (${sources}). System messages skipped: ${stats.systemSkipped}. Mailbox mail ignored (no card, no answer to an AI email): ${stats.ignored}. Replies with a note on a card: ${stats.matched}.`);
  out(`Cards read: ${stats.cards}. Bookings read: ${bookings.length}. Mailbox messages read: ${mailboxMessages ? mailboxMessages.length : 'none (no mailbox is set up)'}.`);

  if (alarms.length === 0) {
    out('No alarms. Every reply has a note on a card, nobody waits more than a working day, every ended call is confirmed.');
    return 0;
  }
  out(`Alarms raised: ${alarms.length}`);
  alarms.forEach((alarm, index) => out(`  ${index + 1}. [${alarm.kind}] ${alarm.text}`));
  await deliver(alarms, { dry, now, tz });
  return 1;
}

// The check cannot fail quietly: when it cannot run, say so where the alarms go.
async function reportFailure(error, dry) {
  const text = `The daily check could not run: ${redact(error.message)}. Nothing was checked today. Fix this first, then run it again.`;
  warn(`cannot run: ${redact(error.message)}`);
  if (dry) return;
  try {
    const now = new Date();
    if (slackConfigured('alarms')) {
      await postMessage({ kind: 'alarms', text });
    } else {
      // An append, like every other writer of alarms/YYYY-MM-DD.md: it must not erase a line written earlier today.
      appendAlarmLine(path.join(ROOT, 'alarms'), alarmDate(now), `${localDateTime(now, alarmZone)} daily-check.mjs: ${text}`);
    }
  } catch (second) {
    warn(`could not deliver the failure alarm either: ${redact(second.message)}`);
  }
}

const isEntry = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntry) {
  run().then(
    (code) => process.exit(code),
    async (error) => {
      await reportFailure(error, isDryRun());
      process.exit(3);
    },
  );
}
