# CRM (HubSpot or Pipedrive)

Step 4 of the guide. Needed in every setup.

## What the key is for

- The check from `rules/02-what-to-check.md`: is this company already a customer, or in an active deal? The AI agent looks the company up by domain.
- The one rule you never loosen: if anyone from that company has an active deal, the AI agent adds the label "Our person is in the thread" and writes nothing.
- Logging the lead: before the first email, the AI agent creates the lead in the CRM so the sales rep sees it.

The guide uses HubSpot and Pipedrive as examples. Any mainstream CRM issues a key in its settings; for another one, write the same three calls (search by domain, read deals, create) in a copy of this file and add an adapter next to `scripts/lib/adapters/crm.mjs`.

Variables: `CRM` (`hubspot` or `pipedrive`), then the ones for your choice:

| `CRM` | Variables |
|---|---|
| `hubspot` | `HUBSPOT_TOKEN` |
| `pipedrive` | `PIPEDRIVE_API_TOKEN`, `PIPEDRIVE_DOMAIN` (the first part of your Pipedrive address, for example `northstar` in `northstar.pipedrive.com`) |

## Where to create it

- HubSpot: Settings, Integrations, Private Apps, create a private app. Copy its access token.
- Pipedrive: your profile menu, Personal preferences, API, copy your personal API token.

## Minimum scope

- HubSpot: when you create the private app, give it read access to companies, contacts and deals, and write access to companies and contacts only. No access to settings, users or other objects.
- Pipedrive: a personal API token has the access of the person who owns it. Create the token under a user whose role can read and create leads and organizations and nothing else, not under an admin.

## Calls the AI agent makes

HubSpot. The token goes in the header `Authorization: Bearer`.

1. Find a company by its domain. Read-only. The `first-run-setup` skill uses a call like this to test the token.

```bash
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/companies/search" \
  -H "Authorization: Bearer $HUBSPOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filterGroups": [{"filters": [{"propertyName": "domain", "operator": "EQ", "value": "blueridgehvac.example"}]}],
    "properties": ["name", "domain", "lifecyclestage"],
    "limit": 5
  }'
```

2. Read the deals of that company. Use the company id from the first call.

```bash
curl -s "https://api.hubapi.com/crm/v4/objects/companies/$COMPANY_ID/associations/deals" \
  -H "Authorization: Bearer $HUBSPOT_TOKEN"
```

Then read each deal's stage with `GET /crm/v3/objects/deals/{id}?properties=dealname,dealstage`. A deal that is not in a closed stage is an active deal.

3. Create the lead before the first email.

```bash
curl -s -X POST "https://api.hubapi.com/crm/v3/objects/contacts" \
  -H "Authorization: Bearer $HUBSPOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"properties": {"email": "jordan@blueridgehvac.example", "firstname": "Jordan", "lastname": "Whitfield", "company": "Blue Ridge HVAC"}}'
```

Pipedrive. The token goes in the query as `api_token`, and the base URL is built from your domain.

4. Find an organization by name or domain, then read its deals.

```bash
curl -s "https://$PIPEDRIVE_DOMAIN.pipedrive.com/api/v1/organizations/search?term=blueridgehvac.example&api_token=$PIPEDRIVE_API_TOKEN"
curl -s "https://$PIPEDRIVE_DOMAIN.pipedrive.com/api/v1/organizations/$ORG_ID/deals?status=open&api_token=$PIPEDRIVE_API_TOKEN"
```

To create the lead in Pipedrive, check the vendor docs for the leads endpoint.

## Notes

- Match by company domain, not by the exact address. The colleague who books is often not the person who wrote. If the CRM stores the company website and not a domain, strip the address to its domain before the search.
- The first hit wins. One active deal is enough to stop writing.
- Write the CRM result on the card as a `found-out` note: what was searched, and what was found, with the record link. If the search failed, write that instead, and write nothing to the lead until a person looks.
