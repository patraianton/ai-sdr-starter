---
name: draft-rules-from-threads
description: Drafts the rule files and the product knowledge files from exported email threads, call notes, the paying-customer list and the price page. Use when the owner has collected the source material and asks to "draft the rules", "write the first version", or "start step 1".
---

# draft-rules-from-threads: the first version of the rules

Step 1 of the guide, "Writing the first version", the part the AI agent does. A person collects the material and a person corrects the drafts. You write the drafts in between.

You write only into `rules/` and `knowledge/`. You do not touch `examples/`, `.env` or the board. You do not send anything.

## 1. Find the material

Ask the owner for the path of one folder that holds the source material. It must sit outside this repository (for example `../sdr-exports/`), because the threads hold real names and addresses and must not be committed. If the owner gives a path inside this repository, stop and say why.

The material is:

- exported threads of the SDR, from the sending service or the mailbox, a few months of them;
- call notes or transcripts, if there are any;
- the list of paying customers (company, size, industry, country, CRM or system, plan);
- the price page, saved as text or a PDF.

Count what is there and say it back: how many threads, how many customers, which pages. If there are no threads or no price page, stop and ask. Do not draft from nothing.

## 2. Read all of it

Read every file in full. Do not sample. Keep a running tally while you read, and write the counts into your summary (for example "14 of 20 threads: the lead asked about price first").

For each thread note: what the lead wrote, what the SDR did (answered, skipped, parked, escalated), how long the answer was, what the SDR checked, when follow-ups went out, and why the thread ended.

## 3. Draft the rule files

Open each file in `rules/` and keep its headings. Under each heading replace the empty bullet list with real lines, written as a job description for someone starting tomorrow: specific, with a lead's message and the expected action, never "use your judgement". Remove the `<!-- example: ... -->` comments only when you have replaced them with real lines. Each file stays on one screen.

| File | Build it from |
|---|---|
| `01-what-to-answer.md` | What the SDR answered, skipped and parked. Quote short lead messages with names and addresses removed. |
| `02-what-to-check.md` | What the SDR looked at before writing: customer status, who else on the team talked to the company, bookings. Add the lookup of size, industry and country. |
| `03-icp-and-qualification.md` | The paying-customer list. Group customers by size, industry, country and CRM. The segments where the revenue sits are the ICP, not the segments that reply most. Add a size floor, hard disqualifiers, and three or four qualification questions drawn from what the SDR asked before booking. |
| `04-how-to-write.md` | The SDR's usual length, tone and language handling. How a price question was handled. How every email ended. |
| `05-follow-ups-and-stop.md` | The days between emails, what each follow-up added, and why threads ended. The stop reasons: booking, sign-up, explicit no, no-show, the limit of unanswered messages. |
| `06-hard-rules.md` | About a dozen lines, each starting with "Never" or "Always". Turn each check from `02` into a ban. Keep the lines already in the template. Add one for every mistake you saw in the threads. |
| `07-launch-rules.md` | Setup 1 only. The Apollo filters that express the ICP, the suppression lists to load, and the launch numbers. Leave the numbers empty if the threads do not show them. |
| `08-approval-and-people.md` | Leave the names empty unless the material names them. Never invent a person. |

## 4. Draft the product knowledge

| File | Build it from |
|---|---|
| `knowledge/plans-and-prices.md` | The price page, word for word for every price and limit. |
| `knowledge/faq.md` | Questions leads asked in two or more threads, each with the answer the SDR gave, checked against the price page. |
| `knowledge/objections.md` | The objections the SDR heard most, each with the answer that worked. |
| `knowledge/have-and-do-not-have.md` | Features the threads or call notes confirm. Fill the "do not have" list only from what a lead asked for and the SDR said the product lacks, or from what the owner says. |
| `knowledge/materials/index.yml` | The case studies and one-pagers the SDR sent: an id, a title, the audience (industry or system) and the public URL. |

## 5. Settings

Open `rules/settings.yml`. Propose a value for each small setting from what the SDR actually did: email length, follow-up days, sending days and hours, tone, the size floor. Write the value, and add a comment `# proposed from the threads, check`. Leave `approval.*` names empty unless the material names the person. Do not set `stage` above 1.

## 6. Mark every guess

Anywhere you are unsure, add `<!-- check: <what you are unsure about and why> -->` on the line. A line with no evidence in the material does not go in. Never write a price, a feature, a customer name or a number about a lead's company that is not in the material.

## 7. Hand back for correction

Reply with:

1. The files you wrote, one line each.
2. The counts behind the main rules.
3. Every `check` marker, as a numbered list of questions.
4. The things you could not find in the material (names for `08`, a "we do not have" list, launch numbers).

Then say: the next step is a person's. Read and correct every draft in one sitting. Then fill in `setup`, `engine` and the four names under `approval:` in `rules/settings.yml`, and the approver's name and GitHub login in `rules/08-approval-and-people.md`. `first-run-setup` refuses to run until those are filled. After that, run `first-run-setup`.

## Stop conditions

Stop and ask, without drafting, when: the material is inside this repository; there are no threads; the price page is missing; the threads are not in the language the owner expects and you cannot read them.
