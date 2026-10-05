# Mailbox (sign-ups)

Step 4 of the guide. Needed in setup 3.

## What the key is for

In setup 3 the AI agent writes from the sales rep's address or from a shared company address, on Google Workspace or Microsoft 365. It reads replies to its own emails, sends the first email and the follow-ups, and checks the mailbox for the one rule of `rules/06-hard-rules.md`: whether anyone from the lead's company has already written to or heard from your people in the last months.

A developer connects the mailbox once. Two ways, set by `MAILBOX_PROVIDER` in `.env`:

| `MAILBOX_PROVIDER` | Connected through | Variables |
|---|---|---|
| `google` | The Gmail API, with OAuth | check the vendor docs, see below |
| `microsoft` | Microsoft Graph, with OAuth | check the vendor docs, see below |
| `unipile` | Unipile, a connector for Gmail and Outlook accounts | `UNIPILE_DSN`, `UNIPILE_API_KEY`, `UNIPILE_ACCOUNT_ID` |

Unipile is the simplest for a first setup: one key, no OAuth app of your own to publish. The `scripts/lib/adapters/mailbox.mjs` adapter is written for Unipile. For Google or Microsoft directly, a developer writes the same few calls.

## Where to create it

- Unipile: in the Unipile dashboard, create an API access token, connect the mailbox account with their hosted link, and note the account id and your data source name (DSN) from the dashboard. `UNIPILE_DSN` is the host and port of your Unipile server, for example `api1.unipile.com:13111`; use the one your dashboard shows.
- Google Workspace: a developer creates an OAuth client in Google Cloud and authorizes the mailbox once. Check the Gmail API docs.
- Microsoft 365: a developer registers an app in Microsoft Entra and grants mail permissions. Check the Microsoft Graph docs.

## Minimum scope

Read mail and send mail for the one mailbox the AI agent writes from. In Gmail that is the read and send scopes for that user. In Microsoft Graph it is `Mail.Read` and `Mail.Send`, delegated, for that user only. Never ask for access to the whole domain or to calendars through this key. Calendars go through `calendly.md`.

## Calls the AI agent makes

With Unipile. The key goes in the header `X-API-KEY`, and the base URL is built from your DSN.

1. List the connected accounts. Read-only. The `first-run-setup` skill uses this to test the key.

```bash
curl -s "https://$UNIPILE_DSN/api/v1/accounts" \
  -H "X-API-KEY: $UNIPILE_API_KEY" \
  -H "accept: application/json"
```

2. Read recent emails from the mailbox. Used by the daily check and by every run.

```bash
curl -s "https://$UNIPILE_DSN/api/v1/emails?account_id=$UNIPILE_ACCOUNT_ID&limit=50" \
  -H "X-API-KEY: $UNIPILE_API_KEY" \
  -H "accept: application/json"
```

3. Send an email. Only after the approval stage allows it and the flag file `SENDING_ON` exists.

```bash
curl -s -X POST "https://$UNIPILE_DSN/api/v1/emails" \
  -H "X-API-KEY: $UNIPILE_API_KEY" \
  -F "account_id=$UNIPILE_ACCOUNT_ID" \
  -F 'to=[{"identifier":"jordan@blueridgehvac.example","display_name":"Jordan Whitfield"}]' \
  -F "subject=Your Northstar Dispatch trial" \
  -F "body=Hi Jordan, ..."
```

## Calls described in words

- Answering in the same thread: Unipile's send call takes the identifier of the email being answered. Check the vendor docs for the exact field name.
- Searching the mailbox by company domain: Gmail has a `q` search parameter on `users.messages.list`, and Microsoft Graph has `$search` on messages. Both support searching by a domain. Check the vendor docs.

## Notes

- Mark every email the AI agent sends so the check can tell it from the sales rep's own emails: a fixed footer line, or a label. The card log names the sender of each email too. This is the rule from step 5 of the guide: the AI agent's own sent emails do not count as the sales rep talking to that company.
- Run it with sending off first. The first run reads and drafts, and no email leaves.
