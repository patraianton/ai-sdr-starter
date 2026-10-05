// scripts/lib/adapters/smartlead.mjs
// Guide: Step 4 (sending service, setup 1) and Step 6 (the daily check pulls every reply from every campaign).
//
// Reads replies from Smartlead. Smartlead's API takes the key as ?api_key=KEY on every call.
// The check must cover every campaign, finished ones too, because a reply to the last email of a sequence
// can arrive after the campaign shows as completed.
//
// Calls used (see the Smartlead API docs; endpoints and field names may change, check the vendor docs):
//   GET /api/v1/campaigns/                                      all campaigns, any status
//   GET /api/v1/campaigns/{id}/leads?offset=0&limit=100         the leads of one campaign
//   GET /api/v1/campaigns/{id}/leads/{lead_id}/message-history  the thread: items typed SENT or REPLY
// A cheaper way may exist (the master inbox endpoints). Check the vendor docs before you rely on this loop
// for thousands of leads; it makes one call per lead.
//
// DRY_RUN=1 returns the replies with source "smartlead" from scripts/fixtures/replies.json.
// Every reply comes back in one shape: { id, source, campaign, from_email, from_name, subject, body, received_at }.

import { fetchJson, isDryRun } from '../http.mjs';
import { loadFixture } from '../settings.mjs';

const BASE = 'https://server.smartlead.ai/api/v1';
const PAGE = 100;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function apiUrl(path, params = {}) {
  const key = (process.env.SMARTLEAD_API_KEY ?? '').trim();
  if (!key) throw new Error('SMARTLEAD_API_KEY is not set');
  const query = new URLSearchParams({ api_key: key, ...params });
  return `${BASE}${path}?${query}`;
}

const call = (path, params) => fetchJson(apiUrl(path, params), { vendor: 'Smartlead' });

export async function listCampaigns() {
  if (isDryRun()) {
    const names = new Set(loadFixture('replies.json').replies.filter((r) => r.source === 'smartlead').map((r) => r.campaign));
    return [...names].map((name, index) => ({ id: index + 1, name, status: 'ACTIVE' }));
  }
  const campaigns = await call('/campaigns/');
  return Array.isArray(campaigns) ? campaigns : [];
}

// Every reply received at or after `since` (a Date), across all campaigns.
export async function listReplies({ since }) {
  if (isDryRun()) {
    return loadFixture('replies.json')
      .replies.filter((reply) => reply.source === 'smartlead' && new Date(reply.received_at) >= since)
      .map((reply) => ({ ...reply }));
  }
  const replies = [];
  for (const campaign of await listCampaigns()) {
    for (let offset = 0; ; offset += PAGE) {
      const page = await call(`/campaigns/${campaign.id}/leads`, { offset, limit: PAGE });
      const rows = page?.data ?? [];
      for (const row of rows) {
        const lead = row.lead ?? row;
        if (!lead?.id || !lead.email) continue;
        const thread = await call(`/campaigns/${campaign.id}/leads/${lead.id}/message-history`);
        for (const item of thread?.history ?? []) {
          if (item.type !== 'REPLY' || new Date(item.time) < since) continue;
          replies.push({
            id: String(item.message_id ?? `${campaign.id}-${lead.id}-${item.stats_id ?? item.time}`),
            source: 'smartlead',
            campaign: campaign.name,
            from_email: item.from || lead.email,
            from_name: [lead.first_name, lead.last_name].filter(Boolean).join(' '),
            subject: item.subject ?? '',
            body: item.email_body ?? '',
            received_at: new Date(item.time).toISOString(),
          });
        }
        await sleep(250); // stay under Smartlead's request limit
      }
      if (rows.length < PAGE) break;
    }
  }
  return replies;
}
