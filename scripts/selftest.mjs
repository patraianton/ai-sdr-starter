#!/usr/bin/env node
// scripts/selftest.mjs
// Guide: Step 6 (a check that runs by itself). The repository's own tests. No keys, no network, no dependencies.
//
// Run from the repository root:   node scripts/selftest.mjs
// It tests the settings parser on the real rules/settings.yml and board/labels.yml, domain matching, reply-to-card
// matching on the fixtures, the waiting-time rule, the report format, the sign-up flow decisions, that every file of
// the template exists, and that no forbidden word, key-shaped string, real-looking address or em dash is in the repository.
// Exit codes: 0 all tests passed, 1 a test failed, 3 could not run (a required file is missing).

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createJwt } from './gh-app-token.mjs';
import os from 'node:os';
import { appendAlarmLine, evaluate, writeCheckFile } from './daily-check.mjs';
import { buildReport } from './report.mjs';
import { planLabels, validateLabels } from './board-labels.mjs';
import { redact } from './lib/http.mjs';
import {
  FREE_MAIL,
  companyDomain,
  isFreeMail,
  isWaitingTooLong,
  matchBookingToCard,
  matchReplyToCard,
  normalizeEmail,
  parseCard,
  parseNotes,
  replyIsLogged,
  sameCompany,
  waitingList,
  waitingOnPerson,
  workingElapsedMs,
  zonedToUtc,
  isSystemMessage,
  personNoteOn,
} from './lib/match.mjs';
import { ROOT, loadEnv, loadFixture, parseYaml, readYamlFile, settingsProblems, normalizeSettings } from './lib/settings.mjs';
import { parseNotification } from './lib/adapters/signups.mjs';
import {
  decide,
  dropReason,
  followUpLimit,
  inSendingWindow,
  loadTemplates,
  nextEmail,
  planReply,
  qualify,
  appendSentLog,
  readSentLog,
  readTestAccounts,
  renderTemplate,
  sendReadiness,
  sentKey,
} from '../engine/way-c-scripts/signup-flow.mjs';


// ---------------------------------------------------------------------------
// Preflight: the two files every test of the parsers needs
// ---------------------------------------------------------------------------

for (const needed of ['rules/settings.yml', 'board/labels.yml']) {
  if (!fs.existsSync(path.join(ROOT, needed))) {
    console.error(`selftest: cannot run, the file ${needed} is missing`);
    process.exit(3);
  }
}

// ---------------------------------------------------------------------------
// A very small test runner
// ---------------------------------------------------------------------------

if (process.argv.includes('--help')) {
  console.log(`selftest: the repository's own tests. No keys, no network, nothing is written.

Usage:
  node scripts/selftest.mjs          run every test and print ok or FAIL for each
  node scripts/selftest.mjs --help   this text

Exit codes: 0 all tests passed, 1 a test failed, 3 could not run (a required file is missing).`);
  process.exit(0);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(ROOT, file));
const at = (date, time, tz = 'America/New_York') => zonedToUtc(date, time, tz);

const TZ = 'America/New_York';
const northstar = normalizeSettings({
  setup: [1, 3],
  engine: 'B',
  approval: { stage: 1, approver: 'Sam Okafor', waiting_list_answerer: 'Sam Okafor', call_host: 'Dana Reyes', switch_owner: 'Priya Natarajan' },
  language: 'en',
  tone: 'plain',
  email: {
    max_words: 120,
    follow_ups: 3,
    follow_up_days: [3, 7, 14],
    sending_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    sending_hours: '09:00-17:00',
    timezone: TZ,
    booking_link: 'https://calendly.com/northstar-dispatch/intro-call',
    daily_cap: 40,
  },
  icp: { size_floor: 15 },
  launch: { new_contacts_per_week: 150, emails_per_mailbox_per_day: 25, pause_at_bounce_rate: 0.03 },
  sending_flag_file: 'SENDING_ON',
});

const cardsFixture = loadFixture('cards.json');
const repliesFixture = loadFixture('replies.json');
const bookingsFixture = loadFixture('bookings.json');
const NOW = new Date(cardsFixture.now);
const parsedCards = () => cardsFixture.cards.map((raw) => parseCard(raw, TZ));
const cardByDomain = (cards, domain) => cards.find((card) => card.domain === domain);
const replyBy = (email) => repliesFixture.replies.find((reply) => reply.from_email === email);

// ---------------------------------------------------------------------------
// The settings parser
// ---------------------------------------------------------------------------

const PINNED_SETTINGS = `
setup: 1                 # 1 you run outbound
engine: B                # A server
approval:
  stage: 1               # 1 you approve every email
  approver: ""           # who approves
  waiting_list_answerer: ""
  call_host: ""
  switch_owner: ""
language: en
tone: ""                 # one line, e.g. "plain, direct, no exclamation marks"
email:
  max_words: 0
  follow_ups: 0          # how many
  follow_up_days: []     # days after the previous email, e.g. [3, 7, 14]
  sending_days: []       # e.g. [Mon, Tue, Wed, Thu, Fri]
  sending_hours: ""      # e.g. "09:00-17:00"
  timezone: ""           # e.g. America/New_York
  booking_link: ""
  daily_cap: 0
icp:
  size_floor: 0
launch:                  # setup 1 only
  new_contacts_per_week: 0
  emails_per_mailbox_per_day: 0
  pause_at_bounce_rate: 0.0   # the AI agent pauses the campaign
sending_flag_file: SENDING_ON   # while this file exists
`;

test('settings parser: scalars, empty lists, comments, quoted strings, nested maps', () => {
  const s = parseYaml(PINNED_SETTINGS, 'pinned');
  assert.equal(s.setup, 1);
  assert.equal(s.engine, 'B');
  assert.deepEqual(s.approval, { stage: 1, approver: '', waiting_list_answerer: '', call_host: '', switch_owner: '' });
  assert.equal(s.tone, '');
  assert.deepEqual(s.email.follow_up_days, []);
  assert.deepEqual(s.email.sending_days, []);
  assert.equal(s.email.sending_hours, '');
  assert.equal(s.launch.pause_at_bounce_rate, 0);
  assert.equal(s.sending_flag_file, 'SENDING_ON');
  assert.deepEqual(settingsProblems(normalizeSettings(s)), []);
});

test('settings parser: inline lists and quoted text with a hash, a comma and a colon', () => {
  const s = parseYaml(['setup: [1, 3]   # two at once', 'days: [3, 7, 14]', 'names: [Mon, Tue]', 'note: "a, b # not a comment: still text"', "plain: don't stop", 'hours: "09:00-17:00"'].join('\n'));
  assert.deepEqual(s.setup, [1, 3]);
  assert.deepEqual(s.days, [3, 7, 14]);
  assert.deepEqual(s.names, ['Mon', 'Tue']);
  assert.equal(s.note, 'a, b # not a comment: still text');
  assert.equal(s.plain, "don't stop");
  assert.equal(s.hours, '09:00-17:00');
});

test('settings parser: lists of flat maps and block lists', () => {
  const s = parseYaml(['- id: one', '  title: "First, piece"', '  audience: HVAC', '- id: two', '  title: Second'].join('\n'));
  assert.deepEqual(s, [{ id: 'one', title: 'First, piece', audience: 'HVAC' }, { id: 'two', title: 'Second' }]);
  const t = parseYaml(['items:', '  - a', '  - "b c"', 'after: yes'].join('\n'));
  assert.deepEqual(t, { items: ['a', 'b c'], after: 'yes' });
});

test('settings parser: stops with a clear error on what it does not read', () => {
  assert.throws(() => parseYaml('a:\n\tb: 1'), /tabs/);
  assert.throws(() => parseYaml('a: 1\na: 2'), /twice/);
  assert.throws(() => parseYaml('a: {b: 1}'), /inline maps/);
  assert.throws(() => parseYaml('a: |\n  text'), /multi-line/);
  assert.throws(() => parseYaml('a: &x 1'), /anchors/);
  assert.throws(() => parseYaml('a: [1, 2'), /same line/);
  assert.throws(() => parseYaml('a: "open'), /not closed/);
});

test('rules/settings.yml (the template) parses and has the right shape', () => {
  const settings = normalizeSettings(readYamlFile(path.join(ROOT, 'rules', 'settings.yml')));
  assert.deepEqual(settingsProblems(settings), []);
  assert.equal(settings.sending_flag_file, 'SENDING_ON');
});

test('examples/northstar/rules/settings.yml (the filled example) parses, has the right shape and real values', () => {
  const settings = normalizeSettings(readYamlFile(path.join(ROOT, 'examples', 'northstar', 'rules', 'settings.yml')));
  assert.deepEqual(settingsProblems(settings), []);
  assert.ok(settings.approval.approver && settings.approval.call_host && settings.approval.switch_owner, 'the people are named');
  assert.ok(settings.email.follow_up_days.length > 0 && settings.email.sending_days.length > 0);
  assert.ok(settings.email.daily_cap > 0 && settings.icp.size_floor > 0);
  assert.deepEqual(sendReadiness(settings), []);
});

// ---------------------------------------------------------------------------
// The labels
// ---------------------------------------------------------------------------

const LABEL_NAMES = ['New reply', 'Draft ready', 'Sent, waiting', 'Booked', 'Call held', 'Parked', 'No fit', 'Do not write', 'Our person is in the thread'];

test('board/labels.yml: the nine labels, in order, with colour and description', () => {
  const labels = readYamlFile(path.join(ROOT, 'board', 'labels.yml'));
  validateLabels(labels);
  assert.deepEqual(labels.map((label) => label.name), LABEL_NAMES);
  for (const label of labels) {
    assert.match(label.color, /^[0-9A-Fa-f]{6}$/);
    assert.ok(label.description.length > 10, `${label.name} has a description`);
  }
});

test('board-labels: the plan creates what is missing, updates what differs, keeps what matches', () => {
  const labels = readYamlFile(path.join(ROOT, 'board', 'labels.yml'));
  const plan = planLabels(labels, cardsFixture.repo_labels);
  const action = (name) => plan.find((entry) => entry.label.name === name).action;
  assert.equal(action('New reply'), 'create');
  assert.equal(action('Booked'), 'update');
  assert.equal(action('Parked'), 'keep');
  assert.equal(plan.length, 9);
  const again = planLabels(labels, labels.map((label) => ({ ...label })));
  assert.ok(again.every((entry) => entry.action === 'keep'), 'a second run changes nothing');
});

test('the label names used in the code are the labels in the file', () => {
  const names = readYamlFile(path.join(ROOT, 'board', 'labels.yml')).map((label) => label.name);
  for (const used of ['Draft ready', 'Our person is in the thread', 'Call held', 'Booked', 'Sent, waiting', 'New reply', 'No fit', 'Do not write', 'Parked']) {
    assert.ok(names.includes(used), `${used} is in labels.yml`);
  }
});

// ---------------------------------------------------------------------------
// Domains and addresses
// ---------------------------------------------------------------------------

test('addresses: normalized to lower case, no display name, no +tag', () => {
  assert.equal(normalizeEmail('Dana <Dana+news@Northstar.Example>'), 'dana@northstar.example');
  assert.equal(normalizeEmail('  A.B@x.example '), 'a.b@x.example');
  assert.equal(normalizeEmail('not an address'), '');
  assert.equal(normalizeEmail(''), '');
});

test('domain matching: same company, different person', () => {
  assert.ok(sameCompany('ann@blueridgehvac.example', 'bob@blueridgehvac.example'));
  assert.ok(!sameCompany('ann@blueridgehvac.example', 'ann@harborplumbing.example'));
});

test('domain matching: subdomains belong to the company', () => {
  assert.equal(companyDomain('mail.eu.blueridgehvac.example'), 'blueridgehvac.example');
  assert.equal(companyDomain('ann@billing.blueridgehvac.example'), 'blueridgehvac.example');
  assert.equal(companyDomain('https://www.blueridgehvac.example/pricing?x=1'), 'blueridgehvac.example');
  assert.equal(companyDomain('shop.acme.co.uk'), 'acme.co.uk');
  assert.ok(sameCompany('ann@blueridgehvac.example', 'bob@ops.blueridgehvac.example'));
  assert.equal(companyDomain('nonsense'), '');
});

test('domain matching: free-mail addresses never match a company', () => {
  for (const domain of ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'hotmail.com', 'proton.me']) assert.ok(FREE_MAIL.has(domain), domain);
  assert.ok(isFreeMail('someone@gmail.com'));
  assert.ok(!isFreeMail('someone@blueridgehvac.example'));
  assert.ok(!sameCompany('ann@gmail.com', 'bob@gmail.com'));
  assert.ok(!sameCompany('ann@gmail.com', 'ann@gmail.com'));
});

test('domain matching: a free-mail reply matches a card by exact address only', () => {
  const card = parseCard(
    { number: 1, title: 'Personal Mail HVAC (gmail.com)', state: 'open', labels: [], url: 'u', comments: [], body: '| Field | Value |\n|---|---|\n| Contacts | Ann Lee, ann@gmail.com, Owner |\n| Setup | 1 |\n\n---\n\n**2026-03-04 09:00 \u00b7 AI agent \u00b7 found-out**\nx' },
    TZ,
  );
  assert.equal(matchReplyToCard({ from_email: 'ann@gmail.com' }, [card]).by, 'address');
  assert.equal(matchReplyToCard({ from_email: 'bob@gmail.com' }, [card]).card, null);
});

// ---------------------------------------------------------------------------
// Cards, notes and reply-to-card matching on the fixtures
// ---------------------------------------------------------------------------

test('cards: the header table, the contacts and every dated note are read', () => {
  const cards = parsedCards();
  assert.equal(cards.length, 9);
  const blue = cardByDomain(cards, 'blueridgehvac.example');
  assert.equal(blue.company, 'Blue Ridge HVAC');
  assert.deepEqual(blue.labels, ['New reply']);
  assert.equal(blue.setup, 1);
  assert.ok(blue.addresses.has('marcus.bell@blueridgehvac.example'));
  assert.deepEqual(blue.notes.map((note) => note.kind), ['reply', 'found-out', 'next-step']);
  const sunbelt = cardByDomain(cards, 'sunbeltrepair.example');
  assert.equal(sunbelt.setup, 3);
  assert.equal(sunbelt.contactList.length, 2);
  assert.equal(cardByDomain(cards, 'cedarvalleyservices.example').state, 'closed');
});

test('notes: header shape, writer, kind and time in the zone', () => {
  const notes = parseNotes('**2026-03-04 09:12 \u00b7 AI agent \u00b7 reply**\nbody one\n\n**2026-03-04 09:30 \u00b7 Sam Okafor \u00b7 note**\nbody two', TZ);
  assert.deepEqual(notes.map((n) => [n.writer, n.kind, n.body]), [['AI agent', 'reply', 'body one'], ['Sam Okafor', 'note', 'body two']]);
  assert.equal(notes[0].at.toISOString(), '2026-03-04T14:12:00.000Z'); // 09:12 in New York in early March is UTC-5
});

test('reply-to-card matching: every fixture reply lands on the right card', () => {
  const cards = parsedCards();
  const expect = {
    'marcus.bell@blueridgehvac.example': ['blueridgehvac.example', 'address'],
    'tom@harborplumbing.example': ['harborplumbing.example', 'address'],
    'rosa.delgado@sunbeltrepair.example': ['sunbeltrepair.example', 'address'],
    'pete.ostrander@northwindmech.example': ['northwindmech.example', 'address'],
    'denise.whitfield@gulfcoastcooling.example': ['gulfcoastcooling.example', 'address'],
    'accounts@northwindmech.example': ['northwindmech.example', 'domain'],
  };
  for (const [email, [domain, by]] of Object.entries(expect)) {
    const found = matchReplyToCard(replyBy(email), cards);
    assert.equal(found.card?.domain, domain, email);
    assert.equal(found.by, by, email);
  }
  assert.equal(matchReplyToCard(replyBy('owner@lakeshorehvac.example'), cards).card, null);
});

test('reply-to-card matching: a quoted reply on the card counts as logged, a new one does not', () => {
  const cards = parsedCards();
  const blue = cardByDomain(cards, 'blueridgehvac.example');
  assert.ok(replyIsLogged(replyBy('marcus.bell@blueridgehvac.example'), blue));
  const north = cardByDomain(cards, 'northwindmech.example');
  assert.ok(!replyIsLogged(replyBy('accounts@northwindmech.example'), north));
  assert.ok(replyIsLogged(replyBy('pete.ostrander@northwindmech.example'), north));
});

test('reply-to-card matching: bounce notices are not replies', () => {
  assert.ok(isSystemMessage(replyBy('mailer-daemon@mail.example')));
  assert.ok(!isSystemMessage(replyBy('marcus.bell@blueridgehvac.example')));
});

test('booking-to-card matching: by address, then domain, then name', () => {
  const cards = parsedCards();
  const sunbelt = cardByDomain(cards, 'sunbeltrepair.example');
  assert.equal(matchBookingToCard({ invitee_email: 'rosa.delgado@sunbeltrepair.example' }, cards).by, 'address');
  assert.equal(matchBookingToCard({ invitee_email: 'someone.new@sunbeltrepair.example' }, cards).by, 'domain');
  const byName = matchBookingToCard({ invitee_email: 'rosa@gmail.com', invitee_name: 'Rosa Delgado' }, cards);
  assert.equal(byName.by, 'name');
  assert.equal(byName.card.number, sunbelt.number);
  assert.equal(matchBookingToCard({ invitee_email: 'nobody@elsewhere.example', invitee_name: 'No One' }, cards).card, null);
});

// ---------------------------------------------------------------------------
// The waiting-time rule
// ---------------------------------------------------------------------------

test('waiting-time rule: weekends are skipped', () => {
  // Friday 16:00 to Monday 10:00 is 8 + 10 = 18 working hours: no alarm.
  assert.equal(workingElapsedMs(at('2026-03-06', '16:00'), at('2026-03-09', '10:00'), TZ), 18 * 3600e3);
  assert.ok(!isWaitingTooLong(at('2026-03-06', '16:00'), at('2026-03-09', '10:00'), TZ));
  // The same Friday reply at Monday 17:00 is 25 working hours: alarm.
  assert.ok(isWaitingTooLong(at('2026-03-06', '16:00'), at('2026-03-09', '17:00'), TZ));
  // Only the weekend between: Friday 23:00 to Monday 01:00 is 2 working hours.
  assert.equal(workingElapsedMs(at('2026-03-06', '23:00'), at('2026-03-09', '01:00'), TZ), 2 * 3600e3);
});

test('waiting-time rule: more than one working day raises, exactly one does not', () => {
  assert.ok(!isWaitingTooLong(at('2026-03-11', '10:00'), at('2026-03-12', '09:59'), TZ));
  assert.ok(!isWaitingTooLong(at('2026-03-11', '10:00'), at('2026-03-12', '10:00'), TZ));
  assert.ok(isWaitingTooLong(at('2026-03-11', '10:00'), at('2026-03-12', '10:01'), TZ));
  assert.ok(isWaitingTooLong(at('2026-03-05', '16:00'), at('2026-03-06', '17:00'), TZ));
  assert.equal(workingElapsedMs(at('2026-03-12', '10:00'), at('2026-03-12', '09:00'), TZ), 0);
});

test('waiting-time rule: it names the person (the approver at stage 1, the card owner of a handover)', () => {
  const waiting = waitingList(parsedCards(), northstar, NOW);
  const byCompany = Object.fromEntries(waiting.map(({ card, wait }) => [card.company, wait.person]));
  assert.deepEqual(byCompany, { 'Harbor Plumbing Co.': 'Sam Okafor', 'Gulf Coast Cooling': 'Dana Reyes', 'Granite State Electric': 'Priya Natarajan' });
  assert.ok(waiting[0].wait.waitedMs >= waiting[1].wait.waitedMs && waiting[1].wait.waitedMs >= waiting[2].wait.waitedMs, 'longest wait first');
});

test('waiting-time rule: an open handover is a wait whatever the label says (the Do not write card waits on Priya)', () => {
  const granite = waitingList(parsedCards(), northstar, NOW).find(({ card }) => card.company === 'Granite State Electric');
  assert.ok(granite, 'the Granite State card, label "Do not write", is on the list');
  assert.equal(granite.wait.why, 'handover');
  assert.equal(granite.wait.person, 'Priya Natarajan');
  assert.ok(isWaitingTooLong(granite.wait.since, NOW, TZ));
});

function handoverCard(labels, notes) {
  return parseCard({
    number: 90, title: 'Test Co (testco.example)', state: 'open', labels, url: 'https://github.com/example-owner/ai-sdr-starter/issues/90',
    body: '| Field | Value |\n|---|---|\n| Domain | testco.example |\n| Contacts | Ann Test, ann@testco.example, Owner |\n| Setup | 1 |\n\n---\n\n**2026-03-03 09:00 · AI agent · reply**\nFrom: ann@testco.example\nSubject: Re: hello\nThread: x\n\nDoes it do Xero?',
    comments: notes.map((body) => ({ body, created_at: '2026-03-03T14:00:00Z' })),
  }, TZ);
}
const HANDOVER = '**2026-03-03 09:10 · AI agent · handover**\nTo: Sam Okafor\nNeeds: answer the Xero question\nBecause: knowledge/ does not say\nLead\'s last message: "Does it do Xero?"';

test('waiting-time rule: a handover left on "New reply" (the waiting list at work) is a wait, and a later answer or send ends it', () => {
  const open = waitingOnPerson(handoverCard(['New reply'], [HANDOVER]), northstar, NOW);
  assert.equal(open.person, 'Sam Okafor');
  assert.equal(open.why, 'handover');
  const noName = HANDOVER.replace('To: Sam Okafor\nNeeds', 'Needs');
  assert.equal(waitingOnPerson(handoverCard(['New reply'], [noName]), northstar, NOW).person, 'Sam Okafor', 'no To: line, so waiting_list_answerer');
  const answered = '**2026-03-04 10:00 · Sam Okafor · note**\nNo, there is no Xero sync.';
  assert.equal(waitingOnPerson(handoverCard(['New reply'], [HANDOVER, answered]), northstar, NOW), null, 'a person answered');
  const sent = '**2026-03-04 10:00 · AI agent · sent**\nFrom: dana@northstardispatch.example\nTo: ann@testco.example\nSubject: Re: hello\nApproved by: Sam Okafor, 2026-03-04 09:58\nFollow-up due: none\nMaterial: none\n\nNo Xero sync.';
  assert.equal(waitingOnPerson(handoverCard(['New reply'], [HANDOVER, sent]), northstar, NOW), null, 'the AI agent answered');
  assert.equal(waitingOnPerson(handoverCard(['Booked'], [HANDOVER]), northstar, NOW), null, 'the call host handover on a Booked card is not a wait for an answer');
});

test('waiting-time rule: a colleague who wrote to the company after the reply ends the wait', () => {
  const answered = [
    { message_id: '<x@mail.example>', direction: 'sent', from_email: 'dana@northstardispatch.example', to_emails: ['rick.tomlin@gulfcoastcooling.example'], date: '2026-03-11T15:00:00Z' },
  ];
  const names = waitingList(parsedCards(), northstar, NOW, answered).map(({ card }) => card.company);
  assert.deepEqual(names, ['Granite State Electric', 'Harbor Plumbing Co.']);
  const priya = [
    { message_id: '<y@mail.example>', direction: 'sent', from_email: 'priya@northstardispatch.example', to_emails: ['lisa.moreau@granitestateelectric.example'], date: '2026-03-09T15:00:00Z' },
  ];
  const afterPriya = waitingList(parsedCards(), northstar, NOW, priya).map(({ card }) => card.company);
  assert.deepEqual(afterPriya, ['Harbor Plumbing Co.', 'Gulf Coast Cooling'], 'Priya answering Lisa by email ends the handover wait too; a draft never ends by mail');
});

// ---------------------------------------------------------------------------
// The daily check
// ---------------------------------------------------------------------------

test('daily check: missed replies, long waits and unconfirmed calls become alarms, and nothing else does', () => {
  const { alarms, stats } = evaluate({ settings: northstar, cards: cardsFixture.cards, replies: repliesFixture.replies, bookings: bookingsFixture.bookings, mailboxMessages: repliesFixture.mailbox_messages, now: NOW });
  const kinds = alarms.map((alarm) => alarm.kind).sort();
  assert.deepEqual(kinds, ['missed-reply', 'missed-reply', 'no-show', 'waiting-too-long', 'waiting-too-long', 'waiting-too-long']);
  assert.equal(stats.systemSkipped, 1);
  const missed = alarms.filter((alarm) => alarm.kind === 'missed-reply').map((alarm) => alarm.lead).sort();
  assert.deepEqual(missed, ['accounts@northwindmech.example', 'owner@lakeshorehvac.example']);
  const waiting = alarms.filter((alarm) => alarm.kind === 'waiting-too-long');
  assert.ok(waiting.every((alarm) => alarm.text.includes(alarm.person) && alarm.text.includes(`card #${alarm.card.number}`)), 'each alarm names the person and the card');
  const noShow = alarms.find((alarm) => alarm.kind === 'no-show');
  assert.match(noShow.text, /Sunbelt Appliance Repair/);
  assert.match(noShow.text, /Dana Reyes/);
});

test('daily check: its alarm files never erase lines written earlier the same day', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-sdr-alarms-'));
  try {
    const shared = path.join(dir, '2026-03-12.md');
    fs.writeFileSync(shared, ['2026-03-12 07:10 run-agent.sh: the token expired', 'Handled 2026-03-12 07:20 #4', ''].join('\n'));
    appendAlarmLine(dir, '2026-03-12', '2026-03-12 07:15 daily-check.mjs: the daily check could not run');
    writeCheckFile(dir, '2026-03-12', 'first\n');
    writeCheckFile(dir, '2026-03-12', 'second\n');
    const kept = fs.readFileSync(shared, 'utf8');
    assert.ok(kept.includes('run-agent.sh: the token expired') && kept.includes('Handled 2026-03-12 07:20 #4'), 'earlier lines stay');
    assert.ok(kept.includes('daily-check.mjs: the daily check could not run'), 'the new line is added');
    assert.equal(fs.readFileSync(path.join(dir, '2026-03-12-daily-check.md'), 'utf8'), 'second\n', 'the check rewrites only its own file');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('daily check: with every reply logged and nobody waiting there is no alarm', () => {
  const quiet = evaluate({ settings: northstar, cards: [cardsFixture.cards[0]], replies: [replyBy('marcus.bell@blueridgehvac.example')], bookings: [], now: NOW });
  assert.equal(quiet.alarms.length, 0);
  assert.equal(quiet.stats.matched, 1);
});

test('daily check: a booked call with no host named in the settings raises an alarm', () => {
  const noHost = { ...northstar, approval: { ...northstar.approval, call_host: '' } };
  const { alarms } = evaluate({ settings: noHost, cards: cardsFixture.cards, replies: [], bookings: bookingsFixture.bookings, now: NOW });
  const alarm = alarms.find((entry) => entry.kind === 'no-host');
  assert.ok(alarm);
  assert.match(alarm.text, /call_host/);
});

test('daily check: a booking made before the AI agent wrote does not raise a no-show', () => {
  const { alarms } = evaluate({ settings: northstar, cards: cardsFixture.cards, replies: [], bookings: bookingsFixture.bookings, now: NOW });
  assert.ok(alarms.every((alarm) => !alarm.text.includes('Gulf Coast Cooling') || alarm.kind !== 'no-show'));
});

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

test('report: the first line is calls booked and held, and only bookings after the first AI email count', () => {
  const since = at(cardsFixture.report_since, '00:00');
  const report = buildReport({ settings: northstar, cards: cardsFixture.cards, bookings: bookingsFixture.bookings, mailboxMessages: repliesFixture.mailbox_messages, now: NOW, since });
  const first = report.text.split('\n')[0];
  assert.match(first, /^Calls booked: \d+ \u00b7 held: \d+ \(since \d{4}-\d{2}-\d{2}\)$/);
  assert.equal(first, 'Calls booked: 2 \u00b7 held: 1 (since 2026-03-02)');
  assert.ok(!report.text.includes('Gulf Coast Cooling (card #9, https://github.com/example-owner/ai-sdr-starter/issues/9)\n   Meeting'), 'the colleague-made booking is not a row');
});

test('report: one row per booking, with what was asked, what was answered and what a person must do', () => {
  const since = at(cardsFixture.report_since, '00:00');
  const report = buildReport({ settings: northstar, cards: cardsFixture.cards, bookings: bookingsFixture.bookings, now: NOW, since });
  assert.equal(report.rows.length, 2);
  for (const part of ['The lead asked:', 'The AI agent answered:', 'A person must:', 'Meeting:']) {
    assert.equal(report.text.split(part).length - 1, 2, part);
  }
  assert.match(report.text, /Status: held/);
  assert.match(report.text, /Status: NO-SHOW/);
});

test('report: the replies waiting for a person are listed with the wait and the name', () => {
  const since = at(cardsFixture.report_since, '00:00');
  const text = buildReport({ settings: northstar, cards: cardsFixture.cards, bookings: bookingsFixture.bookings, now: NOW, since }).text;
  assert.match(text, /Replies waiting for a person: 3/);
  assert.match(text, /Harbor Plumbing Co\..*waited .* on Sam Okafor/);
  assert.match(text, /Gulf Coast Cooling.*waited .* on Dana Reyes/);
  assert.match(text, /Granite State Electric.*waited .* on Priya Natarajan/);
});

test('report: the example in the owner-report skill has the same shape as the report the script prints', () => {
  const skill = read('.claude/skills/owner-report/SKILL.md').replace(/\r\n/g, '\n');
  const example = /```\n([\s\S]*?)\n```/.exec(skill)?.[1] ?? '';
  const since = at(cardsFixture.report_since, '00:00');
  const printed = buildReport({ settings: northstar, cards: cardsFixture.cards, bookings: bookingsFixture.bookings, now: NOW, since }).text;
  const shape = (text) => text.split('\n').map((line) => line.replace(/^\d+\. .*$/, '<row>').replace(/^- .*$/, '<waiting>').replace(/^(\s+[A-Za-z ]+:).*$/, '$1').replace(/^Replies waiting for a person: \d+$/, 'Replies waiting for a person: N').replace(/^Calls booked: .*$/, 'Calls booked'));
  const collapse = (lines) => lines.filter((line, index) => line !== lines[index - 1]).join('\n').trimEnd();
  assert.equal(collapse(shape(example)), collapse(shape(printed)), 'the skill example and the script output differ in shape');
  assert.ok(!/NO-SHOW or not recorded|No-show or not recorded/.test(skill));
});

test('report: zero is written as zero and the number of emails sent never appears', () => {
  const since = at('2026-03-10', '00:00');
  const report = buildReport({ settings: northstar, cards: [cardsFixture.cards[0]], bookings: [], now: NOW, since });
  assert.equal(report.text.split('\n')[0], 'Calls booked: 0 \u00b7 held: 0 (since 2026-03-10)');
  assert.match(report.text, /Replies waiting for a person: 0/);
  const full = buildReport({ settings: northstar, cards: cardsFixture.cards, bookings: bookingsFixture.bookings, now: NOW, since: at(cardsFixture.report_since, '00:00') }).text;
  assert.ok(!/(emails? sent|number of (emails|sends)|\d+ (emails?|sends)\b)/i.test(full), 'no count of sends');
});

// ---------------------------------------------------------------------------
// The sign-up flow (way C)
// ---------------------------------------------------------------------------

test('sign-up flow: free-mail, test accounts and invalid addresses are dropped', () => {
  assert.equal(dropReason({ email: 'jess@gmail.com' }), 'free-mail address');
  assert.equal(dropReason({ email: 'test.dispatcher@northstardispatch.example' }), 'test account');
  assert.equal(dropReason({ email: 'qa+trial@acme.example' }), 'test account');
  assert.equal(dropReason({ email: 'ann+test@acme.example' }), 'test account');
  assert.equal(dropReason({ email: 'dev@acme.example' }), 'test account');
  assert.equal(dropReason({ email: 'ann@mine.example' }, { ownDomains: ['mine.example'] }), 'test account');
  assert.equal(dropReason({ email: 'boss@acme.example' }, { testAccounts: ['boss@acme.example'] }), 'test account');
  assert.equal(dropReason({ email: 'nobody' }), 'not an email address');
  assert.equal(dropReason({ email: 'pat.morrow@summitcomfort.example' }), null);
  assert.equal(dropReason({ email: 'testa@acme.example' }), null, 'a name that only starts with "test" is a person');
});

test('sign-up flow: the size floor decides fit, no fit and unknown', () => {
  assert.equal(qualify({ employees: 48 }, northstar).verdict, 'fit');
  assert.equal(qualify({ employees: 15 }, northstar).verdict, 'fit');
  assert.equal(qualify({ employees: 8 }, northstar).verdict, 'no-fit');
  assert.equal(qualify({ employees: null }, northstar).verdict, 'unknown');
  assert.equal(qualify(null, northstar).verdict, 'unknown');
});

const EXAMPLE_TEMPLATES = path.join(ROOT, 'examples', 'northstar', 'templates', 'en');

test('sign-up flow: the shipped templates keep fill-in marks and no company wording, so they never send unfinished', () => {
  const templates = loadTemplates(path.join(ROOT, 'engine', 'way-c-scripts', 'templates', 'en'));
  const values = { first_name: 'Pat', company: 'Summit Comfort Air', signup_date: '2026-03-12', sender_name: 'Dana Reyes', booking_link: 'https://calendly.com/x/y' };
  for (const template of [templates['first-email'], ...templates.followUps]) {
    assert.ok(!/northstar/i.test(`${template.subject}\n${template.body}`), 'no company name in the shipped template');
    assert.throws(() => renderTemplate(`${template.subject}\n${template.body}`, values), /fill-in mark/);
  }
});

test('sign-up flow: the example templates render, and a missing value stops the email', () => {
  const templates = loadTemplates(EXAMPLE_TEMPLATES);
  assert.ok(templates.followUps.length >= 2);
  const values = { first_name: 'Pat', company: 'Summit Comfort Air', signup_date: '2026-03-12', sender_name: 'Dana Reyes', booking_link: 'https://calendly.com/x/y' };
  for (const template of [templates['first-email'], ...templates.followUps]) {
    const text = renderTemplate(`${template.subject}\n${template.body}`, values);
    assert.ok(!text.includes('{{'));
    assert.ok(text.split(/\s+/).length < 120, 'under 120 words');
    assert.ok(text.includes('https://calendly.com/x/y'), 'ends with a next step: the booking link');
  }
  assert.throws(() => renderTemplate('Hi {{first_name}}', { first_name: '' }), /no value for \{\{first_name\}\}/);
  assert.throws(() => renderTemplate('Hi {{nickname}}', { nickname: 'x' }), /does not know/);
});

test('sign-up flow: sending days, hours and the readiness of the settings', () => {
  assert.ok(inSendingWindow(at('2026-03-12', '11:00'), northstar).ok);
  assert.ok(!inSendingWindow(at('2026-03-14', '11:00'), northstar).ok, 'Saturday');
  assert.ok(!inSendingWindow(at('2026-03-12', '08:59'), northstar).ok, 'before opening');
  assert.ok(!inSendingWindow(at('2026-03-12', '17:00'), northstar).ok, 'at closing time');
  const template = normalizeSettings(readYamlFile(path.join(ROOT, 'rules', 'settings.yml')));
  assert.ok(sendReadiness(template).length >= 4, 'an empty template is not ready to send');
  assert.deepEqual(sendReadiness(northstar), []);
});

function wayCCard(sentAt) {
  const header = '| Field | Value |\n|---|---|\n| Company | Summit Comfort Air |\n| Domain | summitcomfort.example |\n| Contacts | Pat Morrow, pat.morrow@summitcomfort.example, (title not given) |\n| Source | Trial sign-up 2026-03-02 (feed) |\n| Setup | 3 |';
  const notes = sentAt.map(([date, time]) => `**${date} ${time} \u00b7 AI agent \u00b7 sent**\nTo: pat.morrow@summitcomfort.example\nSubject: Your trial\n\nHi`);
  const [first, ...rest] = notes.length ? notes : ['**2026-03-02 10:00 \u00b7 AI agent \u00b7 found-out**\nVerdict: fits. First email next.'];
  return parseCard({ number: 20, title: 'Summit Comfort Air (summitcomfort.example)', state: 'open', labels: ['Sent, waiting'], url: 'u', body: `${header}\n\n---\n\n${first}`, comments: rest.map((body) => ({ body, created_at: '2026-03-05T00:00:00Z' })) }, TZ);
}

test('sign-up flow: follow-ups come on the fixed days, then the sequence ends', () => {
  const templates = { 'first-email': {}, followUps: [{}, {}] };
  assert.equal(followUpLimit(northstar, templates), 2, 'follow_ups 3 means 3 emails in a row, the first email and 2 follow-ups. The smallest of the setting, the days and the templates');
  const withThree = { 'first-email': {}, followUps: [{}, {}, {}] };
  assert.equal(followUpLimit(northstar, withThree), 2, 'a third template does not add an email: the first email counts toward follow_ups');
  assert.equal(followUpLimit({ email: { follow_ups: 4, follow_up_days: [3, 7, 14] } }, withThree), 3, 'follow_ups 4 is the first email and 3 follow-ups');
  assert.equal(followUpLimit({ email: { follow_ups: 1, follow_up_days: [3, 7, 14] } }, withThree), 0, 'follow_ups 1 is the first email only');
  const two2 = { ...northstar, email: { ...northstar.email, follow_ups: 2 } };
  assert.equal(followUpLimit(two2, templates), 1, 'follow_ups 2 is the first email and 1 follow-up, even with two templates');
  assert.equal(nextEmail(wayCCard([['2026-03-02', '10:00']]), two2, templates, at('2026-03-12', '10:01')).kind, 'follow-up', 'the one follow-up that follow_ups 2 allows');
  assert.equal(nextEmail(wayCCard([['2026-03-02', '10:00'], ['2026-03-05', '10:00']]), two2, templates, at('2026-03-30', '10:00')).kind, 'ended', 'follow_ups 2 stops after the first email and one follow-up');
  assert.equal(nextEmail(wayCCard([]), northstar, templates, NOW).kind, 'first-email');
  const one = wayCCard([['2026-03-09', '10:00']]); // first email on Monday; follow-up 1 is 3 days later
  assert.equal(nextEmail(one, northstar, templates, at('2026-03-11', '10:00')).kind, 'wait');
  assert.equal(nextEmail(one, northstar, templates, at('2026-03-12', '10:01')).kind, 'follow-up');
  assert.equal(nextEmail(one, northstar, templates, at('2026-03-12', '10:01')).number, 1);
  const two = wayCCard([['2026-03-02', '10:00'], ['2026-03-05', '10:00']]);
  assert.equal(nextEmail(two, northstar, templates, at('2026-03-11', '10:00')).kind, 'wait');
  assert.equal(nextEmail(two, northstar, templates, at('2026-03-12', '10:01')).number, 2, 'follow-up 2 is 7 days after follow-up 1');
  const three = wayCCard([['2026-03-02', '10:00'], ['2026-03-05', '10:00'], ['2026-03-12', '10:00']]);
  assert.equal(nextEmail(three, northstar, templates, at('2026-03-30', '10:00')).kind, 'ended');
});

function decision(overrides = {}) {
  const templates = loadTemplates(EXAMPLE_TEMPLATES);
  return decide({
    settings: northstar,
    now: at('2026-03-12', '11:00'),
    templates,
    signup: { email: 'pat.morrow@summitcomfort.example', name: 'Pat Morrow', company: 'Summit Comfort Air', created_at: '2026-03-12T12:05:00Z' },
    card: null,
    domain: 'summitcomfort.example',
    crm: { found: false, open_deals: [] },
    org: { employees: 48, industry: 'HVAC', country: 'United States' },
    orgLookedUp: true,
    personMail: [],
    bookings: [],
    sendingOn: true,
    readiness: [],
    window: { ok: true },
    capLeft: 10,
    ...overrides,
  });
}

test('sign-up flow: a fit sign-up gets the lead created, a found-out note and the first email', () => {
  const plan = decision();
  assert.equal(plan.crmLead, true);
  assert.equal(plan.email.mode, 'send');
  assert.equal(plan.email.template, 'first-email');
  assert.equal(plan.email.to, 'pat.morrow@summitcomfort.example');
  assert.equal(plan.label, 'Sent, waiting');
  assert.deepEqual(plan.notes.map((note) => note.kind), ['found-out']);
  const lines = plan.notes[0].body.split('\n');
  assert.match(lines[0], /^Trial sign-up received: pat\.morrow@summitcomfort\.example at 2026-03-12 08:05$/);
  assert.deepEqual(lines.slice(1).map((line) => line.split(':')[0]), ['Customer check (CRM, by domain)', 'Our person in the thread (CRM, mailbox, calendar, card)', 'Booking on the calendar', 'Company (Apollo)', 'Verdict']);
});

test('sign-up flow: with the flag file missing it writes a draft and sends nothing', () => {
  const plan = decision({ sendingOn: false });
  assert.equal(plan.email.mode, 'draft');
  assert.equal(plan.label, 'Draft ready');
  assert.match(plan.email.why, /flag file SENDING_ON is missing/);
});

test('sign-up flow: outside the window, past the cap or with incomplete settings it does not send', () => {
  assert.equal(decision({ window: { ok: false, why: 'Sat is not a sending day' } }).email.mode, 'wait');
  assert.equal(decision({ capLeft: 0 }).email.mode, 'wait');
  const incomplete = decision({ readiness: ['email.daily_cap is 0'] });
  assert.equal(incomplete.email.mode, 'draft');
  assert.match(incomplete.email.why, /settings are incomplete/);
});

test('sign-up flow: a customer, a colleague in the thread and a booking each stop the first email', () => {
  const customer = decision({ crm: { found: true, id: '1', is_customer: true, open_deals: [] } });
  assert.equal(customer.label, 'No fit');
  assert.equal(customer.close, true);
  assert.equal(customer.email, null);
  const person = decision({ personMail: [{ from_email: 'dana@northstardispatch.example', to_emails: ['x@summitcomfort.example'], date: '2026-03-06T20:00:00Z', direction: 'sent' }] });
  assert.equal(person.label, 'Our person is in the thread');
  assert.equal(person.email, null);
  assert.equal(person.crmLead, false);
  const deal = decision({ crm: { found: true, id: '2', is_customer: false, open_deals: [{ name: 'Fleet', stage: 'Quote sent' }] } });
  assert.equal(deal.label, 'Our person is in the thread');
  const booked = decision({ bookings: [{ event_name: 'Intro call', start_time: '2026-03-13T15:00:00Z', host_name: 'Dana Reyes' }] });
  assert.equal(booked.label, 'Booked');
  assert.equal(booked.email, null);
});

function cardWithNotes(notes) {
  const note = (when, writer, kind, text) => `**2026-03-${when} · ${writer} · ${kind}**\n${text}`;
  return parseCard(
    {
      number: 1,
      title: 'Test Co (testco.example)',
      state: 'open',
      labels: [],
      body: `| Field | Value |\n|---|---|\n| Company | Test Co |\n| Domain | testco.example |\n\n---\n\n${note('03 09:00', 'AI agent', 'found-out', 'Verdict: fits')}`,
      comments: notes.map(([when, writer, kind, text]) => ({ body: note(when, writer, kind, text), created_at: '2026-03-04T00:00:00Z' })),
    },
    TZ,
  );
}

test('one rule: notes that answer the AI agent are not "our person talking" (approval, call host after a booking, answer to a handover)', () => {
  const approved = cardWithNotes([['03 10:00', 'Sam Okafor', 'note', 'approved']]);
  assert.equal(personNoteOn(approved, northstar), null, 'the approver\'s approval is not our person');
  assert.ok(personNoteOn(approved, {}), 'without the approver named in the settings, any person\'s note is a hit');
  const question = cardWithNotes([['03 10:00', 'Sam Okafor', 'note', 'Please ask them about QuickBooks first.']]);
  assert.equal(personNoteOn(question, northstar)?.writer, 'Sam Okafor', 'a note that is not an approval is a person talking');
  const afterBooking = cardWithNotes([['04 08:00', 'AI agent', 'booking', 'Meeting: 2026-03-10 11:00'], ['09 11:00', 'Dana Reyes', 'note', 'Call went well.']]);
  assert.equal(personNoteOn(afterBooking, northstar), null, 'the call host\'s note after a booking is not our person');
  const noBooking = cardWithNotes([['09 11:00', 'Dana Reyes', 'note', 'I spoke to the owner by phone.']]);
  assert.equal(personNoteOn(noBooking, northstar)?.writer, 'Dana Reyes', 'the host\'s note with no booking is our person talking');
  const answer = cardWithNotes([['04 09:00', 'AI agent', 'handover', 'To: Sam Okafor\nNeeds: answer the question\nBecause: not in knowledge/\nLead\'s last message: 2026-03-04'], ['04 12:00', 'Sam Okafor', 'note', 'Yes, QuickBooks Desktop is not supported.']]);
  assert.equal(personNoteOn(answer, northstar), null, 'the answer to a handover is not our person');
  const plan = decision({ card: approved, domain: 'testco.example' });
  assert.notEqual(plan.label, 'Our person is in the thread', 'an approval note never flips the label');
});

test('sign-up flow: below the floor closes the card, an unknown size waits for a person', () => {
  const small = decision({ org: { employees: 8, industry: 'Plumbing', country: 'United States' } });
  assert.equal(small.label, 'No fit');
  assert.equal(small.close, true);
  assert.equal(small.email, null);
  assert.equal(small.crmLead, false);
  const unknown = decision({ org: { employees: null, industry: 'HVAC', country: 'United States' } });
  assert.equal(unknown.label, 'New reply');
  assert.equal(unknown.close, false);
  assert.equal(unknown.email, null);
  assert.ok(unknown.notes.some((note) => note.kind === 'next-step' && /size/.test(note.body)));
});

test('sign-up flow: a template value that is missing writes an alarm note and no email', () => {
  const plan = decide({ ...decisionContext(), settings: { ...northstar, approval: { ...northstar.approval, call_host: '' } } });
  assert.equal(plan.email, null);
  assert.equal(plan.alarm, true);
  assert.match(plan.notes.at(-1).body, /no value for \{\{sender_name\}\}/);
});

function decisionContext() {
  return {
    settings: northstar,
    now: at('2026-03-12', '11:00'),
    templates: loadTemplates(EXAMPLE_TEMPLATES),
    signup: { email: 'pat.morrow@summitcomfort.example', name: 'Pat Morrow', company: 'Summit Comfort Air', created_at: '2026-03-12T12:05:00Z' },
    card: null,
    domain: 'summitcomfort.example',
    crm: { found: false, open_deals: [] },
    org: { employees: 48, industry: 'HVAC', country: 'United States' },
    orgLookedUp: true,
    personMail: [],
    bookings: [],
    sendingOn: true,
    readiness: [],
    window: { ok: true },
    capLeft: 10,
  };
}

test('sign-up flow: a follow-up checks again first, then sends the next template', () => {
  const card = wayCCard([['2026-03-05', '10:00']]); // first email Thursday last week; follow-up 1 was due 2026-03-08
  const plan = decide({ ...decisionContext(), signup: null, card, org: null, orgLookedUp: false });
  assert.equal(plan.email.template, 'follow-up-1');
  assert.equal(plan.email.mode, 'send');
  assert.equal(plan.crmLead, false);
  const stopped = decide({ ...decisionContext(), signup: null, card, org: null, orgLookedUp: false, bookings: [{ event_name: 'Intro call', start_time: '2026-03-13T15:00:00Z', host_name: 'Dana Reyes' }] });
  assert.equal(stopped.label, 'Booked');
  assert.equal(stopped.email, null);
});

test('sign-up flow: a reply is written in full, a refusal closes the card, an autoresponder changes nothing', () => {
  const base = { from_email: 'pat.morrow@summitcomfort.example', from_name: 'Pat Morrow', subject: 'Re: Your trial' };
  const reply = planReply({ ...base, body: 'Can you do Tuesday at 3? I also have a question about QuickBooks.' }, northstar, NOW);
  assert.equal(reply.kind, 'reply');
  assert.equal(reply.label, 'New reply');
  assert.match(reply.notes[0].body, /Can you do Tuesday at 3\? I also have a question about QuickBooks\.$/);
  assert.match(reply.notes[0].body, /^From: Pat Morrow <pat\.morrow@summitcomfort\.example>/);
  const refusal = planReply({ ...base, body: 'Please remove me from your list.' }, northstar, NOW);
  assert.equal(refusal.kind, 'refusal');
  assert.equal(refusal.label, 'No fit');
  assert.equal(refusal.close, true);
  const auto = planReply({ ...base, subject: 'Automatic reply: Re: Your trial', body: 'I am out of the office.' }, northstar, NOW);
  assert.equal(auto.kind, 'autoreply');
  assert.equal(auto.label, null);
});

test('sign-up feed: a notification email becomes a sign-up', () => {
  const body = 'A new trial started.\nName: Pat Morrow\nEmail: Pat.Morrow@SummitComfort.example\nCompany: Summit Comfort Air';
  const signup = parseNotification({ message_id: '<n1@mail.example>', body, date: '2026-03-12T12:05:00Z' }, 'signups@northstardispatch.example');
  assert.deepEqual(signup, { id: '<n1@mail.example>', email: 'pat.morrow@summitcomfort.example', name: 'Pat Morrow', company: 'Summit Comfort Air', created_at: '2026-03-12T12:05:00Z', source: 'trial sign-up' });
  assert.equal(parseNotification({ message_id: 'x', body: 'no address here', date: '2026-03-12T12:05:00Z' }), null);
});

// ---------------------------------------------------------------------------
// Keys, tokens and fixtures
// ---------------------------------------------------------------------------

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-sdr-selftest-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('.env reader: a comment after an empty value is not the value, so a copy of .env.example leaves those lines empty', () => {
  const names = ['MAILBOX_PROVIDER', 'CRM', 'GITHUB_REPO', 'T_PLAIN', 'T_QUOTED', 'T_URL'];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  names.forEach((name) => delete process.env[name]);
  try {
    withTempDir((dir) => {
      const copy = path.join(dir, '.env');
      fs.copyFileSync(path.join(ROOT, '.env.example'), copy);
      fs.appendFileSync(copy, 'T_PLAIN=abc   # a comment\nT_QUOTED="a # b"   # a comment\nT_URL=https://x.example/page#top\n');
      assert.equal(loadEnv(copy), true);
    });
    assert.equal(process.env.MAILBOX_PROVIDER, '', 'MAILBOX_PROVIDER stays empty');
    assert.equal(process.env.CRM, '', 'CRM stays empty');
    assert.equal(process.env.GITHUB_REPO, 'owner/name');
    assert.equal(process.env.T_PLAIN, 'abc');
    assert.equal(process.env.T_QUOTED, 'a # b');
    assert.equal(process.env.T_URL, 'https://x.example/page#top', 'a # inside a value, with no space before it, stays');
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});

test('daily check, mailbox (setup 3): newsletters and internal mail raise no alarm, an answer to an AI email does', () => {
  const card = {
    number: 91, title: 'Mail Co (mailco.example)', state: 'open', labels: ['Sent, waiting'], url: 'https://github.com/example-owner/ai-sdr-starter/issues/91',
    body: '| Field | Value |\n|---|---|\n| Domain | mailco.example |\n| Contacts | Bo Mail, bo@mailco.example, Owner |\n| Setup | 3 |\n\n---\n\n**2026-03-10 10:00 · AI agent · sent**\nFrom: the sales rep mailbox\nTo: bo@mailco.example\nSubject: Dispatch scheduling for Mail Co\nApproved by: template (way C, no approval stage)\nFollow-up due: 2026-03-13\nMaterial: none\nMessage-Id: <sent-1@mail.example>\n\nHello.',
    comments: [],
  };
  const mail = (from, subject, extra = {}) => ({ id: from + subject, source: 'mailbox', campaign: '', from_email: from, from_name: '', subject, body: 'text', received_at: '2026-03-11T15:00:00Z', ...extra });
  const run = (replies) => evaluate({ settings: northstar, cards: [card], replies, now: NOW });
  const noise = run([mail('news@vendor.example', 'Your weekly digest'), mail('it@northstardispatch.example', 'Laptop renewal')]);
  assert.equal(noise.alarms.length, 0);
  assert.equal(noise.stats.ignored, 2);
  const bySubject = run([mail('cfo@othermail.example', 'RE: Dispatch scheduling for Mail Co')]);
  assert.deepEqual(bySubject.alarms.map((alarm) => alarm.kind), ['missed-reply'], 'an unknown sender who answers the subject of an AI email is a reply');
  const byId = run([mail('cfo@othermail.example', 'Quick question', { in_reply_to: '<sent-1@mail.example>' })]);
  assert.deepEqual(byId.alarms.map((alarm) => alarm.kind), ['missed-reply'], 'the id of a recorded send is a reply');
  const known = run([mail('bo@mailco.example', 'Anything at all')]);
  assert.deepEqual(known.alarms.map((alarm) => alarm.kind), ['missed-reply'], 'a sender on a card is a reply');
  const smartlead = run([{ ...mail('x@unknown.example', 'Your weekly digest'), source: 'smartlead' }]);
  assert.deepEqual(smartlead.alarms.map((alarm) => alarm.kind), ['missed-reply'], 'the filter is for the mailbox only: a Smartlead reply with no card is always an alarm');
});

test('daily check: the real run reads the mailbox, so a colleague email can end a wait', () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'daily-check.mjs')], { encoding: 'utf8', env: { ...process.env, DRY_RUN: '1' } });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /Mailbox messages read: [1-9]/);
  assert.equal((result.stdout.match(/\[waiting-too-long\]/g) ?? []).length, 3);
});

test('sign-up flow: the sent log keeps the last event of each email, skips a half-written line, and survives a missing file', () => {
  withTempDir((dir) => {
    const file = path.join(dir, 'runs', 'sent-log.jsonl');
    assert.equal(readSentLog(file).size, 0, 'no file is an empty log');
    const first = sentKey('Pat.Morrow+x@summitcomfort.example', 'first-email');
    assert.equal(first, 'pat.morrow@summitcomfort.example|first-email');
    appendSentLog({ event: 'attempt', key: first, at: '2026-03-12T16:00:00Z', to: 'pat.morrow@summitcomfort.example', template: 'first-email' }, file);
    assert.equal(readSentLog(file).get(first).event, 'attempt');
    appendSentLog({ event: 'sent', key: first, note: '**2026-03-12 11:00 · AI agent · sent**\nTo: pat.morrow@summitcomfort.example' }, file);
    appendSentLog({ event: 'failed', key: 'x@y.example|follow-up-1' }, file);
    fs.appendFileSync(file, '{"event":"logged","key":"half');
    const log = readSentLog(file);
    assert.equal(log.get(first).event, 'sent', 'the broken last line is skipped');
    assert.match(log.get(first).note, /\*\*2026-03-12 11:00/, 'the note is kept so a missing card note can be written from it');
    assert.equal(log.get('x@y.example|follow-up-1').event, 'failed');
    appendSentLog({ event: 'logged', key: first }, file);
    assert.equal(readSentLog(file).get(first).event, 'logged');
    assert.match(read('engine/way-c-scripts/signup-flow.mjs'), /already in runs\/sent-log\.jsonl/);
  });
});

test('sign-up flow: the test accounts listed in rules/02-what-to-check.md are read, and the template lists none', () => {
  const listed = readTestAccounts(path.join(ROOT, 'examples/northstar/rules'));
  assert.deepEqual(listed.sort(), ['dana.demo@northstar-labs.example', 'priya.trial@northstar-labs.example', 'sam.sandbox@northstar-labs.example']);
  assert.equal(dropReason({ email: 'priya.trial@northstar-labs.example' }, { testAccounts: listed }), 'test account');
  assert.deepEqual(readTestAccounts(path.join(ROOT, 'rules')), []);
  assert.match(read('rules/02-what-to-check.md'), /^## Test accounts \(setup 3\)$/m);
});

test('run-agent.sh: it says it is Linux only and stops with an alarm when flock or timeout is missing', () => {
  const script = read('engine/way-a-server/run-agent.sh');
  assert.match(script, /Linux only/);
  assert.match(script, /for tool in flock timeout/);
  assert.match(script, /exit 3/);
  assert.ok(script.indexOf('for tool in flock timeout') < script.indexOf('flock -n 9'), 'the tools are checked before the lock is taken');
});

test('keys never reach the output: key values and key shapes are removed', () => {
  process.env.SELFTEST_FAKE_API_KEY = 'abcdef123456SECRET';
  try {
    assert.equal(redact('token is abcdef123456SECRET here'), 'token is [redacted] here');
    assert.equal(redact('GET https://x.example/a?api_key=zzz999&x=1'), 'GET https://x.example/a?api_key=[redacted]&x=1');
    assert.equal(redact('Authorization: Bearer abc.def-ghi'), 'Authorization: Bearer [redacted]');
    assert.match(redact('-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----'), /^\[redacted private key\]$/);
  } finally {
    delete process.env.SELFTEST_FAKE_API_KEY;
  }
});

test('GitHub App token: the JWT is signed with the private key and carries the app id', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const jwt = createJwt({ appId: 12345, privateKey: pem, now: 1_800_000_000 });
  const [header, payload, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.deepEqual(claims, { iat: 1_800_000_000 - 60, exp: 1_800_000_000 + 540, iss: '12345' });
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url')));
});

test('the run instruction in CLAUDE.md is byte-equal to the text between the markers in engine/run-instruction.md', () => {
  const engine = read('engine/run-instruction.md').replace(/\r\n/g, '\n');
  const match = /<!-- instruction:start -->\n([\s\S]*?)\n<!-- instruction:end -->/.exec(engine);
  assert.ok(match, 'engine/run-instruction.md has the two markers');
  const instruction = match[1].trim();
  assert.ok(instruction.length > 200 && !instruction.includes('\n'), 'the instruction is one paragraph');
  const claude = read('CLAUDE.md').replace(/\r\n/g, '\n');
  assert.ok(claude.includes(`\n> ${instruction}\n`), 'CLAUDE.md quotes the same paragraph, word for word');
});

test('fixtures: every fixture file is valid JSON and uses only reserved example domains', () => {
  for (const name of ['replies', 'cards', 'bookings', 'signups', 'apollo', 'crm', 'links']) {
    const text = read(`scripts/fixtures/${name}.json`);
    JSON.parse(text);
    for (const [, host] of text.matchAll(/@([a-z0-9.-]+\.[a-z]+)/gi)) {
      assert.ok(/\.example$/.test(host), `${name}.json: ${host}`);
    }
  }
});

// ---------------------------------------------------------------------------
// The files of the template
// ---------------------------------------------------------------------------

const RULE_FILES = ['01-what-to-answer.md', '02-what-to-check.md', '03-icp-and-qualification.md', '04-how-to-write.md', '05-follow-ups-and-stop.md', '06-hard-rules.md', '07-launch-rules.md', '08-approval-and-people.md'];
const REQUIRED = [
  'README.md', 'LICENSE', 'CLAUDE.md', 'AGENTS.md', '.gitignore', '.env.example',
  'rules/README.md', 'rules/settings.yml', ...RULE_FILES.map((f) => `rules/${f}`),
  'knowledge/README.md', 'knowledge/plans-and-prices.md', 'knowledge/faq.md', 'knowledge/objections.md', 'knowledge/have-and-do-not-have.md', 'knowledge/materials/README.md', 'knowledge/materials/index.yml',
  'board/README.md', 'board/labels.yml', 'board/card-template.md', 'board/note-shapes.md', 'board/project-layout.md',
  '.github/ISSUE_TEMPLATE/lead-card.md', '.github/ISSUE_TEMPLATE/config.yml', '.github/workflows/check.yml',
  '.claude/skills/sdr-run/SKILL.md', '.claude/skills/draft-rules-from-threads/SKILL.md', '.claude/skills/first-run-setup/SKILL.md', '.claude/skills/owner-report/SKILL.md',
  'engine/README.md', 'engine/run-instruction.md',
  'engine/way-a-server/README.md', 'engine/way-a-server/run-agent.sh', 'engine/way-a-server/crontab.example',
  'engine/way-b-local/README.md',
  'engine/way-c-scripts/README.md', 'engine/way-c-scripts/signup-flow.mjs', 'engine/way-c-scripts/crontab.example',
  'engine/way-c-scripts/templates/en/first-email.md', 'engine/way-c-scripts/templates/en/follow-up-1.md', 'engine/way-c-scripts/templates/en/follow-up-2.md',
  'connections/README.md', 'connections/github-app.md', ...['apollo', 'zerobounce', 'smartlead', 'explee', 'mailbox', 'crm', 'calendly', 'shortio', 'slack', 'signups'].map((n) => `connections/${n}.md`),
  'control/README.md',
  'scripts/README.md', 'scripts/daily-check.mjs', 'scripts/report.mjs', 'scripts/board-labels.mjs', 'scripts/gh-app-token.mjs', 'scripts/selftest.mjs',
  'scripts/lib/settings.mjs', 'scripts/lib/github.mjs', 'scripts/lib/match.mjs', 'scripts/lib/slack.mjs', 'scripts/lib/http.mjs',
  ...['smartlead', 'explee', 'mailbox', 'calendly', 'shortio', 'apollo', 'crm', 'signups'].map((n) => `scripts/lib/adapters/${n}.mjs`),
  ...['replies', 'cards', 'bookings', 'signups', 'apollo', 'crm', 'links'].map((n) => `scripts/fixtures/${n}.json`),
  'docs/launch-checklist.md', 'docs/how-this-maps-to-the-guide.md',
  'examples/northstar/README.md', 'examples/northstar/rules/settings.yml', ...RULE_FILES.map((f) => `examples/northstar/rules/${f}`),
  'examples/northstar/knowledge/plans-and-prices.md', 'examples/northstar/knowledge/faq.md', 'examples/northstar/knowledge/objections.md', 'examples/northstar/knowledge/have-and-do-not-have.md', 'examples/northstar/knowledge/materials/index.yml',
  'alarms/.gitkeep', 'runs/.gitkeep',
];

test('every file of the template exists', () => {
  const missing = REQUIRED.filter((file) => !exists(file));
  assert.deepEqual(missing, [], `missing files: ${missing.join(', ')}`);
});

test('the example: nine sample cards, and the materials list has at least three pieces', () => {
  const cards = fs.existsSync(path.join(ROOT, 'examples/northstar/cards')) ? fs.readdirSync(path.join(ROOT, 'examples/northstar/cards')).filter((f) => f.endsWith('.md')) : [];
  assert.equal(cards.length, 9, 'nine sample cards, one per state');
  const materials = readYamlFile(path.join(ROOT, 'examples/northstar/knowledge/materials/index.yml'));
  assert.ok(Array.isArray(materials) && materials.length >= 3);
  for (const piece of materials) {
    for (const key of ['id', 'title', 'audience', 'url']) assert.ok(piece[key], `a materials entry has ${key}`);
  }
  const template = parseYaml(read('knowledge/materials/index.yml'), 'knowledge/materials/index.yml');
  assert.ok(template === null || typeof template === 'object', 'the template list parses');
});

test('the sample cards in the example use the nine labels, one each, in the order of the guide', () => {
  const dir = path.join(ROOT, 'examples/northstar/cards');
  if (!fs.existsSync(dir)) return;
  const labels = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((file) => {
    const front = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n'))[1];
    return [...front.matchAll(/^\s+-\s+"(.*)"$/gm)].map((m) => m[1]);
  });
  assert.deepEqual(labels.flat(), ['New reply', 'Draft ready', 'Sent, waiting', 'Booked', 'Call held', 'Parked', 'No fit', 'Do not write', 'Our person is in the thread']);
});

const NOTE_LINES = {
  'found-out': ['Customer check (CRM, by domain):', 'Our person in the thread (CRM, mailbox, calendar, card):', 'Booking on the calendar:', 'Company (Apollo):', 'Verdict:'],
  draft: ['To:', 'Subject:', 'Waits for:', 'Material:'],
  sent: ['From:', 'To:', 'Subject:', 'Approved by:', 'Follow-up due:', 'Material:'],
  reply: ['From:', 'Subject:', 'Thread:'],
  'link-opened': ['Material:', 'First opened:', 'Next:'],
  booking: ['Meeting:', 'Invitee:', 'Matched by:', "Created after the AI agent's first email to this company:", 'Qualification answers:'],
  'call-held': ['Confirmed by:', 'What happened:', 'Next step:'],
  'next-step': ['Do:', 'On:', 'Owner:', 'Why:'],
  handover: ['To:', 'Needs:', 'Because:', "Lead's last message:"],
  alarm: ['What:', 'Where:', 'Who must act:'],
};

test('the sample cards: every note has the lines of its kind in the pinned order (board/note-shapes.md), and approvals are plain comments', () => {
  const dir = path.join(ROOT, 'examples/northstar/cards');
  const headerLine = /^\*\*(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (.+?) · (found-out|draft|sent|reply|link-opened|booking|call-held|next-step|handover|alarm|note)\*\*$/;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.md')).sort()) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
    const afterFront = text.replace(/^---\n[\s\S]*?\n---\n/, '');
    const [bodyPart, commentsPart = ''] = afterFront.split('\n## Comments\n');
    const sections = [{ heading: 'body', text: bodyPart.split('\n---\n').slice(1).join('\n---\n') }];
    for (const piece of commentsPart.split(/\n### comment/).slice(1)) {
      const newline = piece.indexOf('\n');
      sections.push({ heading: piece.slice(0, newline).trim(), text: piece.slice(newline + 1) });
    }
    assert.ok(sections.length > 1, file + ' has comments');
    for (const section of sections) {
      const lines = section.text.trim().split('\n');
      if (section.heading.startsWith('(')) {
        assert.ok(/^\(\S+\)$/.test(section.heading), file + ': an approval comment names the login: ### comment (login)');
        assert.ok(lines.join('\n') === 'approved' || lines[0].startsWith('approved, with changes:'), file + ': an approval is exactly "approved" or "approved, with changes:" and text');
        continue;
      }
      const match = headerLine.exec(lines[0]);
      assert.ok(match, file + ': a note starts with its header line, got: ' + lines[0]);
      const required = NOTE_LINES[match[3]] ?? [];
      required.forEach((prefix, index) => assert.ok((lines[1 + index] ?? '').startsWith(prefix), file + ': ' + match[3] + ' note of ' + match[1] + ' needs the line "' + prefix + '" at line ' + (index + 2)));
      if (match[3] === 'sent' || match[3] === 'draft') {
        const approved = match[3] === 'sent' ? lines.find((line) => line.startsWith('Approved by:')) : '';
        assert.ok(match[3] === 'draft' || /^Approved by: (.+, \d{4}-\d{2}-\d{2} \d{2}:\d{2}|stage 2, routine|stage 3)$/.test(approved), file + ': Approved by line is a name and a time');
      }
      if (match[3] === 'next-step') assert.ok(/^On: (\d{4}-\d{2}-\d{2}|none)$/.test(lines[2]), file + ': next-step On: is a date or none');
    }
  }
});

test('the example keeps the headings of the template, in the same order, for every rule file and every knowledge file', () => {
  const headings = (file) => read(file).replace(/\r\n/g, '\n').split('\n').filter((line) => /^#{1,3} /.test(line)).slice(1);
  const pairs = [];
  for (let n = 1; n <= 8; n += 1) {
    const name = fs.readdirSync(path.join(ROOT, 'rules')).find((file) => file.startsWith(`0${n}-`));
    pairs.push([`rules/${name}`, `examples/northstar/rules/${name}`]);
  }
  for (const name of ['plans-and-prices.md', 'faq.md', 'objections.md', 'have-and-do-not-have.md']) pairs.push([`knowledge/${name}`, `examples/northstar/knowledge/${name}`]);
  for (const [template, example] of pairs) {
    assert.deepEqual(headings(example), headings(template), `${example} must have the headings of ${template}, in the same order`);
  }
  for (const name of ['plans-and-prices.md', 'faq.md', 'objections.md', 'have-and-do-not-have.md']) {
    const lines = read(`examples/northstar/knowledge/${name}`).split('\n');
    assert.ok(lines.some((line) => /^Source: ./.test(line)), `${name} has a Source line`);
    assert.ok(lines.some((line) => /^Last checked: \d{4}-\d{2}-\d{2}/.test(line)), `${name} has a Last checked line`);
  }
});

test('the Parked sample card carries an On: date on its latest next-step note', () => {
  const text = fs.readFileSync(path.join(ROOT, 'examples/northstar/cards/06-prairie-comfort-heating.md'), 'utf8');
  const steps = [...text.matchAll(/· AI agent · next-step\*\*\n(?:Do: .*\n)On: (.*)\n/g)];
  assert.ok(steps.length >= 1);
  assert.equal(steps[steps.length - 1][1], '2026-06-01');
});

test('.env.example names every variable once, and .gitignore keeps keys, the switch and the alarms out of git', () => {
  const wanted = ['GITHUB_REPO', 'GITHUB_APP_ID', 'GITHUB_APP_INSTALLATION_ID', 'GITHUB_APP_PRIVATE_KEY_PATH', 'APOLLO_API_KEY', 'ZEROBOUNCE_API_KEY', 'SMARTLEAD_API_KEY', 'EXPLEE_API_KEY', 'MAILBOX_PROVIDER', 'UNIPILE_DSN', 'UNIPILE_API_KEY', 'UNIPILE_ACCOUNT_ID', 'CRM', 'HUBSPOT_TOKEN', 'PIPEDRIVE_API_TOKEN', 'PIPEDRIVE_DOMAIN', 'CALENDLY_TOKEN', 'SHORTIO_API_KEY', 'SHORTIO_DOMAIN', 'SLACK_BOT_TOKEN', 'SLACK_CHANNEL_CARDS', 'SLACK_CHANNEL_ALARMS', 'SLACK_CHANNEL_APPROVALS', 'SIGNUP_WEBHOOK_SECRET', 'SIGNUP_NOTIFICATION_MAILBOX', 'DRY_RUN'];
  const lines = read('.env.example').split(/\r?\n/);
  for (const name of wanted) assert.equal(lines.filter((line) => line.startsWith(`${name}=`)).length, 1, name);
  assert.ok(lines.some((line) => line.trim() === 'DRY_RUN=1'));
  const ignore = read('.gitignore').split(/\r?\n/).map((line) => line.trim());
  for (const entry of ['.env', 'SENDING_ON', 'alarms/*.md', 'node_modules/']) assert.ok(ignore.includes(entry), `.gitignore has ${entry}`);
  assert.ok(ignore.some((line) => line.startsWith('runs/')), '.gitignore has runs/');
});

// ---------------------------------------------------------------------------
// The whole repository: no forbidden word, no key, no real address, no em dash, no emoji
// ---------------------------------------------------------------------------

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function textFiles() {
  const files = [];
  for (const file of walk(ROOT)) {
    const relative = path.relative(ROOT, file);
    if (/^(runs|alarms)[\\/]/.test(relative) && !relative.endsWith('.gitkeep')) continue;
    const buffer = fs.readFileSync(file);
    if (buffer.includes(0)) continue;
    files.push({ relative, text: buffer.toString('utf8') });
  }
  return files;
}

// The words that must never appear in a copy of this template (names of a real employer, its product,
// its servers, its customers) are NOT kept in this public file. They live in a local file that git ignores:
// scripts/.forbidden.local.txt, one word per line, matched without regard to case. Or point the variable
// FORBIDDEN_WORDS_FILE at a file of your own. When no file is found, this test says so and skips.
const FORBIDDEN_FILE = process.env.FORBIDDEN_WORDS_FILE || path.join(ROOT, 'scripts', '.forbidden.local.txt');
const LOCAL_ONLY = path.relative(ROOT, FORBIDDEN_FILE);

function forbiddenWords() {
  if (!fs.existsSync(FORBIDDEN_FILE)) return null;
  return fs.readFileSync(FORBIDDEN_FILE, 'utf8').split(/\r?\n/).map((line) => line.trim().toLowerCase()).filter((line) => line && !line.startsWith('#'));
}

test('no word from the local forbidden list anywhere in the repository', () => {
  const words = forbiddenWords();
  if (!words) {
    console.log('      (skipped: no scripts/.forbidden.local.txt and no FORBIDDEN_WORDS_FILE)');
    return;
  }
  const hits = [];
  for (const { relative, text } of textFiles()) {
    if (relative === LOCAL_ONLY) continue;
    const lower = text.toLowerCase();
    for (const word of words) {
      const index = lower.indexOf(word);
      if (index !== -1) hits.push(`${relative}: "${word}" near "${text.slice(Math.max(0, index - 20), index + word.length + 20).replace(/\s+/g, ' ')}"`);
    }
  }
  assert.deepEqual(hits, [], `forbidden words found:\n${hits.join('\n')}`);
});

// Shapes of real keys. A value that looks like one must never be in the repository.
const KEY_SHAPES = [
  /\bghp_[A-Za-z0-9]{30,}/, /\bgithub_pat_[A-Za-z0-9_]{30,}/, /\bxox[abp]-[A-Za-z0-9-]{10,}/, /\bsk-[A-Za-z0-9_-]{24,}/,
  /\bAKIA[0-9A-Z]{16}\b/, /-----BEGIN [A-Z ]*PRIVATE KEY-----\s*[A-Za-z0-9+\/=]{40,}/,
];

test('no key-shaped string anywhere in the repository', () => {
  const hits = [];
  for (const { relative, text } of textFiles()) {
    for (const shape of KEY_SHAPES) if (shape.test(text)) hits.push(`${relative}: ${shape}`);
  }
  assert.deepEqual(hits, [], hits.join('\n'));
});

test('every email address is on a reserved .example domain, or is a free-mail domain from the fixed list', () => {
  const hits = [];
  for (const { relative, text } of textFiles()) {
    for (const [, host] of text.matchAll(/[A-Z0-9._%+-]+@([A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,})/gi)) {
      const domain = host.toLowerCase();
      if (/\.example$/.test(domain) || domain === 'example.com' || FREE_MAIL.has(domain)) continue;
      hits.push(`${relative}: ${domain}`);
    }
  }
  assert.deepEqual(hits, [], `real-looking domains in addresses:\n${hits.join('\n')}`);
});

test('no em dash and no emoji in any file of the repository', () => {
  const hits = [];
  for (const { relative, text } of textFiles()) {
    if (text.includes('\u2014')) hits.push(`${relative}: em dash`);
    if (/\p{Extended_Pictographic}/u.test(text)) hits.push(`${relative}: emoji`);
  }
  assert.deepEqual(hits, [], hits.join('\n'));
});

// ---------------------------------------------------------------------------

let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok    ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${String(error.message).split('\n').join('\n      ')}`);
  }
}
console.log('');
console.log(failed === 0 ? `All ${tests.length} tests passed.` : `${failed} of ${tests.length} tests failed.`);
process.exit(failed === 0 ? 0 : 1);
