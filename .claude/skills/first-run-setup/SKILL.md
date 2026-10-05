---
name: first-run-setup
description: The first run in a new copy of this template. Creates the nine labels on the board, checks every key with one read-only call, and does one run with sending off. Use when the owner says "first run", "set up the board", "check the keys", or when the repository has no labels yet.
---

# first-run-setup: the first run

Steps 2, 4 and 5 of the guide. The article says: on its first run, the AI agent creates the labels from the list in the template. This skill does that, checks that every connection works, and proves the AI agent can handle a real reply with no email leaving.

You never create or delete the flag file. Never print a key value. Say "ok" or "failed" for each key, never the key.

## 1. Check the folder

1. Confirm you are in the folder that holds `CLAUDE.md` and `rules/`.
2. Confirm `.env` exists. If not, tell the owner to copy `.env.example` to `.env` and fill the lines for their setup, and stop. Confirm `git check-ignore .env` prints `.env`. If it does not, stop: the keys would be committed.
3. Read `rules/settings.yml`. If `setup`, `engine`, `approval.stage` or the four names under `approval` (approver, waiting_list_answerer, call_host, switch_owner) are empty, stop and ask the owner to fill them. This skill refuses to run on empty settings. The order is: `draft-rules-from-threads`, the owner corrects the drafts, the owner fills the settings and the names (also in `rules/08-approval-and-people.md`, with the approver's GitHub login), and only then this skill. Check that `approval.stage` is 1. Then check that the rules are written: open every file from `01` to `08` in `rules/`. If each one holds only its headings, the short explanation under them, the `<!-- example -->` comment and an empty `-` bullet, the rules are not written. Stop and offer `draft-rules-from-threads`. Do not go on to section 4, because `sdr-run` refuses the same folder.
4. Confirm the flag file named in `sending_flag_file` does **not** exist. If it exists, ask the owner to delete it. You do not delete it.

## 2. Create the labels

1. Get the token: `TOKEN=$(node scripts/gh-app-token.mjs)`. If this fails, the three GitHub App keys in `.env` are wrong (`connections/github-app.md` shows how to create the App). Say which line and stop.
2. Confirm the repository is private: call `GET /repos/$GITHUB_REPO` with that token and read `private`. If it is `false`, stop. The cards hold real leads.
3. Show the plan: `node scripts/board-labels.mjs` (it defaults to `DRY_RUN=1` and writes nothing). It lists the nine labels from `board/labels.yml` and which exist.
4. Create them: `DRY_RUN=0 node scripts/board-labels.mjs`. The script is safe to run again.
5. Check on GitHub: `GET /repos/$GITHUB_REPO/labels`. All nine names from `board/labels.yml` must be there, with the same colors.

## 3. Check every key

Use the keys that `settings.yml` says this setup needs (see `connections/README.md`, column "Needed in"). Make one read-only call for each, from the matching `connections/<name>.md`, and print only the HTTP status or the word the service answers with:

```
curl -sS -o /dev/null -w "%{http_code}\n" <the read-only call>
```

The status is not enough for two services, because they answer with a good status for a bad key. Read the body of the answer, and print only "ok" or "failed", never the body:

- Slack (`auth.test`) answers HTTP 200 with `{"ok":false}` for a bad token. The key works only if the body says `"ok":true`.
- ZeroBounce (`getcredits`) answers HTTP 200 with a `Credits` value of `-1` for a bad key. The key works only if `Credits` is 0 or more.

| Connection | File | Needed in |
|---|---|---|
| GitHub App | `connections/github-app.md` (section 2, item 1, already tested it) | every setup |
| Apollo | `connections/apollo.md` | every setup |
| CRM | `connections/crm.md` | every setup |
| Calendar | `connections/calendly.md` | every setup |
| Short links | `connections/shortio.md` | every setup |
| ZeroBounce | `connections/zerobounce.md` | setup 1 |
| Smartlead | `connections/smartlead.md` | setup 1 |
| explee | `connections/explee.md` | setup 2 |
| Sign-up mailbox | `connections/mailbox.md` | setup 3 |
| Sign-ups | `connections/signups.md` | setup 3 |
| Slack | `connections/slack.md` | team mode and alarms |

Two connections are manual rows, because neither file holds a read-only curl example to run. For **explee** (`connections/explee.md`), the owner reads the vendor docs and writes the confirmed read-only call into that file, and fills in `BASE` and `REPLIES_PATH` in `scripts/lib/adapters/explee.mjs`, which the daily check also needs. Use that call once it is there. For the **sign-ups** (`connections/signups.md`), there is no vendor key to test: the owner sends one test sign-up through the feed (the first call in that file, or a test email to the notification mailbox), and you check that it arrives in the feed. If the owner has not done this yet, do not pass the row: write "no test yet, ask the owner" in the table and ask them to do it. Never guess a path, and never report "ok" for a key you did not test.

Print a table to the owner: connection, ok or failed, and for each failure the line of `.env` to fix. A 401 or 403 means the key is wrong or too narrow, and so does a Slack or ZeroBounce body that says so. Do not retry with other values. Do not go on to section 4 while any key the setup needs fails or has no test yet.

## 4. A run with sending off

1. Say it plainly: no email will leave, because the flag file is missing.
2. Follow `.claude/skills/sdr-run/SKILL.md` for one run. If a real reply exists, it is handled. If there is none, ask the owner to send one to a test address on the sending mailbox from a personal address, or to pick the latest real reply, and run again.
3. Check the result with the owner:
   - the card exists, titled `<Company> (<domain>)`, with the record filled;
   - the `found-out` note shows the CRM, the mailbox and the calendar checks;
   - the draft is a `draft` note and the label is "Draft ready";
   - nothing was sent: look in the sending service or the mailbox for sent items from this run.
4. If any of these fails, write down which, fix the rule or the key, and run again. Do not go on.

## 5. Hand back

Tell the owner in plain words:

1. The labels are made, the keys that work, and the keys that do not.
2. What the first run did, and the link to the card.
3. The scripts (`daily-check.mjs`, and `signup-flow.mjs` in way C) still run in `DRY_RUN=1` from `.env`. Set `DRY_RUN=0` in `.env` after reading their first output.
4. What is left from `docs/launch-checklist.md`: test the stop switch, name the people, turn on the daily check, and keep stage 1 for the first days.
5. Sending stays off until the owner creates the flag file themselves.

## Stop conditions

Stop and tell the owner when: `.env` is missing or not ignored by git; the repository is public; the settings are empty; the flag file exists; any key the setup needs fails; the first run sends or tries to send an email.
