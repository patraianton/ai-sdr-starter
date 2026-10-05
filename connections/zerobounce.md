# ZeroBounce (email verification)

Step 4 of the guide. Needed in setup 1.

## What the key is for

The AI agent checks every address before it goes into the sending service. Bounces get your sending domains blacklisted, so no unchecked address is loaded into a campaign. This is also one of the launch rules in `rules/07-launch-rules.md`: the AI agent pauses the campaign when the bounce rate passes the number you set.

Variable: `ZEROBOUNCE_API_KEY`

## Where to create it

In ZeroBounce: API, then your API key. The price is $39 per 2,000 addresses verified; credits do not expire monthly, so you can buy a small batch first.

## Minimum scope

ZeroBounce keys are not split by endpoint, so the key can check addresses and read the credit balance, and nothing else on your account matters to it. Keep it in `.env` only. If you use ZeroBounce for other tools, create a separate account or a separate key so you can reissue it alone.

## Calls the AI agent makes

1. Check how many credits are left. Read-only. The `first-run-setup` skill uses this to test the key.

```bash
curl -s "https://api.zerobounce.net/v2/getcredits?api_key=$ZEROBOUNCE_API_KEY"
```

2. Verify one address.

```bash
curl -s "https://api.zerobounce.net/v2/validate?api_key=$ZEROBOUNCE_API_KEY&email=jordan@blueridgehvac.example&ip_address="
```

The field to read is `status`. The AI agent loads an address into a campaign only when it is `valid`.

3. Verify up to 200 addresses in one call. Used when the AI agent loads a whole list.

```bash
curl -s -X POST "https://bulkapi.zerobounce.net/v2/validatebatch" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "'"$ZEROBOUNCE_API_KEY"'",
    "email_batch": [
      {"email_address": "jordan@blueridgehvac.example", "ip_address": ""},
      {"email_address": "info@harborplumbing.example", "ip_address": ""}
    ]
  }'
```

## What each status means for the AI agent

| Status | What the AI agent does |
|---|---|
| `valid` | Loads the address. |
| `catch-all` | Does not load it by default. Asks a person, or follows the rule in `rules/07-launch-rules.md` if you wrote one. |
| `unknown`, `invalid`, `spamtrap`, `abuse`, `do_not_mail` | Never loads it. Writes the status on the card. |

## Notes

- The API key is in the query string of the single-address calls. Do not copy a full URL from your shell history into a card or a chat.
- For very large files, ZeroBounce has a separate file upload API. Check the vendor docs if you need it.
