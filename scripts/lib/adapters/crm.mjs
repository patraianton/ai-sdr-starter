// scripts/lib/adapters/crm.mjs
// Guide: Step 1 (check whether the company is already a customer or in a deal) and Step 4 (the CRM, every setup).
//
// Two calls, for HubSpot or Pipedrive (CRM=hubspot or CRM=pipedrive in .env):
//   findCompany(domain)  is the company a customer, does it have an open deal?
//   createLead(...)      creates the lead before the first email, so the sales rep sees it.
//
// HubSpot calls (CRM API v3 and v4; check the vendor docs):
//   POST /crm/v3/objects/companies/search        filter: domain EQ ...
//   GET  /crm/v4/objects/companies/{id}/associations/deals, then GET /crm/v3/objects/deals/{id}
//   POST /crm/v3/objects/companies, POST /crm/v3/objects/contacts, PUT /crm/v4/objects/contacts/{id}/associations/default/companies/{id}
// Pipedrive calls (API v1; check the vendor docs):
//   GET /persons/search?term=@domain&fields=email, GET /organizations/{id}/deals?status=open|won
//   POST /organizations, POST /persons, POST /leads
//
// A company counts as a customer when HubSpot says lifecycle stage "customer", or when Pipedrive holds a won deal for it.
// Other CRMs: copy this file, keep the two function shapes, and change the calls.
//
// DRY_RUN=1 answers from scripts/fixtures/crm.json and creates nothing.
// findCompany answer: { found, id, name, is_customer, open_deals: [{ name, stage }] }

import { fetchJson, isDryRun } from '../http.mjs';
import { companyDomain } from '../match.mjs';
import { loadFixture } from '../settings.mjs';

const NOT_FOUND = { found: false, id: null, name: '', is_customer: false, open_deals: [] };

function which() {
  const crm = (process.env.CRM ?? '').trim().toLowerCase();
  if (crm !== 'hubspot' && crm !== 'pipedrive') throw new Error('CRM must be hubspot or pipedrive (set it in .env)');
  return crm;
}

function hubspot() {
  const token = (process.env.HUBSPOT_TOKEN ?? '').trim();
  if (!token) throw new Error('HUBSPOT_TOKEN is not set');
  const call = (path, options = {}) =>
    fetchJson(`https://api.hubapi.com${path}`, { vendor: 'HubSpot', headers: { Authorization: `Bearer ${token}` }, ...options });
  return { call };
}

function pipedrive() {
  const token = (process.env.PIPEDRIVE_API_TOKEN ?? '').trim();
  const domain = (process.env.PIPEDRIVE_DOMAIN ?? '').trim().replace(/\.pipedrive\.com.*$/, '');
  if (!token) throw new Error('PIPEDRIVE_API_TOKEN is not set');
  if (!domain) throw new Error('PIPEDRIVE_DOMAIN is not set (the part before .pipedrive.com)');
  const call = (path, options = {}) =>
    fetchJson(`https://${domain}.pipedrive.com/api/v1${path}`, { vendor: 'Pipedrive', headers: { 'x-api-token': token }, ...options });
  return { call };
}

async function findInHubspot(domain) {
  const { call } = hubspot();
  const search = await call('/crm/v3/objects/companies/search', {
    method: 'POST',
    json: {
      filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }] }],
      properties: ['name', 'domain', 'lifecyclestage'],
      limit: 1,
    },
  });
  const company = search?.results?.[0];
  if (!company) return { ...NOT_FOUND };
  const links = await call(`/crm/v4/objects/companies/${company.id}/associations/deals`);
  const open = [];
  for (const link of links?.results ?? []) {
    const deal = await call(`/crm/v3/objects/deals/${link.toObjectId}?properties=dealname,dealstage,hs_is_closed`);
    if (String(deal?.properties?.hs_is_closed) !== 'true') {
      open.push({ name: deal?.properties?.dealname ?? '', stage: deal?.properties?.dealstage ?? '' });
    }
  }
  return {
    found: true,
    id: String(company.id),
    name: company.properties?.name ?? '',
    is_customer: company.properties?.lifecyclestage === 'customer',
    open_deals: open,
  };
}

async function findInPipedrive(domain) {
  const { call } = pipedrive();
  const query = new URLSearchParams({ term: `@${domain}`, fields: 'email', limit: '10' });
  const search = await call(`/persons/search?${query}`);
  const org = (search?.data?.items ?? []).map((row) => row.item?.organization).find((candidate) => candidate?.id);
  if (!org) return { ...NOT_FOUND };
  const open = await call(`/organizations/${org.id}/deals?status=open`);
  const won = await call(`/organizations/${org.id}/deals?status=won&limit=1`);
  return {
    found: true,
    id: String(org.id),
    name: org.name ?? '',
    is_customer: (won?.data ?? []).length > 0,
    open_deals: (open?.data ?? []).map((deal) => ({ name: deal.title ?? '', stage: String(deal.stage_id ?? '') })),
  };
}

export async function findCompany(domain) {
  const wanted = companyDomain(domain);
  if (!wanted) return { ...NOT_FOUND };
  if (isDryRun()) {
    const known = loadFixture('crm.json').companies[wanted];
    return known ? { found: true, ...known } : { ...NOT_FOUND };
  }
  return which() === 'hubspot' ? findInHubspot(wanted) : findInPipedrive(wanted);
}

// company: name; domain; contact: { name, email }.
// Returns { id }. Call it only after findCompany said the company is not there.
export async function createLead({ company, domain, contact }) {
  if (isDryRun()) return { id: 'dry-run' };
  const [firstName, ...rest] = String(contact.name ?? '').trim().split(/\s+/);
  const lastName = rest.join(' ');
  if (which() === 'hubspot') {
    const { call } = hubspot();
    const org = await call('/crm/v3/objects/companies', {
      method: 'POST',
      json: { properties: { name: company, domain, lifecyclestage: 'lead' } },
    });
    const person = await call('/crm/v3/objects/contacts', {
      method: 'POST',
      json: { properties: { email: contact.email, firstname: firstName ?? '', lastname: lastName } },
    });
    await call(`/crm/v4/objects/contacts/${person.id}/associations/default/companies/${org.id}`, { method: 'PUT' });
    return { id: String(org.id) };
  }
  const { call } = pipedrive();
  const org = await call('/organizations', { method: 'POST', json: { name: company } });
  const person = await call('/persons', {
    method: 'POST',
    json: { name: contact.name || contact.email, email: [contact.email], org_id: org.data.id },
  });
  await call('/leads', {
    method: 'POST',
    json: { title: company, organization_id: org.data.id, person_id: person.data.id },
  });
  return { id: String(org.data.id) };
}
