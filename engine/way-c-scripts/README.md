# Way C: scripts on a schedule, no model inside

Step 3 of the guide. Use this for setup 3, where sign-ups and forms arrive steadily and every step follows the same decision.

Claude Code writes ordinary scripts from your rules, and a scheduled job runs them every couple of hours, on a server or on your computer. No model runs inside, so the model costs nothing per lead: the emails are your templates, and the decisions are fixed rules.

The script in this folder is `signup-flow.mjs`. It is a working starting point. Ask Claude Code to adapt it to your sign-up feed and your rules, then read what it changed.

## What it does

Each run goes through these parts, in this order:

1. **Pull.** It reads new sign-ups and form requests since the last run (`connections/signups.md`). With a webhook, the receiver appends each sign-up to `runs/signups-inbox.jsonl`, and the script reads that file.
2. **Drop.** It drops free-mail addresses (the list in `scripts/lib/match.mjs`) and your own test accounts: the addresses under "Test accounts (setup 3)" in `rules/02-what-to-check.md`, and every address on a domain in `SIGNUP_OWN_DOMAINS` in `.env`.
3. **Check.** It runs the three checks of `rules/02-what-to-check.md`, by company domain: is the company already a customer, is your sales rep already talking to them, did they already book. A customer closes the card as "No fit". A person already in the thread or an open deal labels it "Our person is in the thread". A booking labels it "Booked". The script goes no further with that company.
4. **Look up.** It looks the company up in Apollo for size, industry and country. Below `icp.size_floor` in `rules/settings.yml`: it labels the card "No fit", closes it, and sends nothing. The size floor is the only part of `rules/03-icp-and-qualification.md` the script applies. It does not check the country (`ALLOWED_COUNTRIES` at the top of the script is empty), and it looks back a fixed 90 days for your person in a thread (`PERSON_LOOKBACK_DAYS`). If your rules say otherwise, ask Claude Code to change those two lines.
5. **First email.** It sends the first email from the template in `templates/en/first-email.md`, from the sales rep's mailbox.
6. **Follow-ups.** It sends `follow-up-1.md` and `follow-up-2.md` on the fixed days in `email.follow_up_days`.
7. **Stop.** It stops the follow-ups for a company on a booking, on a reply, or on a refusal. The script does not read a reply for meaning. Any reply stops the follow-ups and goes to a person as "New reply". The one exception is a short list of plain refusal words (such as "unsubscribe" or "not interested", in `REFUSAL` at the top of `signup-flow.mjs`): a reply that matches one closes the card as "No fit". An autoresponder is logged and does not stop the sequence.
8. **Log.** It writes every step on the card, in the fixed shapes of `board/note-shapes.md`: `found-out`, `draft` (only while the flag file is missing), `sent`, `reply`, `booking`, `next-step`, `alarm`. A card is created for a company the first time it passes the Check part. The sent note also carries a `Message-Id:` line, the id the mailbox returned, which the daily check uses to tell the AI agent's emails from a colleague's.

Every run also obeys `email.sending_days`, `email.sending_hours`, `email.timezone` and `email.daily_cap` from `rules/settings.yml`, and the flag file: while `SENDING_ON` is missing, it reads, checks and logs, and sends nothing. Instead of sending, it writes a `draft` note with the email as it would go out and sets the label "Draft ready". Nobody approves those drafts one by one: you approved the templates once, and the drafts only show what the script would have sent. When the owner creates the flag file, the next run sends what is due.

## What it never does

- It never answers a reply. It flags the reply on the card, with the label "New reply" and a `reply` note holding it in full, for a person or for the AI agent in way A or B to answer.
- It never writes to a company where your person is already talking. The Check part runs before the first email and before every follow-up.
- It never sends while the flag file is missing. It writes drafts on the cards instead.
- It never sends the same email twice. Before each send it writes a line to `runs/sent-log.jsonl` (one line before the send, one after it, one after the card note). If the card note fails, for example because GitHub is down, the next run finds the email in that file, does not send it again, and writes the missing note from the file. If the file says a send was started but not finished, the next run writes an `alarm` note instead of guessing. Keep that file: it is the only local record of what the script sent.
- It never invents a field. If a template placeholder has no value, it skips the email and writes an `alarm` note.
- It never prints a key, and never puts one on a card.
- It never uses a model. Nothing in it calls an AI service.

## Run it

```
node engine/way-c-scripts/signup-flow.mjs --help       usage and the full list of options
node engine/way-c-scripts/signup-flow.mjs              a dry run
DRY_RUN=0 node engine/way-c-scripts/signup-flow.mjs    a real run
```

`DRY_RUN=1` is the default. A dry run reads fixtures from `scripts/fixtures/`, writes nothing and prints what it would have done. Read that output before you switch to `DRY_RUN=0`.

A first real run: keep the flag file missing, so the script checks and logs but sends nothing. Open the cards it made. Then the owner creates the flag file.

## The templates

The first email and the two follow-ups are plain text files in `templates/en/`. Each has a `Subject:` line, a blank line and the body, under 100 words, ending with a next step. The approval stage does not apply to this way: you approve the templates once, here, and the script sends exactly their text.

The files in `templates/en/` hold no company wording. Where your product name and one fact about it belong, they hold a `[Fill-in mark]`, and the script refuses to send a template that still has one. Write your own wording from `knowledge/` (never a fact that is not there). The wording of the example company is in `examples/northstar/templates/en/`, and a dry run on the example rules reads it from there.

Placeholders are written as `{{name}}` and filled from the lead and the settings:

| Placeholder | Filled from |
|---|---|
| `{{first_name}}` | The sign-up |
| `{{company}}` | The sign-up, or the company record from Apollo |
| `{{signup_date}}` | The sign-up date |
| `{{sender_name}}` | The sales rep whose mailbox sends |
| `{{booking_link}}` | `email.booking_link` in `rules/settings.yml` |

The number of follow-ups is the smallest of three numbers: `email.follow_ups` minus one (the first email counts toward the limit), the number of days in `email.follow_up_days`, and the number of follow-up templates. With the three templates in this folder and `follow_ups: 3`, the script sends the first email and two follow-ups.

To add a language, add a folder next to `en/` with the same three file names and set `language` in `rules/settings.yml`.

## The schedule

Every two hours: see `crontab.example`. On your computer, use `cron` (the scheduler built into Mac and Linux) on a Mac or Linux and Task Scheduler on Windows. On a computer, the scripts stop when the computer sleeps. On a server they keep running.

## What the AI agent does around it

The AI agent stays on duty in Claude Code. It reads the logs and the cards to repair what broke, puts the fix on the server, and writes your report (`.claude/skills/owner-report/SKILL.md`). Way C needs the Claude subscription only for this maintenance.
