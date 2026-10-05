# Smartlead (sending service)

Step 4 of the guide. Needed in setup 1.

## What the key is for

- The AI agent loads the verified list and the approved sequence into a campaign.
- It reads every reply, in every campaign, including finished ones, and answers in the same thread.
- It sends the follow-ups, and pauses the campaign when the bounce rate passes the number in `rules/settings.yml`.

Smartlead rotates the mailboxes and keeps them warm. Buying and connecting the mailboxes (for example from InboxKit) is a human step and happens in Smartlead, not through this key.

Variable: `SMARTLEAD_API_KEY`

## Where to create it

In Smartlead: Settings, then API key. The API needs the Pro plan; the cheapest plan has no API.

## Minimum scope

Smartlead has one key per account, with no per-endpoint scopes. So the limit is in the habit: the AI agent calls only the campaign, lead, reply and statistics endpoints listed below. It never changes billing, team members or the mailbox connections. Never use the key in a script that does anything else.

## Calls the AI agent makes

Base URL: `https://server.smartlead.ai/api/v1`. The key goes in the query as `api_key`.

1. List the campaigns. Read-only. The `first-run-setup` skill uses this to test the key.

```bash
curl -s "https://server.smartlead.ai/api/v1/campaigns/?api_key=$SMARTLEAD_API_KEY"
```

2. Add leads to a campaign. Only addresses that came back `valid` from ZeroBounce.

```bash
curl -s -X POST "https://server.smartlead.ai/api/v1/campaigns/$CAMPAIGN_ID/leads?api_key=$SMARTLEAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_list": [
      {
        "email": "jordan@blueridgehvac.example",
        "first_name": "Jordan",
        "last_name": "Whitfield",
        "company_name": "Blue Ridge HVAC"
      }
    ],
    "settings": { "ignore_global_block_list": false }
  }'
```

3. Read the leads of a campaign and what happened to each. Used by the daily check and by every run, for every campaign.

```bash
curl -s "https://server.smartlead.ai/api/v1/campaigns/$CAMPAIGN_ID/leads?api_key=$SMARTLEAD_API_KEY&limit=100&offset=0"
```

4. Pause a campaign. Used when the bounce rate passes the limit, or when the stop switch is off and a campaign must not send.

```bash
curl -s -X POST "https://server.smartlead.ai/api/v1/campaigns/$CAMPAIGN_ID/status?api_key=$SMARTLEAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "status": "PAUSED" }'
```

## Calls described in words

These calls exist, but the exact paths and fields change, so check the vendor docs before the first run and write what you confirmed into this file.

- Reading the replies: the master inbox endpoints return replies across campaigns. The daily check needs every reply, so use the master inbox, not only one campaign's leads.
- Answering in the same thread: Smartlead has an endpoint that replies to a thread, taking the message identifier of the email being answered and the body.
- Loading the sequence: a campaign's email steps and their delays are set through the campaign's sequence endpoint.
- Suppression lists: Smartlead has a global block list, by address and by domain. Load your customers, everyone your team wrote to and everyone who said no before the first send (see `rules/07-launch-rules.md`).

## Notes

- The key is in the query string. Do not paste a full URL into a card or a chat.
- A draft that waits for approval is not in Smartlead. It lives on the card until the approver says yes, and only then does the AI agent send.
