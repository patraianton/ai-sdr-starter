---
name: owner-report
description: Writes the one report the owner reads. First line is calls booked and held, then one row per booking, then the replies waiting for a person. Never the number of emails sent. Use at the start and end of the working day, when a call is booked or a lead replies, or when asked for "the report".
---

# owner-report: the report

Step 6 of the guide. The job is to book calls, so the report leads with calls. The number of emails sent is not a result and never appears.

The cards on the board and the calendar are the truth. `scripts/report.mjs` builds the same report with no model inside, for a schedule; if both are run and the numbers differ, trust the cards, write an `alarm` line to `alarms/<date>.md` naming the difference, and use your own numbers.

## 1. Collect

1. Read the date of the last report: the newest `runs/report-*.md`. If there is none, use 7 days back, the same default as `scripts/report.mjs`. Call this the since-date.
2. Read the cards (issues) with the labels "Booked" and "Call held", and every card with a `booking` note dated on or after the since-date.
3. Read the calendar for the same period (`connections/calendly.md`).
4. Read the cards labeled "New reply" and "Draft ready", and every card with an open `handover` note.

## 2. Count

- **Booked.** Count a booking only if it was created after the AI agent's first `sent` note to that company. A booking that was already on the calendar before, or one made by a person, is not counted.
- **Held.** Count a call as held only if the calendar or a recording confirms it. A card with no confirmation is not held. Silence never counts as a held meeting. A call that ended more than one working day ago with no recording and no note is written in its row with the status `NO-SHOW`.
- Zero is written as zero.

## 3. Write the report

Use exactly this shape. It is the shape `scripts/report.mjs` prints, so a report you write and a report the script builds read the same. The example below is that script's output on the fixtures of this repository (`node scripts/report.mjs`).

```
Calls booked: 2 · held: 1 (since 2026-03-02)

Bookings
1. Northwind Mechanical (card #5, https://github.com/example-owner/ai-sdr-starter/issues/5)
   Meeting: Mon 2026-03-09 11:00 America/New_York with Dana Reyes. Status: held.
   The lead asked: "I read the one-pager. We have 3 dispatchers. I decide together with our controller. Can we talk?"
   The AI agent answered: "Thanks. Three dispatchers on Fleet, with your controller on the call, is a good group for it. Dana Reyes runs the call and can walk through the QuickBooks sync."
   A person must: Dana holds the next call with Pete on 2026-03-16 at 10:00 America/Chicago

2. Sunbelt Appliance Repair (card #4, https://github.com/example-owner/ai-sdr-starter/issues/4)
   Meeting: Tue 2026-03-10 14:00 America/New_York with Dana Reyes. Status: NO-SHOW.
   The lead asked: "We run about 120 technicians out of Phoenix and Tucson. The first thing to fix is reassigning jobs when a tech runs over, because our dispatchers do it by phone and overtime is the result. We are on QuickBooks Online."
   The AI agent answered: "Thanks, that is clear. With 120 technicians you would be on Fleet, because Crew stops at 10 technicians. Fleet includes route optimization and QuickBooks sync."
   A person must: No recording and no note: counted as a no-show. Dana Reyes confirms on the card, or decides whether to rebook.

Replies waiting for a person: 3
- Granite State Electric (card #8, https://github.com/example-owner/ai-sdr-starter/issues/8): waited 5 d 1 h (weekends not counted) on Priya Natarajan
- Harbor Plumbing Co. (card #2, https://github.com/example-owner/ai-sdr-starter/issues/2): waited 4 d 23 h (weekends not counted) on Sam Okafor
- Gulf Coast Cooling (card #9, https://github.com/example-owner/ai-sdr-starter/issues/9): waited 1 d 21 h (weekends not counted) on Dana Reyes
```

Rules for the shape:

1. The first line is `Calls booked: N · held: M (since <date>)`. Nothing above it.
2. Under the heading `Bookings`, one numbered row per booking: the company and its card, then four labeled lines in this order: `Meeting:` (the time, the host and the status: held, upcoming, ended and not confirmed yet, or NO-SHOW), `The lead asked:`, `The AI agent answered:`, `A person must:`. Name the person. With no booking, write `Bookings: none in this period.`
3. `Replies waiting for a person: N`, then one line for each reply or draft that waits for someone: the company and its card, how long it has waited (weekends not counted) and who it waits on. If nothing waits, write `Replies waiting for a person: 0` and no lines.
4. Do not write how many emails went out, how many leads were contacted, or how many replies came in. If asked for those, answer in chat, not in the report.
5. Plain words, short sentences, no adjectives about how well things went.

## 4. Deliver

- Save it to `runs/report-<YYYY-MM-DD>.md` (add the time if it is the second one of the day).
- Team mode (Slack is set up): post it to the channel in `SLACK_CHANNEL_CARDS` (`connections/slack.md`).
- Way B: print it in the Claude Code window. Also post it as a comment on the open issue titled `Reports`, creating that issue once if it does not exist, with no status label.
- It goes out at the start and the end of the working day. It also goes at once when a call is booked or a lead replies. That instant report is the first line, the one row, and the waiting line, nothing else.

## Stop conditions

Stop and write an `alarm` line instead of a report when the cards or the calendar could not be read. A report built on a failed read is a claim, not proof.
