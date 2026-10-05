// scripts/lib/adapters/mailbox.mjs
// Guide: Step 4 (a mailbox for sign-ups, setup 3), Step 5 (the one rule: has our person written to this
// company?) and Step 6 (the daily check reads the mailbox).
//
// Reads and sends email in the sales rep's or a shared company mailbox on Google Workspace or Microsoft 365.
// Only MAILBOX_PROVIDER=unipile is wired here: Unipile is a connector for Gmail and Outlook accounts and one
// API covers both. Reading a Google or Microsoft mailbox directly needs an OAuth app that a developer sets up
// once; those two providers stop with a clear message until that is done (check the vendor docs).
//
// Calls used (Unipile API; check the vendor docs, field names may change):
//   GET  https://{UNIPILE_DSN}/api/v1/emails?account_id=...&role=inbox|sent&after=...&limit=...&cursor=...
//   POST https://{UNIPILE_DSN}/api/v1/emails            (sends; the body is a form, see sendEmail)
// Header on every call: X-API-KEY.
//
// DRY_RUN=1 reads scripts/fixtures/replies.json: replies with source "mailbox" and the list "mailbox_messages".
// Messages come back in one shape:
//   { message_id, direction: 'received' | 'sent', from_email, from_name, to_emails, subject, body, date, in_reply_to }
// in_reply_to is the id of the message this one answers, or null (check the vendor docs for the field name).

import { fetchJson, isDryRun } from '../http.mjs';
import { normalizeEmail, companyDomain } from '../match.mjs';
import { loadFixture } from '../settings.mjs';

function config() {
  const provider = (process.env.MAILBOX_PROVIDER ?? '').trim().toLowerCase();
  if (provider !== 'unipile') {
    throw new Error(
      provider === 'google' || provider === 'microsoft'
        ? `MAILBOX_PROVIDER=${provider} needs a developer to set up the provider's API once (check the vendor docs); this template reads mail through Unipile`
        : 'MAILBOX_PROVIDER is not set (use unipile)',
    );
  }
  const dsn = (process.env.UNIPILE_DSN ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const key = (process.env.UNIPILE_API_KEY ?? '').trim();
  const account = (process.env.UNIPILE_ACCOUNT_ID ?? '').trim();
  const missing = [['UNIPILE_DSN', dsn], ['UNIPILE_API_KEY', key], ['UNIPILE_ACCOUNT_ID', account]]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) throw new Error(`mailbox: ${missing.join(', ')} not set`);
  return { base: `https://${dsn}/api/v1`, key, account };
}

function toMessage(item, direction) {
  const to = (item.to_attendees ?? []).map((person) => normalizeEmail(person.identifier)).filter(Boolean);
  return {
    message_id: String(item.message_id ?? item.provider_id ?? item.id),
    direction,
    from_email: normalizeEmail(item.from_attendee?.identifier),
    from_name: item.from_attendee?.display_name ?? '',
    to_emails: to,
    subject: item.subject ?? '',
    body: item.body_plain ?? item.body ?? '',
    date: new Date(item.date).toISOString(),
    in_reply_to: item.in_reply_to?.message_id ? String(item.in_reply_to.message_id) : null,
  };
}

async function listFolder(role, since) {
  const { base, key, account } = config();
  const messages = [];
  let cursor = null;
  for (let page = 0; page < 50; page += 1) {
    const query = new URLSearchParams({ account_id: account, role, after: since.toISOString(), limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const answer = await fetchJson(`${base}/emails?${query}`, { vendor: 'Unipile', headers: { 'X-API-KEY': key } });
    for (const item of answer?.items ?? []) messages.push(toMessage(item, role === 'sent' ? 'sent' : 'received'));
    cursor = answer?.cursor ?? null;
    if (!cursor) break;
  }
  return messages;
}

const toReply = (message) => ({
  id: message.message_id,
  source: 'mailbox',
  campaign: '',
  from_email: message.from_email,
  from_name: message.from_name,
  subject: message.subject,
  body: message.body,
  received_at: message.date,
  in_reply_to: message.in_reply_to ?? null,
});

// Every message received since `since` (a Date), in the reply shape the daily check expects.
export async function listInbound({ since }) {
  if (isDryRun()) {
    return loadFixture('replies.json')
      .replies.filter((reply) => reply.source === 'mailbox' && new Date(reply.received_at) >= since)
      .map((reply) => ({ ...reply }));
  }
  return (await listFolder('inbox', since)).map(toReply);
}

let recentCache = null;

// Messages in both directions since `since`. Used to see whether a colleague has written to a company.
export async function listRecentMessages({ since }) {
  if (isDryRun()) {
    return loadFixture('replies.json')
      .mailbox_messages.filter((message) => new Date(message.date) >= since)
      .map((message) => ({ ...message }));
  }
  if (!recentCache || recentCache.since > since) {
    const [received, sent] = await Promise.all([listFolder('inbox', since), listFolder('sent', since)]);
    recentCache = { since, messages: [...received, ...sent] };
  }
  return recentCache.messages.filter((message) => new Date(message.date) >= since);
}

// Messages to or from anyone at this company domain. The caller removes the AI agent's own emails by message id.
export async function findMessagesWithDomain(domain, { since }) {
  const wanted = companyDomain(domain);
  const messages = await listRecentMessages({ since });
  return messages.filter((message) => {
    const people = message.direction === 'sent' ? message.to_emails : [message.from_email];
    return people.some((address) => companyDomain(address) === wanted);
  });
}

// Sign-up notification emails: the received messages addressed to the notification address.
export async function listNotifications({ since, to }) {
  if (isDryRun()) return [];
  const wanted = normalizeEmail(to);
  const inbound = await listFolder('inbox', since);
  if (!wanted) return [];
  return inbound.filter((message) => message.to_emails.includes(wanted));
}

// Sends one plain-text email from the connected mailbox. Returns { message_id }.
// Check the vendor docs: Unipile takes this call as a form, and the id it returns may differ from the
// Message-Id the inbox later lists. The scripts write on the card exactly the id returned here.
export async function sendEmail({ to, subject, body }) {
  if (isDryRun()) return { message_id: '<dry-run@local>' };
  const { base, key, account } = config();
  const form = new FormData();
  form.set('account_id', account);
  form.set('subject', subject);
  form.set('body', body);
  form.set('to', JSON.stringify([{ identifier: normalizeEmail(to) }]));
  const answer = await fetchJson(`${base}/emails`, {
    method: 'POST',
    vendor: 'Unipile',
    headers: { 'X-API-KEY': key },
    body: form,
  });
  const id = answer?.provider_id ?? answer?.tracking_id ?? answer?.id;
  if (!id) throw new Error('the mailbox accepted the email but returned no id; do not resend, check the Sent folder');
  return { message_id: String(id) };
}
