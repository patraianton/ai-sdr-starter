#!/usr/bin/env node
// engine/way-c-scripts/signup-flow.mjs
// Guide: Step 3, way C (scripts on a schedule, no model inside), for setup 3 (leads come in on their own).
//
// One run, in this order:
//   1. Read new replies in the mailbox. A reply on a way C card is written on the card in full, the label becomes
//      "New reply", and the follow-ups stop. A refusal closes the card as "No fit". The script never answers.
//   2. Read new sign-ups. Drop free-mail addresses and test accounts. For every other sign-up run the checks of
//      rules/02-what-to-check.md by company domain (customer? our person in the thread? already booked?), look
//      the company up in Apollo, compare its size with icp.size_floor, create the lead in the CRM, and write the
//      first email from templates/<language>/first-email.md.
//   3. For every company with a first email out and no reply, run the checks again and send the next follow-up
//      on the day in email.follow_up_days, from follow-up-1.md, follow-up-2.md and so on.
// Every step is written on the card, in the fixed shapes of board/note-shapes.md, in the same run.
// Every send is also recorded in runs/sent-log.jsonl first, so a card note that fails never leads to a second email.
//
// What it never does: answer a reply, write where our person is already talking, send while the flag file is
// missing, send outside email.sending_days and email.sending_hours, send past email.daily_cap, fill a template
// with a value it does not have, print a key, or call a model.
//
// Edit points (small functions near the top): dropReason() decides which sign-ups to drop, qualify() decides who fits,
// REFUSAL and AUTOREPLY say what counts as a refusal and as an autoresponder. A reply that is neither is
// flagged "New reply" for a person or for the AI agent in way B.
//
// Limits: qualify() compares the size Apollo gives (employees) with icp.size_floor. If your ICP also needs a country,
// an industry or a CRM, add it there. A follow-up is due the set number of days after the previous email, at the same local time.
//
// Template placeholders: {{first_name}} {{company}} {{signup_date}} {{sender_name}} {{booking_link}}.
//
// Usage:
//   node engine/way-c-scripts/signup-flow.mjs              dry run on fixtures (DRY_RUN=1 is the default), writes nothing
//   DRY_RUN=0 node engine/way-c-scripts/signup-flow.mjs    real run (or add --live)
//   node engine/way-c-scripts/signup-flow.mjs --help
// Exit codes: 0 ok. 1 an alarm note was written (or a sent email could not be logged). 3 could not run.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as apollo from '../../scripts/lib/adapters/apollo.mjs';
import * as calendly from '../../scripts/lib/adapters/calendly.mjs';
import * as crm from '../../scripts/lib/adapters/crm.mjs';
import * as mailbox from '../../scripts/lib/adapters/mailbox.mjs';
import * as signups from '../../scripts/lib/adapters/signups.mjs';
import { addNote, closeCard, createCard, listCards, setCardLabels, updateCardBody } from '../../scripts/lib/github.mjs';
import { isDryRun, out, redact, warn } from '../../scripts/lib/http.mjs';
import {
  buildAiSendIndex,
  companyDomain,
  isAiMessage,
  isFreeMail,
  isSystemMessage,
  lastNote,
  localDate,
  localDateTime,
  matchBookingToCard,
  matchReplyToCard,
  normalizeEmail,
  parseCard,
  personNoteOn,
  replyIsLogged,
  stripHtml,
  pad2,
  zonedParts,
  zonedToUtc,
  AI_WRITER,
} from '../../scripts/lib/match.mjs';
import { ROOT, loadEnv, loadFixture, loadSettings, parseArgs, resolveRulesDir, settingsProblems } from '../../scripts/lib/settings.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 24 * 3600 * 1000;

const HELP = `signup-flow: way C. Sign-ups in, checks, first email and follow-ups from templates, every step on the card. No model inside.

Usage:
  node engine/way-c-scripts/signup-flow.mjs [--rules <folder>] [--templates <folder>] [--days <n>] [--now <iso time>] [--live]

Options:
  --rules <folder>      rules folder to read (default: rules/ when live, examples/northstar/rules when DRY_RUN=1)
  --templates <folder>  templates folder (default: engine/way-c-scripts/templates/<language from settings.yml>)
  --days <n>            read sign-ups from the last n days (default 7); the cards tell the script what is already done
  --now <iso time>      pretend it is this moment (dry run default: the fixtures' clock)
  --live                same as DRY_RUN=0
  --help                this text

DRY_RUN=1 (default): reads scripts/fixtures/, prints every step it would take, writes and sends nothing.
While the flag file named in settings.yml (SENDING_ON) is missing, the script checks and logs, and writes drafts instead of sending.
Exit codes: 0 ok, 1 an alarm note was written, 3 could not run.`;

// ---------------------------------------------------------------------------
// Edit points
// ---------------------------------------------------------------------------

const STATUS_LABELS = ['New reply', 'Draft ready', 'Sent, waiting', 'Booked', 'Call held', 'Parked', 'No fit', 'Do not write', 'Our person is in the thread'];
const FLOW_LABELS = ['New reply', 'Draft ready', 'Sent, waiting'];
const PERSON_LOOKBACK_DAYS = 90;

// The local record of every send. The email goes out first and the card note second, and the second step can fail
// (GitHub down, a rate limit). Without a record of its own the next run would see a card with no "sent" note and send
// the same email again. So the script writes one line before the send, one after it, and one after the card note.
// The file is runs/sent-log.jsonl, one JSON object per line, kept out of git. An email that is in it is never sent twice.
//   { event: 'attempt' | 'sent' | 'failed' | 'logged', key: 'address|template', at, card, to, template, subject, message_id, note }
const SENT_LOG = path.join(ROOT, 'runs', 'sent-log.jsonl');
export const sentKey = (to, template) => `${normalizeEmail(to)}|${template}`;

// Reads the log into a Map from key to the last event written for that key. A missing file is an empty log.
export function readSentLog(file = SENT_LOG) {
  const latest = new Map();
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return latest;
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry?.key) latest.set(entry.key, { ...(latest.get(entry.key) ?? {}), ...entry });
    } catch {
      // a half-written last line is skipped
    }
  }
  return latest;
}

export function appendSentLog(entry, file = SENT_LOG) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // The leading newline keeps a half-written last line (a crash mid-write) from swallowing this entry.
  fs.appendFileSync(file, `\n${JSON.stringify(entry)}\n`);
}

// What counts as a refusal and as an autoresponder. The script does not read for meaning, only for these words.
export const REFUSAL = /\b(unsubscribe|remove me|take me off|stop (emailing|writing|contacting|sending)|do not (contact|email|write)|don't (contact|email|write)|not interested|no,? thanks?|no thank you)\b/i;
export const AUTOREPLY_SUBJECT = /^(automatic reply|auto-?reply|autoreply|out of office)/i;
export const AUTOREPLY_BODY = /\b(out of (the )?office|automatic reply|auto-?reply)\b/i;

// Test accounts the script drops without a card: the usual names, plus anything listed under a heading with
// "test account" in rules/02-what-to-check.md, plus your own company domains in SIGNUP_OWN_DOMAINS (comma list).
const BUILT_IN_TEST = /^(test|qa|demo|dev)([._+-]|\d|$)|\+(test|qa)\b/i;

// Optional country list for qualify(). null means the size floor is the only test. Example: ['United States', 'Canada'].
const ALLOWED_COUNTRIES = null;

export function readTestAccounts(rulesDir) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(rulesDir, '02-what-to-check.md'), 'utf8');
  } catch {
    return [];
  }
  const found = [];
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line)) inSection = /test account/i.test(line);
    else if (inSection && /^\s*[-*]\s+/.test(line)) {
      const token = line.replace(/^\s*[-*]\s+/, '').replace(/`/g, '').trim().split(/\s+/)[0].toLowerCase();
      if (token.includes('.') || token.includes('@')) found.push(token);
    }
  }
  return found;
}

// Returns why a sign-up is dropped, or null when it stays.
export function dropReason(signup, { testAccounts = [], ownDomains = [] } = {}) {
  const email = normalizeEmail(signup.email);
  if (!email) return 'not an email address';
  if (isFreeMail(email)) return 'free-mail address';
  const raw = String(signup.email).trim().toLowerCase();
  const domain = companyDomain(email);
  if (BUILT_IN_TEST.test(raw.split('@')[0])) return 'test account';
  if (testAccounts.includes(raw) || testAccounts.includes(domain)) return 'test account';
  if (ownDomains.includes(domain)) return 'test account';
  return null;
}

// org: the Apollo answer or null. Returns { verdict: 'fit' | 'no-fit' | 'unknown', reason }.
export function qualify(org, settings) {
  const floor = settings.icp?.size_floor ?? 0;
  if (!org) return { verdict: 'unknown', reason: 'Apollo does not know this company' };
  if (ALLOWED_COUNTRIES && org.country && !ALLOWED_COUNTRIES.includes(org.country)) {
    return { verdict: 'no-fit', reason: `outside the countries we serve (${org.country})` };
  }
  if (org.employees === null || org.employees === undefined) return { verdict: 'unknown', reason: 'Apollo gives no size for this company' };
  if (org.employees < floor) return { verdict: 'no-fit', reason: `${org.employees} employees, below the floor of ${floor}` };
  return { verdict: 'fit', reason: `${org.employees} employees, at or above the floor of ${floor}` };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function parseTemplate(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const first = /^subject:\s*(.+)$/i.exec(lines[0] ?? '');
  if (!first) throw new Error('a template must start with a "Subject:" line');
  return { subject: first[1].trim(), body: lines.slice(1).join('\n').replace(/^\n+/, '').trimEnd() };
}

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;
export const PLACEHOLDERS = ['first_name', 'company', 'signup_date', 'sender_name', 'booking_link'];

// Fills {{name}} from values. A placeholder with no value is an error: the script never sends a hole.
// The shipped templates in templates/en/ hold [Fill-in marks] for the product name and the one fact. A mark that is
// still there stops the email: the script never sends a template nobody finished.
const FILL_IN_MARK = /\[[A-Z][^\]\n]{2,}\]/;

export function renderTemplate(text, values) {
  const rendered = String(text).replace(PLACEHOLDER, (_, name) => {
    if (!PLACEHOLDERS.includes(name)) throw new Error(`the template uses {{${name}}}, which this script does not know`);
    const value = values[name];
    if (value === undefined || value === null || String(value).trim() === '') throw new Error(`no value for {{${name}}}`);
    return String(value);
  });
  const mark = FILL_IN_MARK.exec(rendered);
  if (mark) throw new Error(`the template still has the fill-in mark ${mark[0]}: write your own wording first`);
  return rendered;
}

export function loadTemplates(dir) {
  const read = (name) => {
    const file = path.join(dir, `${name}.md`);
    return fs.existsSync(file) ? parseTemplate(fs.readFileSync(file, 'utf8')) : null;
  };
  const templates = { 'first-email': read('first-email'), followUps: [] };
  if (!templates['first-email']) throw new Error(`no first-email.md in ${path.relative(ROOT, dir)}`);
  for (let n = 1; n < 20; n += 1) {
    const found = read(`follow-up-${n}`);
    if (!found) break;
    templates.followUps.push(found);
  }
  return templates;
}

// ---------------------------------------------------------------------------
// Sending rules
// ---------------------------------------------------------------------------

// Problems that stop sending. An empty list means the settings are complete enough to send.
export function sendReadiness(settings) {
  const email = settings.email ?? {};
  const problems = [];
  if (!(email.daily_cap > 0)) problems.push('email.daily_cap is 0');
  if (!email.sending_days?.length) problems.push('email.sending_days is empty');
  if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(email.sending_hours ?? '')) problems.push('email.sending_hours is not set');
  if (!email.timezone) problems.push('email.timezone is empty');
  if (!email.booking_link) problems.push('email.booking_link is empty');
  if (!settings.approval?.call_host) problems.push('approval.call_host is empty (it names the sender)');
  return problems;
}

export function inSendingWindow(now, settings) {
  const email = settings.email ?? {};
  const parts = zonedParts(now, email.timezone || 'UTC');
  if (!email.sending_days?.includes(parts.weekday)) return { ok: false, why: `${parts.weekday} is not a sending day` };
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(email.sending_hours ?? '');
  if (!match) return { ok: false, why: 'email.sending_hours is not set' };
  const minutes = parts.hour * 60 + parts.minute;
  const open = Number(match[1]) * 60 + Number(match[2]);
  const close = Number(match[3]) * 60 + Number(match[4]);
  return minutes >= open && minutes < close ? { ok: true } : { ok: false, why: `outside ${email.sending_hours}` };
}

// The same local time, this many calendar days later. A clock change in between does not shift the hour.
export function addLocalDays(date, days, tz = 'UTC') {
  const p = zonedParts(date, tz);
  const later = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedToUtc(localDate(later, 'UTC'), `${pad2(p.hour)}:${pad2(p.minute)}`, tz);
}

const aiSent = (card) => card.notes.filter((note) => note.kind === 'sent' && note.writer === AI_WRITER);
const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;

// How many follow-ups may follow the first email: the smallest of the setting, the number of days and the number of templates.
// email.follow_ups is the limit of unanswered emails in a row, and the first email counts. 3 means the first email and 2 follow-ups.
export function followUpLimit(settings, templates) {
  const email = settings.email ?? {};
  return Math.max(0, Math.min((email.follow_ups ?? 0) - 1, email.follow_up_days?.length ?? 0, templates.followUps.length));
}

// What the next email for a card is. Returns
//   { kind: 'first-email' } | { kind: 'follow-up', number } | { kind: 'wait', until } | { kind: 'ended', sent } | null
export function nextEmail(card, settings, templates, now) {
  const sent = aiSent(card);
  if (sent.length === 0) return { kind: 'first-email' };
  const limit = followUpLimit(settings, templates);
  const number = sent.length; // follow-up 1 comes after the first email
  if (number > limit) return { kind: 'ended', sent: sent.length };
  const days = settings.email.follow_up_days[number - 1];
  const due = addLocalDays(sent[sent.length - 1].at, days, settings.email.timezone || 'UTC');
  if (now < due) return { kind: 'wait', until: due };
  return { kind: 'follow-up', number };
}

// ---------------------------------------------------------------------------
// The decision (pure: data in, a plan out; the code that acts on the plan comes below)
// ---------------------------------------------------------------------------

const noteBlock = (kind, body, now, tz) => `**${localDateTime(now, tz)} · ${AI_WRITER} · ${kind}**\n${body}`;

// ctx: {
//   settings, now, templates, tz,
//   signup (or null), card (parsed, or null for a new company), domain,
//   crm: findCompany() answer, org: Apollo answer or null, orgLookedUp: boolean,
//   personMail: emails a colleague sent to this domain, bookings: bookings of this company,
//   sendingOn, readiness (list of problems), window ({ ok, why }), capLeft, noEmail
// }
// Returns { notes: [{ kind, body }], label, close, crmLead, email, verdict, alarm }
//   email: { template, to, subject, body, mode: 'send' | 'draft' | 'wait', why }
export function decide(ctx) {
  const { settings, now, templates, signup = null, card = null, crm: crmAnswer, org = null, orgLookedUp = false } = ctx;
  const tz = settings.email?.timezone || 'UTC';
  const plan = { notes: [], label: null, close: false, crmLead: false, email: null, verdict: '', alarm: false };
  const relabelOk = !card || card.labels.every((label) => FLOW_LABELS.includes(label));
  const setLabel = (name) => {
    if (relabelOk) plan.label = name;
  };

  const customer = Boolean(crmAnswer?.found && crmAnswer.is_customer);
  const openDeal = crmAnswer?.open_deals?.[0] ?? null;
  const mail = ctx.personMail ?? [];
  const personNote = card ? personNoteOn(card, settings) : null;
  const booking = (ctx.bookings ?? [])[0] ?? null;

  const personBits = [];
  if (openDeal) personBits.push(`open deal "${openDeal.name}" (stage ${openDeal.stage})`);
  if (mail.length) {
    const last = mail.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b));
    const who = [...new Set(mail.map((message) => normalizeEmail(message.from_email)))].join(', ');
    personBits.push(`${mail.length} email${mail.length === 1 ? '' : 's'} from ${who} to this domain, the last on ${localDate(new Date(last.date), tz)}`);
  }
  if (personNote) personBits.push(`${personNote.writer} wrote a note on this card`);
  const personHit = personBits.length > 0;

  const verdictQualify = orgLookedUp ? qualify(org, settings) : null;
  let verdict;
  if (customer) verdict = 'customer. No sales email. The card closes as No fit.';
  else if (personHit) verdict = 'our person is in the thread. Nothing is sent, now or later.';
  else if (booking) verdict = 'already booked. No more emails.';
  else if (verdictQualify?.verdict === 'no-fit') verdict = `no fit: ${verdictQualify.reason}. The card closes.`;
  else if (verdictQualify?.verdict === 'unknown') verdict = `size unknown: ${verdictQualify.reason}. Nothing is sent. A person or the AI agent in way B decides.`;
  else verdict = orgLookedUp ? 'fits. First email next.' : 'checks passed again. Next email when it is due.';
  plan.verdict = verdict;

  const companyLine = !orgLookedUp
    ? 'not looked up again before a follow-up'
    : org
      ? `${org.employees ?? 'size not given'}${org.employees === null || org.employees === undefined ? '' : ' employees'}, ${org.industry || 'industry not given'}, ${org.country || 'country not given'}`
      : 'Apollo does not know this company';
  const lines = [];
  if (signup) lines.push(`Trial sign-up received: ${normalizeEmail(signup.email)} at ${localDateTime(new Date(signup.created_at), tz)}`);
  lines.push(
    `Customer check (CRM, by domain): ${customer ? `customer (CRM company ${crmAnswer.id})` : `not a customer, ${openDeal ? 'an open deal exists' : 'no open deal'}`}`,
    `Our person in the thread (CRM, mailbox, calendar, card): ${personHit ? personBits.join('; ') : 'none found'}`,
    `Booking on the calendar: ${booking ? `${booking.event_name} on ${localDateTime(new Date(booking.start_time), tz)} with ${booking.host_name || 'the host'}` : 'none'}`,
    `Company (Apollo): ${companyLine}`,
    `Verdict: ${verdict}`,
  );
  plan.notes.push({ kind: 'found-out', body: lines.join('\n') });

  const stopNote = (why) => ({ kind: 'next-step', body: `Do: nothing, the card is closed\nOn: none\nOwner: ${AI_WRITER}\nWhy: ${why}` });

  if (customer) {
    setLabel('No fit');
    if (relabelOk) plan.close = true;
    plan.notes.push(stopNote('the company is already a customer'));
    return plan;
  }
  if (personHit) {
    setLabel('Our person is in the thread');
    return plan;
  }
  if (booking) {
    setLabel('Booked');
    return plan;
  }
  if (verdictQualify?.verdict === 'no-fit') {
    setLabel('No fit');
    if (relabelOk) plan.close = true;
    plan.notes.push(stopNote(verdictQualify.reason));
    return plan;
  }
  if (verdictQualify?.verdict === 'unknown') {
    setLabel('New reply');
    const owner = settings.approval?.approver || 'a person';
    plan.notes.push({ kind: 'next-step', body: `Do: decide whether this company fits, then write to it or close the card\nOn: none\nOwner: ${owner}\nWhy: ${verdictQualify.reason}` });
    return plan;
  }

  // The checks passed and the company fits (or is already a way C card). Work out the email.
  if (ctx.noEmail) return plan;
  plan.crmLead = Boolean(signup) && !crmAnswer?.found;

  const step = card ? nextEmail(card, settings, templates, now) : { kind: 'first-email' };
  if (step.kind === 'ended') {
    const ended = card.notes.some((note) => note.kind === 'next-step' && /sequence ended/i.test(note.body));
    if (!ended) {
      plan.notes.push({ kind: 'next-step', body: `Do: nothing, the sequence ended after ${step.sent} unanswered email${step.sent === 1 ? '' : 's'}\nOn: none\nOwner: ${AI_WRITER}\nWhy: no reply after the last follow-up` });
    }
    return plan;
  }
  if (step.kind === 'wait') return plan;

  const template = step.kind === 'first-email' ? templates['first-email'] : templates.followUps[step.number - 1];
  const contact = signup
    ? { name: signup.name, email: normalizeEmail(signup.email) }
    : (card.contactList.find((person) => person.email) ?? { name: '', email: '' });
  const headerSource = card ? /(\d{4}-\d{2}-\d{2})/.exec(card.fields.source ?? '') : null;
  const values = {
    first_name: String(contact.name ?? '').trim().split(/\s+/)[0],
    company: card?.company || signup?.company || org?.name || '',
    signup_date: signup ? localDate(new Date(signup.created_at), tz) : (headerSource ? headerSource[1] : ''),
    sender_name: settings.approval?.call_host || '',
    booking_link: settings.email?.booking_link || '',
  };
  const name = step.kind === 'first-email' ? 'first-email' : `follow-up-${step.number}`;
  let subject;
  let body;
  try {
    subject = renderTemplate(template.subject, values);
    body = renderTemplate(template.body, values);
    if (!contact.email) throw new Error('no address to write to');
    const limit = settings.email?.max_words ?? 0;
    if (limit > 0 && wordCount(body) > limit) throw new Error(`the template has ${wordCount(body)} words, the limit is ${limit}`);
  } catch (error) {
    plan.alarm = true;
    plan.notes.push({
      kind: 'alarm',
      body: `What: ${name} not sent. ${error.message}\nWhere: engine/way-c-scripts/templates and rules/settings.yml\nWho must act: ${settings.approval?.switch_owner || 'the person who maintains the scripts'}`,
    });
    return plan;
  }

  let mode = 'send';
  let why = '';
  const pendingDraft = card ? lastNote(card, 'draft') : null;
  const lastSentAt = card ? aiSent(card).at(-1)?.at : null;
  if (!ctx.sendingOn) {
    mode = 'draft';
    why = `the flag file ${settings.sending_flag_file} is missing`;
  } else if ((ctx.readiness ?? []).length) {
    mode = 'draft';
    why = `settings are incomplete: ${ctx.readiness.join('; ')}`;
  } else if (!ctx.window?.ok) {
    mode = 'wait';
    why = ctx.window?.why ?? 'outside the sending window';
  } else if (ctx.capLeft <= 0) {
    mode = 'wait';
    why = `the daily cap of ${settings.email.daily_cap} is reached`;
  }
  const draftExists = Boolean(pendingDraft && (!lastSentAt || pendingDraft.at > lastSentAt) && pendingDraft.body.includes(`Subject: ${subject}`));
  if (mode === 'draft' && draftExists) mode = 'wait';
  plan.email = { template: name, to: contact.email, subject, body, mode, why };
  if (mode === 'send') plan.label = 'Sent, waiting';
  else if (mode === 'draft') plan.label = 'Draft ready';
  else if (!card) plan.label = 'New reply';
  return plan;
}

// The plan for one reply on a way C card. Returns { kind: 'autoreply' | 'refusal' | 'reply', label, close, notes }.
export function planReply(reply, settings, now) {
  const tz = settings.email?.timezone || 'UTC';
  const text = stripHtml(reply.body);
  const sender = `${reply.from_name ? `${reply.from_name} ` : ''}<${normalizeEmail(reply.from_email)}>`;
  const note = {
    kind: 'reply',
    body: `From: ${sender}\nSubject: ${reply.subject}\nThread: mailbox (way C)\n\n${text}`,
  };
  if (AUTOREPLY_SUBJECT.test(reply.subject ?? '') || AUTOREPLY_BODY.test(text.slice(0, 300))) {
    return { kind: 'autoreply', label: null, close: false, notes: [note] };
  }
  if (REFUSAL.test(text)) {
    return {
      kind: 'refusal',
      label: 'No fit',
      close: true,
      notes: [note, { kind: 'next-step', body: `Do: nothing, the card is closed\nOn: none\nOwner: ${AI_WRITER}\nWhy: the lead refused (${localDate(now, tz)})` }],
    };
  }
  return { kind: 'reply', label: 'New reply', close: false, notes: [note] };
}

// ---------------------------------------------------------------------------
// Acting on a plan
// ---------------------------------------------------------------------------

const say = (text) => out(text);

function headerFor({ company, domain, contact, org, source, crmText, setup }) {
  const size = org?.employees === null || org?.employees === undefined ? 'not known (Apollo gives no size)' : `${org.employees} employees (Apollo)`;
  const rows = [
    ['Company', company],
    ['Domain', domain],
    ['Contacts', `${contact.name || 'unknown'}, ${contact.email}, (title not given)`],
    ['Size', size],
    ['Industry', org?.industry || 'not known'],
    ['Country', org?.country || 'not known'],
    ['Source', source],
    ['CRM record', crmText],
    ['Setup', String(setup)],
  ];
  return ['| Field | Value |', '|---|---|', ...rows.map(([key, value]) => `| ${key} | ${value} |`)].join('\n');
}

function nextLabels(card, label) {
  const keep = (card?.labels ?? []).filter((name) => !STATUS_LABELS.includes(name));
  return [...keep, label];
}

function addContactToBody(body, contact) {
  const line = `${contact.name || 'unknown'}, ${contact.email}, (title not given)`;
  return body.replace(/^(\| Contacts \| )(.*?)( \|)$/m, (_, start, cell, end) => `${start}${cell}<br>${line}${end}`);
}

// Does everything in a plan, in this order: CRM lead, card (create or note), email, its note, labels, close.
// In a dry run it prints each step and touches nothing.
async function execute({ plan, ctx, state, dry, card, label }) {
  const { settings, now } = ctx;
  const tz = settings.email?.timezone || 'UTC';
  const tag = card ? `card #${card.number} ${card.company}` : `new card for ${ctx.domain}`;
  const notes = plan.notes.map((note) => ({ ...note, text: noteBlock(note.kind, note.body, now, tz) }));
  for (const note of notes) say(`  ${tag}: ${note.kind} note${note.kind === 'alarm' ? ' (ALARM)' : ''}`);
  let crmText = crmDescribe(ctx.crm);
  let number = card?.number ?? null;

  if (plan.crmLead) {
    say(`  ${tag}: create the lead in the CRM before the first email`);
    if (!dry) {
      const created = await crm.createLead({ company: ctx.signup.company || ctx.org?.name || ctx.domain, domain: ctx.domain, contact: { name: ctx.signup.name, email: normalizeEmail(ctx.signup.email) } });
      crmText = `${(process.env.CRM || 'CRM')[0].toUpperCase()}${(process.env.CRM || 'CRM').slice(1)} company ${created.id} (created by the script before the first email)`;
    } else crmText = 'created by the script before the first email';
  }

  const finalLabel = plan.label ?? label ?? null;
  if (!card) {
    const company = ctx.signup.company || ctx.org?.name || ctx.domain;
    const contact = { name: ctx.signup.name, email: normalizeEmail(ctx.signup.email) };
    const first = notes[0];
    say(`  ${tag}: create the card "${company} (${ctx.domain})" with the label "${plan.email ? 'New reply' : (plan.label ?? 'New reply')}"`);
    if (!dry) {
      const body = `${headerFor({ company, domain: ctx.domain, contact, org: ctx.org, source: `Trial sign-up ${localDate(new Date(ctx.signup.created_at), tz)} (${ctx.signup.source || 'sign-up feed'})`, crmText, setup: 3 })}\n\n---\n\n${first.text}`;
      const created = await createCard({ title: `${company} (${ctx.domain})`, body, labels: [plan.email ? 'New reply' : (plan.label ?? 'New reply')] });
      number = created.number;
    }
    notes.shift();
  }
  for (const note of notes) {
    if (!dry) await addNote(number, note.text);
  }

  let sentLabel = null;
  if (plan.email) {
    const { email } = plan;
    const key = sentKey(email.to, email.template);
    const earlier = state.sentLog.get(key);
    if (email.mode === 'send' && earlier && earlier.event !== 'failed') {
      // Already in runs/sent-log.jsonl: never send it twice. If the card note is missing, write it from the log now.
      say(`  ${tag}: ${email.template} to ${email.to} is already in runs/sent-log.jsonl (${earlier.event}), not sent again`);
      if (!dry && number && earlier.event !== 'logged') {
        try {
          const text = earlier.event === 'sent'
            ? earlier.note
            : noteBlock('alarm', `What: ${email.template} to ${email.to} was started at ${earlier.at}, and the log does not say whether it left. It is not sent again.\nWhere: runs/sent-log.jsonl and the Sent folder of the mailbox\nWho must act: ${settings.approval?.call_host || settings.approval?.switch_owner || 'the person who maintains the scripts'}`, now, tz);
          await addNote(number, text);
          appendSentLog({ event: 'logged', key, at: now.toISOString(), card: number });
          state.sentLog.set(key, { ...earlier, event: 'logged' });
          if (earlier.event === 'attempt') state.alarms += 1;
          else sentLabel = 'Sent, waiting';
        } catch (error) {
          state.alarms += 1;
          warn(`UNLOGGED SEND: ${email.template} to ${email.to} is in runs/sent-log.jsonl but the card note failed again: ${redact(error.message)}. Write the note on card #${number} by hand.`);
        }
      } else if (earlier.event === 'logged') {
        sentLabel = 'Sent, waiting';
      }
    } else if (email.mode === 'send') {
      say(`  ${tag}: SEND ${email.template} to ${email.to} ("${email.subject}")`);
      if (!dry) {
        let result;
        appendSentLog({ event: 'attempt', key, at: now.toISOString(), card: number, to: email.to, template: email.template, subject: email.subject });
        try {
          result = await mailbox.sendEmail({ to: email.to, subject: email.subject, body: email.body });
        } catch (error) {
          appendSentLog({ event: 'failed', key, at: now.toISOString() });
          state.sentLog.set(key, { key, event: 'failed' });
          const text = noteBlock('alarm', `What: ${email.template} could not be sent: ${redact(error.message)}\nWhere: the mailbox connection\nWho must act: ${settings.approval?.switch_owner || 'the person who maintains the scripts'}`, now, tz);
          await addNote(number, text);
          state.alarms += 1;
          return;
        }
        const followUpDue = followUpDate({ settings, ctx, email, now, tz });
        const sentNote = noteBlock('sent', `From: ${settings.approval?.call_host || 'the sales rep'}'s mailbox (sent by the script, not by ${settings.approval?.call_host || 'the sales rep'})\nTo: ${email.to}\nSubject: ${email.subject}\nApproved by: template (way C, no approval stage)\nFollow-up due: ${followUpDue}\nMaterial: none\nMessage-Id: ${result.message_id}\n\n${email.body}`, now, tz);
        appendSentLog({ event: 'sent', key, at: now.toISOString(), card: number, message_id: result.message_id, note: sentNote });
        state.sentLog.set(key, { key, event: 'sent', at: now.toISOString(), note: sentNote });
        try {
          await addNote(number, sentNote);
          appendSentLog({ event: 'logged', key, at: now.toISOString(), card: number });
          state.sentLog.set(key, { key, event: 'logged' });
        } catch (error) {
          state.alarms += 1;
          warn(`UNLOGGED SEND: ${email.template} went to ${email.to} but the card note failed: ${redact(error.message)}. Write the sent note on card #${number} by hand.`);
        }
        state.sentIds.add(result.message_id);
      }
      state.sends += 1;
      state.capUsed += 1;
      sentLabel = 'Sent, waiting';
    } else if (email.mode === 'draft') {
      say(`  ${tag}: DRAFT ${email.template} for ${email.to}, not sent (${email.why})`);
      const waits = `the owner to create the flag file ${settings.sending_flag_file} (way C has no approval stage)`;
      const draftNote = noteBlock('draft', `To: ${email.to}\nSubject: ${email.subject}\nWaits for: ${email.why.startsWith('the flag') ? waits : email.why}\nMaterial: none\n\n${email.body}`, now, tz);
      if (!dry) await addNote(number, draftNote);
      state.drafts += 1;
      sentLabel = 'Draft ready';
    } else {
      say(`  ${tag}: ${email.template} is due but waits (${email.why})`);
    }
  }
  if (plan.alarm) state.alarms += 1;

  const target = sentLabel ?? (card ? plan.label : null);
  if (target && !(card && card.labels.includes(target) && card.labels.length === 1)) {
    say(`  ${tag}: label -> "${target}"`);
    if (!dry && number) await setCardLabels(number, nextLabels(card, target));
  }
  if (plan.close) {
    say(`  ${tag}: close the card`);
    if (!dry && number) await closeCard(number);
  }
}

function crmDescribe(answer) {
  return answer?.found ? `${answer.name || 'company'} ${answer.id}` : 'none yet';
}

function followUpDate({ settings, ctx, email, now, tz }) {
  const sentCount = ctx.card ? aiSent(ctx.card).length + 1 : 1;
  const limit = followUpLimit(settings, ctx.templates);
  if (sentCount > limit) return 'none';
  return localDate(addLocalDays(now, settings.email.follow_up_days[sentCount - 1], tz), tz);
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

function companyBookings(bookings, domain, email, name) {
  const wantedEmail = normalizeEmail(email);
  const wantedName = String(name ?? '').trim().toLowerCase();
  return bookings.filter((booking) => {
    const invitee = normalizeEmail(booking.invitee_email);
    if (wantedEmail && invitee === wantedEmail) return true;
    if (domain && !isFreeMail(domain) && companyDomain(invitee) === domain) return true;
    return Boolean(wantedName) && String(booking.invitee_name ?? '').trim().toLowerCase() === wantedName;
  });
}

const sortByTime = (list, key) => [...list].sort((a, b) => new Date(a[key]) - new Date(b[key]));

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv, { options: ['rules', 'templates', 'days', 'now'] });
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
  if (!settings.setups.includes(3)) {
    const note = 'setup 3 is not switched on in settings.yml (way C is for setup 3)';
    if (!dry) throw new Error(note);
    warn(`note: ${note}; the dry run goes on with the fixtures`);
  }
  const tz = settings.email.timezone || 'UTC';
  const now = args.now ? new Date(args.now) : dry ? new Date(loadFixture('cards.json').now) : new Date();
  if (Number.isNaN(+now)) throw new Error('--now is not a valid time');
  const days = args.days ? Number(args.days) : 7;
  if (!(days > 0)) throw new Error('--days must be a positive number');

  const language = settings.language || 'en';
  // The templates in templates/<language>/ are empty of company wording. The example company's own wording is in
  // examples/northstar/templates/, and a dry run on the example rules reads it from there.
  const exampleRoot = path.join(ROOT, 'examples', 'northstar');
  const exampleTemplates = path.join(exampleRoot, 'templates', language);
  const useExample = path.dirname(rulesDir) === exampleRoot && fs.existsSync(exampleTemplates);
  let templatesDir = path.resolve(args.templates ?? (useExample ? exampleTemplates : path.join(HERE, 'templates', language)));
  if (!fs.existsSync(templatesDir)) templatesDir = path.join(HERE, 'templates', 'en');
  const templates = loadTemplates(templatesDir);
  const limit = followUpLimit(settings, templates);

  const flagFile = path.join(ROOT, settings.sending_flag_file);
  const sendingOn = fs.existsSync(flagFile);
  const readiness = sendReadiness(settings);
  const window = inSendingWindow(now, settings);
  const testAccounts = readTestAccounts(rulesDir);
  const ownDomains = (process.env.SIGNUP_OWN_DOMAINS ?? '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

  out(`Sign-up flow${dry ? ' (dry run, fixtures)' : ''}: ${localDateTime(now, tz)} ${tz}`);
  out(`Rules: ${path.relative(ROOT, rulesDir) || '.'}. Templates: ${path.relative(ROOT, templatesDir)}. Follow-ups after the first email: ${limit} (follow_ups is ${settings.email.follow_ups} and counts the first email, so the setting allows ${Math.max(0, (settings.email.follow_ups ?? 0) - 1)}; ${settings.email.follow_up_days?.length ?? 0} follow-up day${settings.email.follow_up_days?.length === 1 ? '' : 's'} and ${templates.followUps.length} template${templates.followUps.length === 1 ? '' : 's'} are set; the smallest of the three counts).`);
  out(sendingOn ? `Sending is on (${settings.sending_flag_file} exists).` : `Sending is off (no ${settings.sending_flag_file} file): the script checks and logs, and writes drafts instead of sending.`);
  if (sendingOn && readiness.length) out(`Settings are incomplete, so emails stay drafts: ${readiness.join('; ')}.`);
  if (sendingOn && !window.ok) out(`Outside the sending window (${window.why}): nothing is sent this run.`);

  const rawCards = await listCards({ state: 'all' });
  const cards = rawCards.map((raw) => parseCard(raw, tz));
  const lookback = new Date(+now - PERSON_LOOKBACK_DAYS * DAY);
  const bookings = await calendly.listBookings({ since: lookback, until: new Date(+now + 120 * DAY) });
  const pool = await mailbox.listRecentMessages({ since: lookback });
  const aiIndex = buildAiSendIndex(cards);

  const today = localDate(now, tz);
  const state = {
    sends: 0,
    drafts: 0,
    alarms: 0,
    sentIds: new Set(),
    newDomains: new Set(),
    sentLog: readSentLog(),
    capUsed: cards.flatMap((card) => card.notes).filter((note) => note.kind === 'sent' && note.writer === AI_WRITER && localDate(note.at, tz) === today).length,
  };
  const touched = new Set();
  const stats = { signups: 0, dropped: 0, newCards: 0, replies: 0 };

  const personMailFor = (domain) =>
    pool.filter((message) => message.direction === 'sent' && !isAiMessage(message, aiIndex) && (message.to_emails ?? []).some((address) => companyDomain(address) === domain));
  const baseContext = () => ({ settings, now, templates, sendingOn, readiness, window, capLeft: (settings.email.daily_cap || 0) - state.capUsed });

  // 1. Replies on way C cards.
  out('');
  out('Replies');
  const inbound = await mailbox.listInbound({ since: new Date(+now - 14 * DAY) });
  const setup3 = cards.filter((card) => card.setup === 3);
  for (const reply of sortByTime(inbound, 'received_at')) {
    if (isSystemMessage(reply)) continue;
    const { card } = matchReplyToCard(reply, setup3);
    if (!card || replyIsLogged(reply, card)) continue;
    const plan = planReply(reply, settings, now);
    stats.replies += 1;
    touched.add(card.number);
    say(`  card #${card.number} ${card.company}: reply from ${normalizeEmail(reply.from_email)} (${plan.kind}), written on the card${plan.label ? `, label -> "${plan.label}"` : ''}`);
    if (!dry) {
      for (const note of plan.notes) await addNote(card.number, noteBlock(note.kind, note.body, now, tz));
      if (plan.label) await setCardLabels(card.number, nextLabels(card, plan.label));
      if (plan.close) await closeCard(card.number);
    }
    if (plan.kind === 'autoreply') touched.delete(card.number); // an autoresponder does not stop the sequence
  }
  if (stats.replies === 0) say('  no new replies on way C cards');

  // 2. Sign-ups.
  out('');
  out('Sign-ups');
  const feed = sortByTime(await signups.listSignups({ since: new Date(+now - days * DAY) }), 'created_at');
  const seenEmails = new Set();
  for (const signup of feed) {
    stats.signups += 1;
    const email = normalizeEmail(signup.email);
    const reason = dropReason(signup, { testAccounts, ownDomains });
    if (reason) {
      stats.dropped += 1;
      say(`  ${email || signup.email}: dropped (${reason})`);
      continue;
    }
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    const domain = companyDomain(email);
    if (state.newDomains.has(domain)) {
      say(`  ${email}: same company as a card made in this run; the next run adds this person to it`);
      continue;
    }
    const existing = [...cards.filter((card) => card.domains.has(domain))].sort((a, b) => (a.state === 'open' ? 0 : 1) - (b.state === 'open' ? 0 : 1) || a.number - b.number)[0] ?? null;
    const when = localDateTime(new Date(signup.created_at), tz);
    if (existing && existing.notes.some((note) => note.kind === 'found-out' && note.body.includes(email) && note.body.includes(when))) continue;

    const crmAnswer = await crm.findCompany(domain);
    const own = existing ? existing.contactList.find((person) => person.email === email) : null;
    const ctx = {
      ...baseContext(),
      signup,
      card: existing,
      domain,
      crm: crmAnswer,
      personMail: personMailFor(domain),
      bookings: companyBookings(bookings, domain, email, signup.name),
      noEmail: Boolean(existing),
    };
    if (!existing) {
      ctx.org = await apollo.enrichOrganization(domain);
      ctx.orgLookedUp = true;
    }
    say(`  ${email}: ${existing ? `company has card #${existing.number}` : 'new company'}`);
    const plan = decide(ctx);
    if (existing && !own) {
      say(`  card #${existing.number} ${existing.company}: add ${email} to the contacts`);
      if (!dry) await updateCardBody(existing.number, addContactToBody(existing.body, { name: signup.name, email }));
    }
    if (!existing) {
      stats.newCards += 1;
      state.newDomains.add(domain);
    }
    if (existing) touched.add(existing.number);
    await execute({ plan, ctx, state, dry, card: existing });
  }
  if (feed.length === 0) say('  no sign-ups in the window');

  // 3. Follow-ups, and first emails that had to wait.
  out('');
  out('Follow-ups');
  let followChecked = 0;
  for (const card of cards) {
    if (card.setup !== 3 || card.state !== 'open' || touched.has(card.number)) continue;
    if (!card.labels.some((label) => FLOW_LABELS.includes(label))) continue;
    const sentCount = aiSent(card).length;
    const lastFound = lastNote(card, 'found-out');
    if (card.labels.includes('New reply') && !(sentCount === 0 && lastFound && /Verdict: fits/.test(lastFound.body))) continue;
    followChecked += 1;
    const domain = card.domain;
    const ctx = {
      ...baseContext(),
      signup: null,
      card,
      domain,
      crm: await crm.findCompany(domain),
      personMail: personMailFor(domain),
      bookings: card.contactList.length ? bookings.filter((booking) => matchBookingToCard(booking, [card]).card) : [],
    };
    say(`  card #${card.number} ${card.company}: ${sentCount} email${sentCount === 1 ? '' : 's'} sent so far`);
    const plan = decide(ctx);
    // When nothing happens (no label change, no email, no alarm) the card gets no note: a note per run would bury it.
    const quiet = !plan.label && !plan.close && !plan.alarm && (!plan.email || plan.email.mode === 'wait') && plan.notes.every((note) => note.kind === 'found-out');
    if (quiet) {
      const step = nextEmail(card, settings, templates, now);
      say(`    checks passed; ${step.kind === 'wait' ? `next email on ${localDate(step.until, tz)}` : 'nothing due'}`);
      continue;
    }
    await execute({ plan, ctx, state, dry, card });
  }
  if (followChecked === 0) say('  no way C card is waiting for a follow-up');

  out('');
  out(`Done: ${stats.signups} sign-ups read, ${stats.dropped} dropped, ${stats.newCards} new cards, ${stats.replies} new replies written, ${state.sends} emails ${dry ? 'would be ' : ''}sent, ${state.drafts} drafts, ${state.alarms} alarms.`);
  if (dry) out('[dry run] nothing was written, created or sent. Run with DRY_RUN=0 (or --live) when you have read this.');
  return state.alarms > 0 ? 1 : 0;
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
