// scripts/lib/adapters/explee.mjs
// Guide: Step 4 (all-in-one outbound, setup 2) and Step 6 (the daily check reads explee's inbox).
//
// Reads replies from explee. The guide uses explee's mailboxes and sending, not its own AI replies.
//
// This adapter does not invent an address. explee's API shape was not available when this template was
// written, so the live call is left as two clearly marked places for you to fill in:
//   1. Open explee's API documentation and find the base address and the call that lists the replies in your account.
//   2. Put them in BASE and REPLIES_PATH below, and adjust toReply() to the fields that call returns.
// Until both are filled, a live run stops with a clear message, and the daily check exits with code 3
// ("could not run"), which raises an alarm instead of passing silently.
//
// DRY_RUN=1 returns the replies with source "explee" from scripts/fixtures/replies.json (none in the sample).
// Every reply comes back in one shape: { id, source, campaign, from_email, from_name, subject, body, received_at }.

import { fetchJson, isDryRun } from '../http.mjs';
import { loadFixture } from '../settings.mjs';

const BASE = null; // check the vendor docs: the base address of the explee API
const REPLIES_PATH = null; // check the vendor docs: the path of the call that lists replies

// Map one item of explee's answer to the shared shape. Adjust the field names to what the vendor returns.
function toReply(item) {
  return {
    id: String(item.id),
    source: 'explee',
    campaign: item.campaign ?? '',
    from_email: item.from_email ?? item.email ?? '',
    from_name: item.from_name ?? '',
    subject: item.subject ?? '',
    body: item.body ?? '',
    received_at: new Date(item.received_at ?? item.date).toISOString(),
  };
}

export async function listReplies({ since }) {
  if (isDryRun()) {
    return loadFixture('replies.json')
      .replies.filter((reply) => reply.source === 'explee' && new Date(reply.received_at) >= since)
      .map((reply) => ({ ...reply }));
  }
  const key = (process.env.EXPLEE_API_KEY ?? '').trim();
  if (!key) throw new Error('EXPLEE_API_KEY is not set');
  if (!BASE || !REPLIES_PATH) {
    throw new Error('the explee reply call is not filled in: open scripts/lib/adapters/explee.mjs and set BASE and REPLIES_PATH (check the vendor docs)');
  }
  const answer = await fetchJson(`${BASE}${REPLIES_PATH}`, {
    vendor: 'explee',
    headers: { Authorization: `Bearer ${key}` }, // check the vendor docs: the header may differ
  });
  const items = Array.isArray(answer) ? answer : (answer?.data ?? answer?.replies ?? []);
  return items.map(toReply).filter((reply) => new Date(reply.received_at) >= since);
}
