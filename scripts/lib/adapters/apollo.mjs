// scripts/lib/adapters/apollo.mjs
// Guide: Step 1 (look the company up: size, industry, country) and Step 4 (contact data, every setup).
//
// Looks up one company by its domain. Apollo's API comes with every paid plan.
//
// Call used (Apollo API; check the vendor docs, the path and fields may change):
//   GET https://api.apollo.io/api/v1/organizations/enrich?domain=example.com     header x-api-key
// Building the setup 1 list (people search) is done by the AI agent from connections/apollo.md, not by these scripts.
//
// DRY_RUN=1 answers from scripts/fixtures/apollo.json.
// Answer shape: { domain, name, employees, industry, country } or null when Apollo does not know the company.
// "employees" is null when Apollo gives no size. Never guess one.

import { fetchJson, isDryRun } from '../http.mjs';
import { companyDomain } from '../match.mjs';
import { loadFixture } from '../settings.mjs';

export async function enrichOrganization(domain) {
  const wanted = companyDomain(domain);
  if (!wanted) return null;
  if (isDryRun()) {
    const known = loadFixture('apollo.json').organizations[wanted];
    return known ? { domain: wanted, ...known } : null;
  }
  const key = (process.env.APOLLO_API_KEY ?? '').trim();
  if (!key) throw new Error('APOLLO_API_KEY is not set');
  const answer = await fetchJson(`https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(wanted)}`, {
    vendor: 'Apollo',
    headers: { 'x-api-key': key, 'Cache-Control': 'no-cache' },
  });
  const org = answer?.organization;
  if (!org) return null;
  return {
    domain: wanted,
    name: org.name ?? '',
    employees: Number.isFinite(org.estimated_num_employees) ? org.estimated_num_employees : null,
    industry: org.industry ?? '',
    country: org.country ?? '',
  };
}
