// scripts/lib/adapters/signups.mjs
// Guide: Step 4 (sign-ups and forms, setup 3). Read connections/signups.md first.
//
// Returns the trial sign-ups and form requests that arrived since a moment, in one shape:
//   { id, email, name, company, created_at, source }
// There are two ways in, and you pick one:
//   - Notification email: set SIGNUP_NOTIFICATION_MAILBOX. The adapter reads the messages sent to that address
//     through the mailbox adapter and takes the fields from lines such as "Name: ...", "Email: ...",
//     "Company: ...". If the email has no "Email:" line, the first address in it that is not the notification
//     address counts. Adjust parseNotification() to what your product's email looks like.
//   - Webhook: a small receiver (a developer writes it once) checks the signature with SIGNUP_WEBHOOK_SECRET and
//     appends one JSON object per line to runs/signups-inbox.jsonl with the fields above. This adapter only reads
//     that file. It never sees the secret and never trusts a call that did not pass the receiver.
// DRY_RUN=1 reads scripts/fixtures/signups.json.

import fs from 'node:fs';
import path from 'node:path';
import { isDryRun } from '../http.mjs';
import { findAddresses, normalizeEmail } from '../match.mjs';
import { ROOT, loadFixture } from '../settings.mjs';
import { listNotifications } from './mailbox.mjs';

export const INBOX_FILE = path.join(ROOT, 'runs', 'signups-inbox.jsonl');

// Turns one notification email into a sign-up, or null when it has no usable address.
export function parseNotification(message, notificationAddress = '') {
  const fields = {};
  for (const line of String(message.body ?? '').split(/\r?\n/)) {
    const match = /^\s*(name|email|company|source)\s*:\s*(.+?)\s*$/i.exec(line);
    if (match && !(match[1].toLowerCase() in fields)) fields[match[1].toLowerCase()] = match[2];
  }
  const own = normalizeEmail(notificationAddress);
  const email = normalizeEmail(fields.email) || findAddresses(message.body).find((address) => address !== own) || '';
  if (!email) return null;
  return {
    id: message.message_id,
    email,
    name: fields.name ?? '',
    company: fields.company ?? '',
    created_at: message.date,
    source: fields.source ?? 'trial sign-up',
  };
}

export async function listSignups({ since }) {
  if (isDryRun()) {
    return loadFixture('signups.json')
      .signups.filter((signup) => new Date(signup.created_at) >= since)
      .map((signup) => ({ ...signup }));
  }
  const address = (process.env.SIGNUP_NOTIFICATION_MAILBOX ?? '').trim();
  if (address) {
    const messages = await listNotifications({ since, to: address });
    return messages.map((message) => parseNotification(message, address)).filter(Boolean);
  }
  if (fs.existsSync(INBOX_FILE)) {
    return fs
      .readFileSync(INBOX_FILE, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
      .filter((signup) => signup.email && new Date(signup.created_at) >= since)
      .map((signup, index) => ({ id: signup.id ?? `inbox-${index}`, name: '', company: '', source: 'trial sign-up', ...signup }));
  }
  throw new Error('no sign-up feed: set SIGNUP_NOTIFICATION_MAILBOX, or have the webhook receiver append to runs/signups-inbox.jsonl (see connections/signups.md)');
}
