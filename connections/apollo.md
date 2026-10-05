# Apollo (contact data)

Step 4 of the guide. Needed in every setup.

## What the key is for

- In setup 1 the AI agent builds the lead list to your ICP (ideal customer profile), using the filters in `rules/07-launch-rules.md`.
- In every setup it looks up the size, industry and country of each company that replies or signs up, as the heading "Look the company up" in `rules/02-what-to-check.md` says.

Variable: `APOLLO_API_KEY`

## Where to create it

In Apollo: Settings, Integrations, API, create a new API key. Apollo's API comes with every paid plan, so the Basic plan is enough. Name the key for what it does, for example `ai-sdr`.

## Minimum scope

Apollo lets you choose which endpoints a key may call. Allow only organization enrichment, people search and people match. Do not give it access to sequences, emails, or account settings. The AI agent never needs them.

## Calls the AI agent makes

Base URL: `https://api.apollo.io/api/v1`. The key goes in the header `x-api-key`.

1. Look up a company by its domain. Used by every setup for the size, industry and country.

```bash
curl -s "https://api.apollo.io/api/v1/organizations/enrich?domain=blueridgehvac.example" \
  -H "x-api-key: $APOLLO_API_KEY"
```

The answer has an `organization` object. The fields the AI agent reads are `name`, `primary_domain`, `estimated_num_employees`, `industry`, `country`.

2. Search people at a company by title. Used in setup 1 to build the list. This search does not return email addresses.

```bash
curl -s -X POST "https://api.apollo.io/api/v1/mixed_people/api_search" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $APOLLO_API_KEY" \
  -d '{
    "q_organization_domains_list": ["blueridgehvac.example"],
    "person_titles": ["owner", "operations manager"],
    "per_page": 5
  }'
```

3. Get one person's email. Used in setup 1 after the search, only for people who fit. Revealing an email costs credits, so the AI agent reveals only the people it will write to.

```bash
curl -s -X POST "https://api.apollo.io/api/v1/people/match" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $APOLLO_API_KEY" \
  -d '{
    "first_name": "Jordan",
    "last_name": "Whitfield",
    "domain": "blueridgehvac.example",
    "reveal_personal_emails": false
  }'
```

The AI agent uses an address only when `email_status` is `verified`, and then it still goes through ZeroBounce (see `zerobounce.md`).

## Notes

- Apollo has renamed and moved some search endpoints more than once. If a call returns a "not found" or "deprecated" message, check the vendor docs for the current path and fix this file.
- Credits are the real limit. The AI agent writes the number of enrich and reveal calls it made into the run log, never the key.
- A lookup that returns nothing is a result. The AI agent writes "Apollo had no record" on the card and asks the lead, it does not guess the size.
