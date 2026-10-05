// scripts/lib/slack.mjs
// Guide: Step 4 (the Slack app posts to two or three channels and reads nothing) and Step 6 (alarms, the report).
//
// One call: chat.postMessage with the Slack app's bot token. That token needs only the chat:write scope.
// DRY_RUN=1 prints what would be posted and posts nothing.

import { fetchJson, isDryRun, out } from './http.mjs';

// kind: 'cards' | 'alarms' | 'approvals' -> the channel id from .env, or '' when it is not set.
export function channelFor(kind, env = process.env) {
  return (env[`SLACK_CHANNEL_${String(kind).toUpperCase()}`] ?? '').trim();
}

export function slackConfigured(kind, env = process.env) {
  return Boolean((env.SLACK_BOT_TOKEN ?? '').trim() && channelFor(kind, env));
}

export async function postMessage({ kind, text }, env = process.env) {
  const channel = channelFor(kind, env);
  if (!channel) throw new Error(`SLACK_CHANNEL_${String(kind).toUpperCase()} is not set`);
  if (isDryRun(env)) {
    out(`[dry run] would post to the Slack ${kind} channel (${text.split('\n')[0]})`);
    return { ok: true, dryRun: true };
  }
  const token = (env.SLACK_BOT_TOKEN ?? '').trim();
  if (!token) throw new Error('SLACK_BOT_TOKEN is not set');
  const answer = await fetchJson('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    vendor: 'Slack',
    headers: { Authorization: `Bearer ${token}` },
    json: { channel, text, unfurl_links: false },
  });
  // Slack answers HTTP 200 with ok:false when something is wrong, for example "channel_not_found".
  if (!answer?.ok) throw new Error(`Slack refused the message: ${answer?.error ?? 'no reason given'}`);
  return { ok: true, ts: answer.ts };
}
