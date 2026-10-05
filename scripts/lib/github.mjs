// scripts/lib/github.mjs
// Guide: Step 2 (the board: one card per company on GitHub Issues, the labels, the AI agent's identity).
//
// Small helpers over the GitHub REST API: labels, cards (issues) and comments.
// Sign-in, in this order: GITHUB_TOKEN (or GH_TOKEN), then the GitHub App from .env (gh-app-token.mjs).
// DRY_RUN=1 reads cards and labels from scripts/fixtures/cards.json, and every write only prints what it would do.
// Pull requests are never cards. A card is an issue.

import { appSettingsFromEnv, getInstallationToken } from '../gh-app-token.mjs';
import { fetchJson, isDryRun, out } from './http.mjs';
import { companyDomain } from './match.mjs';
import { loadFixture } from './settings.mjs';

const API = 'https://api.github.com';
let cachedToken = null;

export function repoSlug(env = process.env) {
  const slug = (env.GITHUB_REPO ?? '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(slug)) {
    throw new Error('GITHUB_REPO must look like owner/name (set it in .env)');
  }
  return slug;
}

async function authToken(env = process.env) {
  if (env.GITHUB_TOKEN || env.GH_TOKEN) return env.GITHUB_TOKEN || env.GH_TOKEN;
  if (cachedToken && cachedToken.expires > Date.now() + 60000) return cachedToken.token;
  const app = appSettingsFromEnv(env);
  if (app.missing) {
    throw new Error(`no GitHub sign-in: set GITHUB_TOKEN, or ${app.missing.join(', ')} for the GitHub App`);
  }
  const { token, expiresAt } = await getInstallationToken(app);
  cachedToken = { token, expires: Date.parse(expiresAt) || Date.now() + 50 * 60000 };
  return token;
}

async function gh(path, { method = 'GET', json } = {}) {
  const token = await authToken();
  return fetchJson(`${API}${path}`, {
    method,
    json,
    vendor: 'GitHub',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ai-sdr-starter',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
}

async function pages(path) {
  const all = [];
  const joiner = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= 50; page += 1) {
    const items = await gh(`${path}${joiner}per_page=100&page=${page}`);
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

const dryNote = (text) => out(`[dry run] would ${text}`);
const clone = (value) => JSON.parse(JSON.stringify(value));

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

// True when .env names a real repository and has a way to sign in (a token, or the three GitHub App lines).
export function githubConfigured(env = process.env) {
  const slug = (env.GITHUB_REPO ?? '').trim();
  if (!slug || slug === 'owner/name') return false;
  const token = Boolean(env.GITHUB_TOKEN || env.GH_TOKEN);
  const app = Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_INSTALLATION_ID && env.GITHUB_APP_PRIVATE_KEY_PATH);
  return token || app;
}

// listLabels({ live: true }) reads the real repository even in a dry run. Reading changes nothing.
export async function listLabels({ live = !isDryRun() } = {}) {
  if (!live) return clone(loadFixture('cards.json').repo_labels);
  const slug = repoSlug();
  const labels = await pages(`/repos/${slug}/labels`);
  return labels.map((label) => ({ name: label.name, color: label.color, description: label.description ?? '' }));
}

export async function createLabel({ name, color, description }) {
  if (isDryRun()) return dryNote(`create the label "${name}" (${color})`);
  return gh(`/repos/${repoSlug()}/labels`, { method: 'POST', json: { name, color, description } });
}

export async function updateLabel({ name, color, description }) {
  if (isDryRun()) return dryNote(`update the label "${name}" (${color})`);
  return gh(`/repos/${repoSlug()}/labels/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    json: { new_name: name, color, description },
  });
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function normalizeIssue(issue, comments) {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    labels: (issue.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name)),
    url: issue.html_url,
    body: issue.body ?? '',
    comments: comments.map((comment) => ({ body: comment.body ?? '', created_at: comment.created_at })),
  };
}

// Every card, open and closed, with its comments. Returns plain objects (parse them with match.parseCard).
export async function listCards({ state = 'all' } = {}) {
  if (isDryRun()) {
    return clone(loadFixture('cards.json').cards).filter((card) => state === 'all' || card.state === state);
  }
  const slug = repoSlug();
  const issues = (await pages(`/repos/${slug}/issues?state=${state}`)).filter((issue) => !issue.pull_request);
  const cards = [];
  for (const issue of issues) {
    const comments = issue.comments > 0 ? await pages(`/repos/${slug}/issues/${issue.number}/comments`) : [];
    cards.push(normalizeIssue(issue, comments));
  }
  return cards;
}

// The cards, open and closed, whose company domain is this domain. A closed card is reopened when the company writes again. Listing is exact; GitHub's search index can lag by minutes.
export async function searchCardsByDomain(domain, { state = 'all' } = {}) {
  const wanted = companyDomain(domain);
  const cards = await listCards({ state });
  return cards.filter((card) => {
    const match = /\(([^()\s]+)\)\s*$/.exec(card.title ?? '');
    return Boolean(match) && companyDomain(match[1]) === wanted;
  });
}

export async function createCard({ title, body, labels = [] }) {
  if (isDryRun()) {
    dryNote(`create the card "${title}" with the label ${labels.map((l) => `"${l}"`).join(', ') || '(none)'}`);
    return { number: 0, url: '(dry run)' };
  }
  const issue = await gh(`/repos/${repoSlug()}/issues`, { method: 'POST', json: { title, body, labels } });
  return { number: issue.number, url: issue.html_url };
}

export async function addNote(number, body) {
  if (isDryRun()) return dryNote(`add a note to card #${number}: ${body.split('\n')[0]}`);
  return gh(`/repos/${repoSlug()}/issues/${number}/comments`, { method: 'POST', json: { body } });
}

// Replaces all labels on the card with this list.
export async function setCardLabels(number, labels) {
  if (isDryRun()) return dryNote(`set the labels of card #${number} to ${labels.map((l) => `"${l}"`).join(', ')}`);
  return gh(`/repos/${repoSlug()}/issues/${number}/labels`, { method: 'PUT', json: { labels } });
}

export async function closeCard(number) {
  if (isDryRun()) return dryNote(`close card #${number}`);
  return gh(`/repos/${repoSlug()}/issues/${number}`, { method: 'PATCH', json: { state: 'closed' } });
}

// Replaces the body of a card. Used only to add a contact to the header record.
export async function updateCardBody(number, body) {
  if (isDryRun()) return dryNote(`update the header record of card #${number}`);
  return gh(`/repos/${repoSlug()}/issues/${number}`, { method: 'PATCH', json: { body } });
}
