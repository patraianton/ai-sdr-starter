// scripts/lib/match.mjs
// Guide: Step 1 (checks by company domain), Step 2 (the card and its notes), Step 6 (the daily check).
//
// Pure functions, no network. They answer five questions:
//   1. Which company is this address from?                (companyDomain, isFreeMail, sameCompany)
//   2. What does a card say?                              (parseNotes, parseCard)
//   3. Which card does this reply belong to?              (matchReplyToCard, replyIsLogged)
//   4. How long has a reply waited for a person?          (workingElapsedMs, waitingOnPerson)
//   5. Who wrote what, and when was the first email sent? (firstAiEmailAt, buildAiSendIndex)
//
// Limits you should know:
//   - companyDomain() cuts an address down to the company domain with a short list of two-part
//     endings (co.uk, com.au and so on). A rare ending that is not on the list keeps one label too few.
//   - The free-mail list is short and covers the common providers in the US and Canada. Add yours.
//   - Times written in notes have no zone. They are read in the zone from rules/settings.yml
//     (email.timezone), or in UTC when it is empty.

// ---------------------------------------------------------------------------
// Addresses and domains
// ---------------------------------------------------------------------------

export const FREE_MAIL = new Set([
  'freemail.example', 'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.ca', 'ymail.com', 'hotmail.com', 'hotmail.ca',
  'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'mail.com', 'zoho.com',
  'yandex.com', 'fastmail.com', 'hey.com', 'comcast.net', 'verizon.net', 'att.net',
  'sbcglobal.net', 'bellsouth.net', 'cox.net', 'charter.net', 'earthlink.net',
  'shaw.ca', 'rogers.com', 'sympatico.ca', 'bell.net', 'telus.net', 'videotron.ca',
]);

// Endings made of two labels. A company domain under one of them keeps three labels.
const TWO_PART_ENDINGS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.za', 'com.br',
  'co.in', 'com.mx', 'co.jp', 'com.sg', 'on.ca', 'bc.ca', 'ab.ca', 'qc.ca', 'sk.ca', 'mb.ca',
]);

const ADDRESS = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;

// "Dana <Dana+x@Example.COM>" -> "dana@example.com". The "+tag" part is removed. Returns "" when there is no address.
export function normalizeEmail(value) {
  const text = String(value ?? '').trim();
  const bracket = /<([^<>]+)>/.exec(text);
  const candidate = (bracket ? bracket[1] : text).trim().toLowerCase();
  const match = /^([a-z0-9._%+-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})$/.exec(candidate);
  if (!match) return '';
  return `${match[1].split('+')[0]}@${match[2]}`;
}

export function findAddresses(text) {
  const found = new Set();
  for (const hit of String(text ?? '').match(ADDRESS) ?? []) {
    const address = normalizeEmail(hit);
    if (address) found.add(address);
  }
  return [...found];
}

export function emailDomain(email) {
  const address = normalizeEmail(email);
  return address ? address.split('@')[1] : '';
}

// "mail.eu.blueridgehvac.example" -> "blueridgehvac.example". Accepts an address, a domain or a URL.
export function companyDomain(value) {
  let text = String(value ?? '').trim().toLowerCase();
  if (!text) return '';
  if (text.includes('@')) text = text.split('@').pop();
  text = text.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(text)) return '';
  const labels = text.split('.');
  if (labels.length <= 2) return text;
  const lastTwo = labels.slice(-2).join('.');
  return TWO_PART_ENDINGS.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

export function isFreeMail(value) {
  const domain = String(value ?? '').includes('@') ? emailDomain(value) : companyDomain(value);
  return FREE_MAIL.has(domain);
}

// Two addresses are from the same company when their company domains are equal and are not a free-mail domain.
export function sameCompany(a, b) {
  const first = companyDomain(a);
  const second = companyDomain(b);
  if (!first || !second || first !== second) return false;
  return !FREE_MAIL.has(first);
}

export function stripHtml(text) {
  return String(text ?? '')
    .replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Bounces and delivery notices are not replies from a lead.
export function isSystemMessage(reply) {
  const from = normalizeEmail(reply.from_email);
  const subject = String(reply.subject ?? '').toLowerCase();
  if (/^(mailer-daemon|postmaster)@/.test(from)) return true;
  return /^(undeliverable|delivery status notification|mail delivery (failed|subsystem))/.test(subject);
}

// ---------------------------------------------------------------------------
// Time zones and working time
// ---------------------------------------------------------------------------

const formatters = new Map();

function formatterFor(tz) {
  if (!formatters.has(tz)) {
    formatters.set(
      tz,
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
      }),
    );
  }
  return formatters.get(tz);
}

// The wall-clock parts of an instant in a zone: { year, month, day, hour, minute, weekday: 'Mon' .. 'Sun' }.
export function zonedParts(date, tz = 'UTC') {
  const parts = {};
  for (const part of formatterFor(tz || 'UTC').formatToParts(date)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

// "2026-03-04", "09:12", "America/New_York" -> the instant (a Date) at that wall-clock time.
export function zonedToUtc(dateText, timeText = '00:00', tz = 'UTC') {
  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wanted;
  for (let i = 0; i < 2; i += 1) {
    const p = zonedParts(new Date(guess), tz);
    guess -= Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - wanted;
  }
  return new Date(guess);
}

export const pad2 = (n) => String(n).padStart(2, '0');

export function localDate(date, tz = 'UTC') {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function localDateTime(date, tz = 'UTC') {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

// "Thu 2026-03-12 11:00 America/New_York"
export function describeTime(date, tz = 'UTC') {
  const p = zonedParts(date, tz);
  return `${p.weekday} ${localDateTime(date, tz)} ${tz || 'UTC'}`;
}

const HOUR = 3600 * 1000;

// Milliseconds between two instants, not counting Saturday and Sunday in the zone.
export function workingElapsedMs(from, to, tz = 'UTC') {
  const end = +to;
  let t = +from;
  let total = 0;
  while (t < end) {
    const p = zonedParts(new Date(t), tz);
    const nextDay = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
    let boundary = +zonedToUtc(localDate(nextDay, 'UTC'), '00:00', tz);
    if (boundary <= t) boundary = t + HOUR;
    const stop = Math.min(boundary, end);
    if (p.weekday !== 'Sat' && p.weekday !== 'Sun') total += stop - t;
    t = stop;
  }
  return total;
}

// The waiting-time rule: a reply that waits more than one working day without a person's answer is an alarm.
export function isWaitingTooLong(since, now, tz = 'UTC') {
  return workingElapsedMs(since, now, tz) > 24 * HOUR;
}

export function formatWaited(ms) {
  const days = Math.floor(ms / (24 * HOUR));
  const hours = Math.floor((ms % (24 * HOUR)) / HOUR);
  if (days > 0) return `${days} d ${hours} h (weekends not counted)`;
  if (hours > 0) return `${hours} h`;
  return 'under 1 h';
}

// ---------------------------------------------------------------------------
// Cards and notes
// ---------------------------------------------------------------------------

// A note header: **2026-03-04 09:12 · AI agent · reply**
const NOTE_HEADER = /^\*\*(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))? · (.+?) · ([a-z-]+)\*\*[ \t]*$/;

export const AI_WRITER = 'AI agent';

// Reads every dated note in a text. Returns [{ date, time, writer, kind, at, body }] in the order written.
export function parseNotes(text, tz = 'UTC') {
  const notes = [];
  let current = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = NOTE_HEADER.exec(line);
    if (match) {
      current = {
        date: match[1],
        time: match[2] ?? '00:00',
        writer: match[3].trim(),
        kind: match[4],
        at: zonedToUtc(match[1], match[2] ?? '00:00', tz),
        lines: [],
      };
      notes.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return notes.map(({ lines, ...note }) => ({ ...note, body: lines.join('\n').replace(/(\n|^)\s*---\s*$/, '').trim() }));
}

function tableRows(headerText) {
  const rows = [];
  for (const line of headerText.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    if (/^[\s|:-]+$/.test(line)) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
    rows.push(cells);
  }
  return rows;
}

// Reads the header table of a card into { field name in lower case: value }.
// Both layouts work: one row per field ("| Domain | x |") or a header row over a value row.
export function parseHeaderFields(headerText) {
  const rows = tableRows(headerText);
  const fields = {};
  if (rows.length === 0) return fields;
  const lowered = rows[0].map((cell) => cell.toLowerCase());
  if (rows.length >= 2 && lowered.includes('company') && lowered.includes('domain') && rows[0].length >= 4) {
    lowered.forEach((name, index) => {
      fields[name] = rows[1][index] ?? '';
    });
    return fields;
  }
  for (const [name, ...rest] of rows) {
    if (name.toLowerCase() === 'field') continue;
    fields[name.toLowerCase()] = rest.join(' | ').trim();
  }
  return fields;
}

const labelNames = (labels) => (labels ?? []).map((label) => (typeof label === 'string' ? label : label.name));

// raw: { number, title, state, labels, url, body, comments: [{ body, created_at }] }
// Returns the same card with parsed parts added: company, domain, domains, contacts, addresses, setup, notes.
export function parseCard(raw, tz = 'UTC') {
  const body = String(raw.body ?? '');
  const titleMatch = /^(.*?)\s*\(([^()\s]+)\)\s*$/.exec(String(raw.title ?? '').trim());
  const firstNote = body.search(/^\*\*\d{4}-\d{2}-\d{2}.* · [a-z-]+\*\*\s*$/m);
  const separator = body.search(/^---\s*$/m);
  const cut = [separator, firstNote].filter((index) => index >= 0);
  const headerText = cut.length ? body.slice(0, Math.min(...cut)) : body;
  const fields = parseHeaderFields(headerText);

  const notes = [
    ...parseNotes(body, tz),
    ...(raw.comments ?? []).flatMap((comment) => parseNotes(comment.body, tz)),
  ].sort((a, b) => a.at - b.at);

  const domain = companyDomain(titleMatch ? titleMatch[2] : fields.domain);
  const contacts = findAddresses(headerText);
  const addresses = new Set(contacts);
  for (const note of notes) {
    if (note.kind !== 'reply') continue;
    for (const line of note.body.split('\n')) {
      if (/^from:/i.test(line)) findAddresses(line).forEach((address) => addresses.add(address));
    }
  }
  const domains = new Set();
  if (domain && !FREE_MAIL.has(domain)) domains.add(domain);
  for (const address of contacts) {
    const found = companyDomain(address);
    if (found && !FREE_MAIL.has(found)) domains.add(found);
  }
  // One contact per line in the header: "Name, email, title".
  const contactList = String(fields.contacts ?? '')
    .split(/<br\s*\/?>|\n/i)
    .map((line) => line.split(',').map((part) => part.trim()))
    .filter((parts) => parts[0])
    .map(([name, email = '', title = '']) => ({ name, email: normalizeEmail(email), title }));
  const contactNames = contactList.map((person) => person.name.toLowerCase()).filter((name) => !name.includes('@'));
  return {
    ...raw,
    labels: labelNames(raw.labels),
    company: titleMatch ? titleMatch[1].trim() : String(raw.title ?? '').trim(),
    domain,
    domains,
    contacts,
    contactList,
    contactNames,
    addresses,
    fields,
    setup: Number.parseInt(fields['setup (1/2/3)'] ?? fields.setup ?? '', 10) || null,
    notes,
  };
}

export const lastNote = (card, kind) => [...card.notes].reverse().find((note) => note.kind === kind) ?? null;

export const hasLabel = (card, name) => card.labels.includes(name);

// When the AI agent sent its first email to this company. Null when it never did.
export function firstAiEmailAt(card) {
  const sent = card.notes.find((note) => note.kind === 'sent' && note.writer === AI_WRITER);
  return sent ? sent.at : null;
}

// How to tell the AI agent's emails from a colleague's emails in the same mailbox (setup 3: the AI agent writes
// from the sales rep's mailbox). Every email the AI agent sends has a "sent" note on a card with the recipient
// in a "To:" line and the time. A message to that recipient within 15 minutes of that note is the AI agent's.
// A "Message-Id:" line in the note, when there is one, matches exactly.
// "subjects" holds the subject of every email the AI agent sent (without Re: and Fwd:), so an inbound message in the
// shared mailbox can be told apart from a newsletter: see answersAiSend().
export function buildAiSendIndex(cards) {
  const ids = new Set();
  const subjects = new Set();
  const sends = [];
  for (const card of cards) {
    for (const note of card.notes) {
      if (note.kind !== 'sent' || note.writer !== AI_WRITER) continue;
      for (const match of note.body.matchAll(/^Message-Id:\s*(.+)$/gim)) ids.add(match[1].trim());
      for (const match of note.body.matchAll(/^Subject:\s*(.+)$/gim)) {
        const subject = normalizeSubject(match[1]);
        if (subject) subjects.add(subject);
      }
      const to = new Set();
      for (const line of note.body.split('\n')) {
        if (/^to:/i.test(line)) findAddresses(line).forEach((address) => to.add(address));
      }
      if (to.size) sends.push({ to, at: note.at });
    }
  }
  return { ids, sends, subjects };
}

// "RE: Re: Dispatch scheduling" -> "dispatch scheduling". Leading Re:, Fw: and Fwd: are removed, case and spacing ignored.
export function normalizeSubject(subject) {
  return String(subject ?? '').replace(/^(\s*(re|fwd?)\s*:\s*)+/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

// An inbound message in the mailbox that has no card by address or domain counts as a lead's reply only when it
// answers something the AI agent sent: its in-reply-to id is a recorded send, or its subject is the subject of a "sent" note.
// Newsletters, internal mail and vendor mail match neither, so they raise no alarm.
export function answersAiSend(reply, index) {
  if (reply.in_reply_to && index.ids.has(String(reply.in_reply_to).trim())) return true;
  const subject = normalizeSubject(reply.subject);
  return Boolean(subject) && index.subjects.has(subject);
}

// message: { message_id, direction, to_emails, date }
export function isAiMessage(message, index) {
  if (index.ids.has(message.message_id)) return true;
  if (message.direction !== 'sent') return false;
  const when = new Date(message.date);
  const to = (message.to_emails ?? []).map(normalizeEmail);
  return index.sends.some((send) => Math.abs(send.at - when) <= 15 * 60 * 1000 && to.some((address) => send.to.has(address)));
}

// Anyone on your side who wrote a note on the card is a person in the thread, with three exceptions. These notes
// answer the AI agent, not the lead (rules/02-what-to-check.md):
//   1. the approver's note that begins with "approved" (an approval that was written as a note, not as a comment),
//   2. the call host's note after a booking note is on the card (what happened on the call),
//   3. a person's note after a handover note that was addressed to that person (the answer to the AI agent).
// settings is optional: without the approver's and the host's names, only exception 3 applies.
export function personNoteOn(card, settings = {}) {
  const same = (a, b) => Boolean(a) && Boolean(b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  const approver = settings.approval?.approver;
  const host = settings.approval?.call_host;
  return (
    card.notes.find((note) => {
      if (note.writer === AI_WRITER) return false;
      if (same(note.writer, approver) && /^approved\b/i.test(note.body.trim())) return false;
      const earlier = card.notes.filter((other) => other.at < note.at);
      if (same(note.writer, host) && earlier.some((other) => other.kind === 'booking')) return false;
      if (earlier.some((other) => other.kind === 'handover' && same(handoverPerson(other), note.writer))) return false;
      return true;
    }) ?? null
  );
}

// ---------------------------------------------------------------------------
// Matching a reply to a card
// ---------------------------------------------------------------------------

// Lower case, one space between words, and no "> " quote marks (a reply on a card is often written as a quote).
const squash = (text) => String(text ?? '').replace(/^[ 	]*>+[ 	]?/gm, '').toLowerCase().replace(/\s+/g, ' ').trim();

function preferOpen(cards) {
  return [...cards].sort((a, b) => (a.state === 'open' ? 0 : 1) - (b.state === 'open' ? 0 : 1) || a.number - b.number)[0];
}

// By address first, then by company domain. A free-mail address matches only by address.
// Returns { card, by: 'address' | 'domain' | null }.
export function matchReplyToCard(reply, cards) {
  const email = normalizeEmail(reply.from_email);
  if (!email) return { card: null, by: null };
  const byAddress = cards.filter((card) => card.addresses.has(email));
  if (byAddress.length) return { card: preferOpen(byAddress), by: 'address' };
  const domain = companyDomain(email);
  if (!domain || FREE_MAIL.has(domain)) return { card: null, by: null };
  const byDomain = cards.filter((card) => card.domains.has(domain));
  if (byDomain.length) return { card: preferOpen(byDomain), by: 'domain' };
  return { card: null, by: null };
}

// A booking matches by the invitee's address, then by company domain, then by the invitee's name.
// Returns { card, by: 'address' | 'domain' | 'name' | null }.
export function matchBookingToCard(booking, cards) {
  const found = matchReplyToCard({ from_email: booking.invitee_email }, cards);
  if (found.card) return found;
  const name = String(booking.invitee_name ?? '').trim().toLowerCase();
  if (name) {
    const byName = cards.filter((card) => card.contactNames.includes(name));
    if (byName.length === 1) return { card: byName[0], by: 'name' };
  }
  return { card: null, by: null };
}

// A reply is logged when a note of kind "reply" on the card holds its words (or its id).
// The first 40 characters of the reply are compared, ignoring case and spacing.
export function replyIsLogged(reply, card) {
  const snippet = squash(stripHtml(reply.body)).slice(0, 40);
  const email = normalizeEmail(reply.from_email);
  const received = reply.received_at ? new Date(reply.received_at) : null;
  return card.notes.some((note) => {
    if (note.kind !== 'reply') return false;
    const text = squash(note.body);
    if (reply.id && text.includes(squash(reply.id))) return true;
    if (snippet) return text.includes(snippet);
    const close = received && Math.abs(note.at - received) < 36 * HOUR;
    return Boolean(close && email && text.includes(email));
  });
}

// ---------------------------------------------------------------------------
// Bookings and calls
// ---------------------------------------------------------------------------

// Only a booking made after the AI agent's first email to that company is the AI agent's work.
export function isAttributedBooking(booking, card) {
  const first = firstAiEmailAt(card);
  return Boolean(first) && new Date(booking.created_at) > first;
}

// A call counts as held only when the card says so: the label "Call held" or a note of kind "call-held".
export function callConfirmed(card) {
  return hasLabel(card, 'Call held') || card.notes.some((note) => note.kind === 'call-held');
}

// 'held' | 'upcoming' | 'unconfirmed' (ended, within one working day, no note yet) | 'no-show' (ended, no note, over one working day)
export function callStatus(booking, card, now, tz = 'UTC') {
  if (callConfirmed(card)) return 'held';
  const end = new Date(booking.end_time);
  if (end > now) return 'upcoming';
  return isWaitingTooLong(end, now, tz) ? 'no-show' : 'unconfirmed';
}

// ---------------------------------------------------------------------------
// Who a reply is waiting on
// ---------------------------------------------------------------------------

const NOT_WAITING_A = ['Do not write', 'Our person is in the thread', 'No fit', 'Parked', 'Booked', 'Call held', 'Sent, waiting'];

// The person a handover note is addressed to: the "To:" line, as board/note-shapes.md writes it ("To: Dana Reyes").
// An older free-text note that opens with "To Dana Reyes, who hosts ..." is read too.
export function handoverPerson(note) {
  if (!note) return '';
  for (const line of note.body.split('\n')) {
    const match = /^To:?\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)?)/.exec(line.trim());
    if (match) return match[1];
  }
  return '';
}

// The last handover note, when it is still open: no later note by a person, no later email from the AI agent,
// and no later call-held note. A handover that nobody answered is a wait, whatever the status label says.
function openHandover(card) {
  const handover = lastNote(card, 'handover');
  if (!handover) return null;
  const closed = card.notes.some(
    (note) => note.at > handover.at && (note.writer !== AI_WRITER || note.kind === 'sent' || note.kind === 'call-held'),
  );
  return closed ? null : handover;
}

// On these labels a handover is not a wait for an answer: the card is closed, parked, or the sales rep has the call.
const HANDOVER_IS_NOT_A_WAIT = ['No fit', 'Parked', 'Booked', 'Call held'];

// Cards where a reply waits on a person. Returns { person, since, waitedMs, why } or null.
//   A. The label "Draft ready": the approver at stage 1, the answerer of the waiting list at stage 2.
//   B. The label "Our person is in the thread" and a reply that no AI email and no person's note followed:
//      it waits on the person the last handover note names.
//   C. Any other card (label "New reply", "Do not write", "Sent, waiting") whose last handover note is still open:
//      the AI agent handed a question to a person and nobody has answered. The person is the one on the
//      handover "To:" line, then approval.waiting_list_answerer, then approval.call_host.
// "now" is a Date. A person's answer outside the card (an email from the sales rep) is checked by the caller.
export function waitingOnPerson(card, settings, now) {
  if (card.state !== 'open') return null;
  const tz = settings.email?.timezone || 'UTC';
  const approval = settings.approval ?? {};
  const unnamed = 'nobody (no name is written in rules/settings.yml)';
  const reply = lastNote(card, 'reply');
  const sent = lastNote(card, 'sent');

  if (hasLabel(card, 'Draft ready')) {
    if (card.labels.some((label) => NOT_WAITING_A.includes(label))) return null;
    const draft = lastNote(card, 'draft');
    const since = reply && (!sent || reply.at > sent.at) ? reply.at : draft?.at;
    if (!since) return null;
    const named = approval.stage === 1 ? approval.approver : approval.waiting_list_answerer || approval.approver;
    return { person: named || unnamed, since, waitedMs: workingElapsedMs(since, now, tz), why: 'draft' };
  }

  if (hasLabel(card, 'Our person is in the thread') && reply) {
    const answered = card.notes.some((note) => note.at > reply.at && (note.kind === 'sent' || note.writer !== AI_WRITER));
    if (answered) return null;
    const person = handoverPerson(lastNote(card, 'handover')) || approval.call_host || unnamed;
    return { person, since: reply.at, waitedMs: workingElapsedMs(reply.at, now, tz), why: 'our-person' };
  }

  if (!card.labels.some((label) => HANDOVER_IS_NOT_A_WAIT.includes(label))) {
    const handover = openHandover(card);
    if (handover) {
      const person = handoverPerson(handover) || approval.waiting_list_answerer || approval.call_host || unnamed;
      return { person, since: handover.at, waitedMs: workingElapsedMs(handover.at, now, tz), why: 'handover' };
    }
  }
  return null;
}

// Every card where a reply waits on a person, longest wait first: [{ card, wait }].
// mailboxMessages (optional): mail in both directions. A card that waits on a person (not on an approval) is
// answered when a colleague (not the AI agent) sent mail to that company after the wait began, even if no note says so.
export function waitingList(cards, settings, now, mailboxMessages = null) {
  const index = buildAiSendIndex(cards);
  const personSent = (mailboxMessages ?? []).filter((message) => message.direction === 'sent' && !isAiMessage(message, index));
  return cards
    .map((card) => ({ card, wait: waitingOnPerson(card, settings, now) }))
    .filter(({ card, wait }) => {
      if (!wait) return false;
      if (wait.why === 'draft') return true;
      const answered = personSent.some(
        (message) =>
          new Date(message.date) > wait.since && (message.to_emails ?? []).some((address) => card.domains.has(companyDomain(address))),
      );
      return !answered;
    })
    .sort((a, b) => b.wait.waitedMs - a.wait.waitedMs);
}
