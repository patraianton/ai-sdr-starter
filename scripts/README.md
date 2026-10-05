# Scripts

Step 6 of the guide, plus the helpers the other steps need. Node 20 or newer, plain ES modules, no dependencies: there is nothing to install. Every script has no model inside. The AI agent writes and repairs them; they run by themselves.

## What each script does

| Script | What it does | Guide step |
|---|---|---|
| `daily-check.mjs` | Pulls every reply from the sending service, explee or the mailbox, and matches each to a card by address, then by company domain. A reply with no note on a card is a missed reply. In the mailbox (setup 3) it counts a message only when it comes from an address or company that has a card, or answers an email the AI agent sent (the same subject, or the id it replies to); newsletters, internal mail and vendor mail are ignored, so they raise no alarm. It also raises an alarm when a draft, a reply or a handover waits on a person for more than one working day (the alarm names the person, and an email from a colleague to that company, read from the mailbox, ends the wait), when a booked call ended with no "call-held" note, and when calls are booked but no host is named in the settings. Alarms go to the Slack alarms channel, or to `alarms/YYYY-MM-DD-daily-check.md`, which the script owns and rewrites on every run. It never touches `alarms/YYYY-MM-DD.md`, where the AI agent and `run-agent.sh` append their own lines. | Step 6 |
| `report.mjs` | Builds the owner report from the cards and the calendar. First line: `Calls booked: N · held: M (since <date>)`. Then one row per booking, then the replies waiting for a person. Never the number of emails sent. | Step 6 |
| `board-labels.mjs` | Creates or updates the nine labels from `board/labels.yml` in your GitHub repository. Safe to run again. It never deletes a label. A dry run reads your repository's labels when `.env` names it (reading changes nothing), so the plan shows what really exists. | Step 2 |
| `gh-app-token.mjs` | Turns the GitHub App's private key into a one-hour installation token. `DRY_RUN` does not apply to it: it writes nothing, and the skills call it to get a real token. | Step 2 |
| `selftest.mjs` | The repository's own tests. Needs no keys and no network. It also checks that no key-shaped string, no real-looking address and no em dash is in any file. To also ban words of your own (a company name, a server name), list them one per line in `scripts/.forbidden.local.txt`, which git ignores, or point `FORBIDDEN_WORDS_FILE` at a file. Without that file the word check is skipped. | Step 6 |
| `../engine/way-c-scripts/signup-flow.mjs` | Way C: sign-ups in, the three checks, the first email and the follow-ups from templates, every step on the card. | Step 3 |

## Run them

```
node scripts/selftest.mjs                      the tests: run this first
node scripts/daily-check.mjs                   a dry run on the sample data
DRY_RUN=0 node scripts/daily-check.mjs         the real run
node scripts/daily-check.mjs --help            usage of any script
```

On Windows PowerShell, write `$env:DRY_RUN = "0"` first, or add `--live` to the command. `--live` means the same as `DRY_RUN=0`.

## Dry run is the default

`DRY_RUN=1` is the default, with or without a `.env` file. For `daily-check.mjs`, `report.mjs` and `signup-flow.mjs` a dry run reads the sample data in `fixtures/`, writes nothing, posts nothing, sends nothing, and prints what it would have done. It reads the settings from `examples/northstar/rules/`, so the fixtures and the settings belong to the same company. A real run reads `rules/`. Pass `--rules <folder>` to choose another folder.

The sample run of the daily check raises six alarms on purpose, so you see each kind: two missed replies, three replies waiting too long (a draft, a handover that nobody answered, and a lead whose reply waits on a colleague) and one call nobody confirmed.

A real run needs the keys in `.env` (copy `.env.example`; see `connections/README.md`). The scripts read `.env` from the repository root. A key that is already in the environment wins over `.env`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | It ran and raised no alarm. |
| 1 | It ran and raised at least one alarm. For `selftest.mjs`: a test failed. |
| 3 | It could not run: a key is missing, a service did not answer, a file is missing. |

Code 3 is an alarm too. When the daily check cannot run, it writes "the daily check could not run" to the alarms channel or the alarms file, because a check that fails quietly is the one thing it must not do.

## Keys

Keys live in `.env` and nowhere else. No script prints a key value, writes one to a card or puts one in a log: every line of output passes through one function that removes key values, key-shaped text and `api_key=` parts of addresses. `gh-app-token.mjs` prints the installation token on purpose, so a shell can store it. Do not run it where its output is logged. Its `--check` option proves the key works and prints only when the token expires, and `--sign-only` tests the key file without any call.

## The folders

| Path | What is in it |
|---|---|
| `lib/settings.mjs` | The small YAML reader for `rules/settings.yml`, `board/labels.yml` and the materials list. Its header lists what it reads and what it refuses. Also the `.env` reader, the argument reader and the paths. |
| `lib/match.mjs` | No network. Addresses, company domains, the free-mail list, reading a card and its notes, matching a reply or a booking to a card, the waiting-time rule. |
| `lib/http.mjs` | One place for web calls: short retries, error text without keys, `DRY_RUN`. |
| `lib/github.mjs` | Cards, comments and labels over the GitHub REST API. In a dry run it reads `fixtures/cards.json` and every write only prints. |
| `lib/slack.mjs` | Posts one message to a channel with the bot token (the `chat:write` scope is enough). |
| `lib/adapters/` | One file per connection: Smartlead, explee, the mailbox, Calendly, Short.io, Apollo, the CRM, and the sign-up feed. Each exports the few calls the scripts need and returns fixture data in a dry run. |
| `fixtures/` | The Northstar Dispatch sample data, dated March 2026: nine cards, replies, bookings, sign-ups, company look-ups, CRM answers and short-link counts. The clock of a dry run is `now` in `cards.json`. |

## What is not finished on purpose

- `lib/adapters/explee.mjs` has two marked places for the call that lists replies: `BASE` and `REPLIES_PATH`. Neither is invented. Open explee's API documentation, set both and check the field names. Until then a real run stops with code 3 and says why.
- `lib/adapters/shortio.mjs` reads click totals, not the time of each click. The AI agent dates the "link-opened" note with the run that first sees the click.
- The mailbox adapter is wired for Unipile only. Reading Google or Microsoft mail directly needs a one-time setup by a developer.
- Every call to a vendor names its public endpoint. Where an endpoint or a field may have changed, a comment says "check the vendor docs".

## Add another connection

Copy the adapter that is closest, keep the shape of the answer (the header comment of each adapter states it), keep the `DRY_RUN` branch that returns fixture data, and add a fixture. The scripts do not change.
