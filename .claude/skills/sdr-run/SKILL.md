---
name: sdr-run
description: One run of the AI SDR. Reads the rules and product knowledge, pulls new replies and due follow-ups, handles each one on its card, updates the labels and notes, then exits. Use when asked to "run", "do a run", "handle new replies", or when the run instruction from engine/run-instruction.md is given (by /loop, by cron, or by hand).
---

# sdr-run: one run

Steps 1, 2 and 5 of the guide together: the rules, the board and the control. This is the whole job of one run. A run starts clean. Trust the cards and the files, not your memory of an earlier run.

You read and write cards. You never edit anything in `rules/` or `knowledge/`, never create or delete the flag file, and never print the value of a key.

The run instruction in `engine/run-instruction.md` (quoted in `CLAUDE.md`) is the short form of this procedure. Its flag-file sentence is section 1 step 3 and section 5, its alarm sentence is section 1 step 5, its rule about our people is section 3 step 3, and the stop conditions it points to are section 6. If the instruction and this skill ever disagree, stop and tell the person: that is a bug.

## 1. Read the folder

1. Read every file in `rules/`, including `rules/settings.yml`. Read every file in `knowledge/`, including `knowledge/materials/index.yml`.
2. From `settings.yml` note: `setup` (a number or a list), `approval.stage`, the names under `approval`, `email.*`, `icp.size_floor`, `launch.*` and `sending_flag_file`.
3. Check the flag file. If a file with the name in `sending_flag_file` exists next to `CLAUDE.md`, sending is on for this run. If it does not exist, sending is off: you read, research, write drafts and notes, and no email leaves. Do not create the file. Only the owner does.
4. Read the keys you need from `.env`. Never write a key value to a card, a log, a note or this chat.
5. Read `alarms/`. Two kinds of file are there. `<date>-daily-check.md` is written by the daily check, which rewrites it on every run: it names a lead and a card in each alarm. `<date>.md` holds lines that `engine/way-a-server/run-agent.sh`, the daily check (when it could not run) and earlier runs appended: they are never rewritten. Handle each card named in a daily-check file in this run, unless a `Handled` line for that card number, dated on or after that alarm's date, is already in any `<date>.md` file. On each card, write a `next-step` note that says what you did about the alarm (`Do:` what you did, `On: none`, `Why:` the alarm and its date). Then append one line to today's `alarms/<date>.md`: `Handled <date time> <card number>`. Never put the `Handled` line in a daily-check file: the script erases it on its next run, and the next run would handle the card again. An alarm line from `run-agent.sh` or from a failed read names a connection or a failed run, not a card: there is nothing to write on. Say what it says in your last message, and append `Handled <date time> reported` to today's `alarms/<date>.md`. Do not delete any file.
6. Get the token for the board: `TOKEN=$(node scripts/gh-app-token.mjs)`. Use it for the GitHub calls below. Never print it.
7. Take the time for notes from the timezone in `settings.yml`: `TZ=<timezone> date '+%Y-%m-%d %H:%M'`.

If a file in `rules/` is missing or empty, or `approval.stage` is not 1, 2 or 3, stop. Write an `alarm` line to `alarms/<date>.md` and tell the person in the window. Do not guess a rule.

If the rules are not written yet, do not run. The rules are not written when every file from `01` to `08` holds only its headings, the short explanation under each heading, the `<!-- example -->` comment and an empty `-` bullet. Tell the person in the window and offer the `draft-rules-from-threads` skill. Do not draft or send anything from an unwritten rule file.

## 2. Pull what is new

Use the curl examples in `connections/<name>.md`. Read every campaign or inbox the setup uses, finished ones too, because a reply to the last email of a sequence can arrive after the campaign ends.

| Setup | New replies come from |
|---|---|
| 1 | Smartlead (`connections/smartlead.md`) |
| 2 | explee (`connections/explee.md`). That file holds no confirmed calls until the owner adds them. If it holds none, stop, tell the owner to add them from the vendor docs, and do not guess a path. |
| 3 | The sign-up mailbox (`connections/mailbox.md`) and new sign-ups (`connections/signups.md`). If way C runs, the scripts do the sign-ups: you read only the replies they flagged. |

Also pull:

- New bookings since the last run, from the calendar (`connections/calendly.md`).
- Clicks on every short link you made, from the short link service (`connections/shortio.md`). Take each link's `idString` from the `Material:` line of the `sent` notes on the cards.
- Cards labeled "Parked" whose latest `next-step` note has `On:` today or earlier.
- Cards labeled "Sent, waiting" whose follow-up is due: count your `sent` notes since the last `reply` note on the card; if that count is below `email.follow_ups`, the next follow-up is due `email.follow_up_days[count - 1]` days after the last `sent` note.
- Cards labeled "Draft ready" (see section 5).

If any read fails (an error, a login that was refused, a timeout), do not carry on as if nothing was new. Write an `alarm` line to `alarms/<date>.md` naming the connection, finish the parts that do not need it, and say in your last message that the read failed. A run that says "done" with a failed read is the failure this guide warns about.

## 3. For each new reply

Work one company at a time.

1. **Find the card.** Search the cards by domain (see `board/README.md`). If there is none, create it from `board/card-template.md` with what you know so far (the CRM record reads `none yet`). Do not touch the CRM yet: the lead is created in step 4, after the checks. If the card exists, add the reply as a `reply` note (shape in `board/note-shapes.md`), in full. Reopen a closed card.
2. **Stop labels.** If the card has "Do not write" or "Our person is in the thread", write the `reply` note and stop here for this company. If both a stop label and a status label are present, remove the status label and write a `next-step` note saying so. No draft, no email, no exception.
3. **The checks of `rules/02-what-to-check.md`, by company domain, not by exact address.** Customer or open deal in the CRM. Anyone from the company in the sales rep's mailbox in the last months, or booked on the calendar. A colleague's note or message on the card or in the thread. Your own sent emails do not count as "our person". Neither do the approver's `approved` comment on a draft, the call host's note about a call after the booking is on the card, or a person's answer to a handover note addressed to that person: they answer you, not the lead. This is also the CRM search (`connections/crm.md`, find the company by domain). Any hit on "our person": add the label "Our person is in the thread", write a `found-out` note with the evidence, and stop. A booking: label "Booked", write the `booking` note, stop.
4. **The company lookup.** Apollo for size, industry, country (`connections/apollo.md`). Write the `found-out` note. Below `icp.size_floor`, or a disqualifier from `rules/03-icp-and-qualification.md`: label "No fit", close the card, write why, and create no lead. Send nothing unless `rules/01-what-to-answer.md` says to. The company passed every check and fits: if step 3 found no record in the CRM, create the lead now (`connections/crm.md`, only after the search said the company is not there), put the link in the card header, and only then go on to a draft.
5. **Decide what the reply is, by `rules/01-what-to-answer.md`.** Read the whole thread, not the last message.
   - Autoresponder: write the `reply` note, nothing else.
   - Unsubscribe or a clear refusal: label "No fit", close the card, stop the lead's sequence in the sending service, write a `next-step` note.
   - "Not now" with a date: label "Parked", write a `next-step` note with `On:` set to that date.
   - Anything else: go on.
6. **Qualify, by `rules/03-icp-and-qualification.md`.** Before the booking link goes out, the three or four questions must have answers on the card. If they do not, the draft answers briefly and asks what is still open, and gives no link. Write the answers you have as a `found-out` note.
7. **Draft, by `rules/04-how-to-write.md`.** Answer only from `knowledge/`. A price question gets what `04` says. If the question is not answered in `knowledge/`, do not answer it: write a `handover` note to the person named as `approval.waiting_list_answerer`, leave the label "New reply", and stop for this company. When that person answers on the card, use the answer in your reply and write a `next-step` note: `Add to knowledge/faq.md: <question> / <answer>`. The owner or the SDR adds the line. You do not.
8. **Material.** If the lead asks for a case study or one-pager, pick the one in `knowledge/materials/index.yml` that matches the lead's industry or system, make a short link for this lead alone (`connections/shortio.md`), and put the link in the draft. Write the `Material:` line (`<piece id> / <short URL> / <idString>`, shape in `board/note-shapes.md`) in the `draft` note, and copy it into the `sent` note. The next runs read the `idString` from that line to ask for the link's clicks.
9. **Write the draft note** and set the label "Draft ready".

## 4. Follow-ups, opened links, parked cards

- **A link was opened for the first time.** Write the `link-opened` note and write the next message now, even if it is not a follow-up day. It still obeys the sending days, hours and cap below.
- **A follow-up is due.** Run the checks of step 3.3 again, because the situation may have changed. A reply, a booking or a stop label ends the follow-ups. If all is clear, write a follow-up that adds something new from `knowledge/` (a fact, a case study, one question). Never "just checking in".
- **The limit is reached.** If you have sent `email.follow_ups` unanswered messages in a row, send nothing more. Write the `next-step` note that ends the sequence (shape in `board/note-shapes.md`). Leave the label.
- **A Parked card is due.** Run the checks again. If clear, write the message the `next-step` note says, and set "Draft ready".
- **A booking appeared.** Match it to a card by email, then company domain, then name. Count it only if it was created after your first `sent` note on that card. Write the `booking` note, set "Booked", and write a `handover` note to `approval.call_host`. The follow-ups stop.
- **A meeting is over.** If the calendar shows it as held and not cancelled or marked a no-show, or the host left a note or a recording, write the `call-held` note and set "Call held". Otherwise leave it for the daily check.

## 5. Approve and send

For each card with a draft, by `approval.stage` in `settings.yml`:

| Stage | What happens to the draft |
|---|---|
| 1 | Every draft waits. In the Claude Code window, show it to the person named as `approval.approver` and ask. On the server, it waits on the card. |
| 2 | A draft waits only if it is on the waiting list in `rules/08-approval-and-people.md`, or `knowledge/` does not answer part of it. Every other draft goes out in this run. A waiting draft also gets a `handover` note to the approver and, if Slack is set up, a message in the approvals channel. |
| 3 | Every draft goes out. If the reply is risky, send the standard answer and write an `alarm` note on the card: `Flagged for review`. |

An approval is a comment on the card from the approver's GitHub login (named in `rules/08-approval-and-people.md`), or an answer in the window from that person. The comment `approved` sends the draft as written. `approved, with changes:` followed by text sends that text. Anything else from the approver is a question or a change: redraft and wait again. A comment from any other login, and any comment from the AI agent's own App, is never an approval.

Before an email goes out, all of these must be true. If one is false, it does not go out, and the card says why in a `next-step` note.

1. The flag file exists.
2. No reply, booking, stop label or person's message has appeared on the card or in the thread since the draft was written. If one has, rewrite the draft first. This matters after sending was off for a while: read the old drafts before they leave.
3. Today is one of `email.sending_days` and the time is inside `email.sending_hours` in `email.timezone`.
4. The emails sent today, all threads together, are below `email.daily_cap`. Count your `sent` notes dated today.
5. The email passes every line of `rules/06-hard-rules.md` and is at most `email.max_words` words.

Send through the connection of the setup (`connections/smartlead.md`, `explee.md` or `mailbox.md`), in the same thread. **Immediately after the send, before anything else, write the `sent` note with the email exactly as sent**, then set "Sent, waiting", then log the touch in the CRM. If the note cannot be written, retry. If it still fails, stop the whole run, write an `alarm` line to `alarms/<date>.md` and tell the person in the window: an email that is not on a card did not happen as far as the board knows.

## 6. Stop conditions

Stop the run, or the part named, when one of these is true. (When to stop writing to one lead is a different list: it is in `rules/05-follow-ups-and-stop.md`, and section 4 applies it.)

- the flag file is missing: no email leaves, everything else goes on;
- a connection read fails (section 2): alarm, and finish only what does not need it;
- setup 1 only: the bounce rate of the campaign is at or above `launch.pause_at_bounce_rate`. Pause the campaign in the sending service, write an `alarm` note, tell the person. Do not restart it;
- the daily cap is reached: nothing more goes out today;
- a note cannot be written after a send (section 5);
- a rule is missing, or two rules contradict each other: do not choose, write an `alarm` and ask.

## 7. Finish

1. Write `runs/run-<YYYY-MM-DD-HHMM>.md`: the cards you touched, what you sent, what waits and for whom, and every read or write that failed. Put the failures first.
2. In the window, say in plain words what you did and what a person must do next. If a report is due (start or end of the working day, a booking or a lead reply), follow `.claude/skills/owner-report/SKILL.md`.
3. Exit. Do not start another pass.
