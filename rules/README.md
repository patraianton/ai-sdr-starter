# Rules

Step 1 of the guide: write the SDR's job down as a few short plain-text files.

This folder is the template. Each file has its headings, a short explanation under each heading, one example line in an HTML comment, and an empty list for your lines. Fill the lists. Delete the example comments when you no longer need them. A filled copy for a made-up company is in [`../examples/northstar/rules/`](../examples/northstar/rules/); open it when you want to see how a finished file reads.

The AI agent reads every file in this folder before every run. Change one line, and the next run behaves differently. Nothing is programmed. An instruction given in chat is gone with the next session; a line in a file stays.

## The files, in the order to write them

| File | What it holds | Needed in |
|---|---|---|
| [`settings.yml`](settings.yml) | The small settings, one line each: email length, follow-ups, sending days and hours, tone, language, booking link, size floor, daily cap, who approves | every setup |
| [`01-what-to-answer.md`](01-what-to-answer.md) | What the AI agent answers, what it skips, what it parks | every setup |
| [`02-what-to-check.md`](02-what-to-check.md) | The checks before the first reply and before every follow-up | every setup |
| [`03-icp-and-qualification.md`](03-icp-and-qualification.md) | Who fits, who never fits, and the questions to get answered before the booking link | every setup |
| [`04-how-to-write.md`](04-how-to-write.md) | Length, tone, language, what is never promised, how a price question is handled | every setup |
| [`05-follow-ups-and-stop.md`](05-follow-ups-and-stop.md) | What stops a follow-up sequence and what each follow-up must add | every setup |
| [`06-hard-rules.md`](06-hard-rules.md) | About a dozen bans that never change per lead or campaign | every setup |
| [`07-launch-rules.md`](07-launch-rules.md) | Apollo filters, suppression lists, volume limits, the bounce rate that pauses the campaign | setup 1 only |
| [`08-approval-and-people.md`](08-approval-and-people.md) | The approval stage, the waiting list for stage 2, and the people behind every step | every setup |

The product knowledge, plans and prices, common questions, objections and the "we do not have" list, lives in [`../knowledge/`](../knowledge/). It is a second set of files in the same style.

## How to write a rule file

Write each file as a job description for someone who starts tomorrow and has never seen your company.

- Be specific. Give an example of a lead's message and the action you expect. "A lead writes 'send it over'. Answer in two sentences, ask what is still open, and send no link yet" is a rule. "Use your judgement" is not.
- One idea per line. A line that needs "and" twice is two lines.
- Each file fits on one screen. If a file grows past that, the lines in it are probably two rules.
- Put numbers in [`settings.yml`](settings.yml), not in prose. The scripts read that file, and one edit changes the value everywhere.
- Say what to do, and say what never to do. A ban is a line that starts with "Never".

## How the rules grow

You do not need a perfect first version. Collect the source material (the last months of your SDR's threads, call notes, the list of paying customers, the price page), open Claude Code in this repository, and run the `draft-rules-from-threads` skill. It drafts every file from how your SDR answers, what they skip, what they check, how they write, when they follow up and when they stop. Then you read and correct every draft in one sitting.

After that, the rules grow from mistakes. The AI agent thanks an autoresponder, or invites a former customer to a call. The same day, one line goes into the file that should have caught it. Expect to add lines weekly in the first month, then rarely. Change the one rule that failed, not its neighbours.

## What the rules cannot do

Nothing in this folder can turn sending on. Sending is on only while the flag file named in `settings.yml` exists, and a person creates and deletes that file. The rules may make sending stricter, never looser. See [`../control/README.md`](../control/README.md).
