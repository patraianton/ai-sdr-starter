# Short.io (short links)

Step 4 of the guide. Needed in every setup.

## What the key is for

- When a lead asks for a case study or a one-pager, the AI agent makes one short link for that lead alone, pointing to the piece from `knowledge/materials/index.yml`. It sends the link in the reply instead of an attachment.
- On every run, it reads whether the link was opened. The first open becomes a dated `link-opened` note on the card, dated with the run that saw it, and the AI agent writes its next message then.

Use a short link rather than a UTM tag, so the lead sees a clean address without a tracking tail. Put the links on your own short domain so they look like yours.

Variables: `SHORTIO_API_KEY`, `SHORTIO_DOMAIN` (the short domain you added in Short.io, for example `go.your-company.example`)

## Where to create it

In Short.io: Integrations and API, create an API key. Add your own short domain first, under Domains, and point its DNS as Short.io says. Short.io's free plan includes the API and click statistics.

## Minimum scope

Short.io lets you create a public key or a private key. Create a private key. If your plan lets you restrict the key to one domain, restrict it to `SHORTIO_DOMAIN`. The AI agent only creates links and reads their statistics. It never deletes or edits links.

## Calls the AI agent makes

The key goes in the header `Authorization`, with no word "Bearer" before it.

1. List the domains on the account. Read-only. The `first-run-setup` skill uses it to test the key.

```bash
curl -s "https://api.short.io/api/domains" \
  -H "Authorization: $SHORTIO_API_KEY" \
  -H "accept: application/json"
```

2. Create one link for one lead.

```bash
curl -s -X POST "https://api.short.io/links" \
  -H "Authorization: $SHORTIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "'"$SHORTIO_DOMAIN"'",
    "originalURL": "https://northstardispatch.example/case-studies/hvac",
    "title": "hvac-case-study / Blue Ridge HVAC",
    "allowDuplicates": true
  }'
```

`allowDuplicates` lets the same piece have a separate link for each lead. The answer holds `shortURL` (the address to put in the email) and `idString` (the identifier for statistics). The AI agent writes both on the card, with the piece id, in the `Material:` line of the `draft` and `sent` notes: `<piece id> / <short URL> / <idString>`.

3. Read the click statistics of that link. Used on every run for every link that has not been opened yet. `$LINK_ID` is the `idString` from the `Material:` line of the `sent` note on the card.

```bash
curl -s "https://statistics.short.io/statistics/link/$LINK_ID?period=last30&tz=UTC" \
  -H "Authorization: $SHORTIO_API_KEY" \
  -H "accept: application/json"
```

The field to read is `humanClicks`, which leaves out link checkers; if the answer has no such field, read `totalClicks` and treat a click in the first seconds after sending as a scanner (see Notes). When it goes from 0 to 1 or more, the link was opened. The answer gives totals only, not the time of each click.

## Calls described in words

- The time of the first click: Short.io has an endpoint for the latest clicks of a link, with a timestamp for each. Check the vendor docs for its path. If you do not use it, the AI agent writes the time of the run that first saw the click, and says so in the note.

## Notes

- Mail scanners and link previews open links without a person behind them. A click in the first seconds after sending is probably a scanner. Write that into the note, and do not hurry to write to the lead because of it.
- One link per lead and per piece. Never reuse a link for another lead, or the card will show someone else's open.
