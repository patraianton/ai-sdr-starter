// scripts/lib/adapters/shortio.mjs
// Guide: Step 4 (short links) and Step 2 (the signal on the card: the first open is a dated event).
//
// Makes one tracked short link per lead for a piece of material, and reads whether it was opened.
// Put the links on your own short domain (SHORTIO_DOMAIN) so they look like yours.
//
// Calls used (Short.io API):
//   POST https://api.short.io/links                          create a link; header Authorization: <key>
//   GET  https://statistics.short.io/statistics/link/{id}    click totals for one link
// The totals say whether a link was opened, not when. If you want the time of the first open, check the
// vendor docs for the call that lists clicks, and fill in firstClickAt below. Until then the AI agent dates
// the "link-opened" note with the run that first saw the click, which is the moment it acts on anyway.
//
// DRY_RUN=1 answers from scripts/fixtures/links.json and creates nothing.

import { fetchJson, isDryRun } from '../http.mjs';
import { loadFixture } from '../settings.mjs';

function credentials() {
  const key = (process.env.SHORTIO_API_KEY ?? '').trim();
  const domain = (process.env.SHORTIO_DOMAIN ?? '').trim();
  if (!key) throw new Error('SHORTIO_API_KEY is not set');
  if (!domain) throw new Error('SHORTIO_DOMAIN is not set');
  return { key, domain };
}

// Returns { id, short_url }. One link per lead: pass a title that names the lead and the piece.
export async function createLink({ url, title }) {
  if (isDryRun()) return { ...loadFixture('links.json').created };
  const { key, domain } = credentials();
  const answer = await fetchJson('https://api.short.io/links', {
    method: 'POST',
    vendor: 'Short.io',
    headers: { Authorization: key },
    json: { domain, originalURL: url, title, allowDuplicates: true },
  });
  const shortUrl = answer?.secureShortURL ?? answer?.shortURL;
  if (!answer?.idString || !shortUrl) throw new Error('Short.io did not return a link');
  return { id: answer.idString, short_url: shortUrl };
}

// Returns { clicks, firstClickAt }. clicks counts people, not link checkers, when the vendor splits them.
export async function getClicks(linkId) {
  if (isDryRun()) {
    const known = loadFixture('links.json').clicks[linkId];
    return known ? { ...known } : { clicks: 0, firstClickAt: null };
  }
  const { key } = credentials();
  const answer = await fetchJson(`https://statistics.short.io/statistics/link/${encodeURIComponent(linkId)}?period=last30&tz=UTC`, {
    vendor: 'Short.io',
    headers: { Authorization: key },
  });
  const clicks = Number(answer?.humanClicks ?? answer?.totalClicks ?? 0);
  return { clicks, firstClickAt: null }; // check the vendor docs for per-click times
}
