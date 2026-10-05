# The shape of a note

Step 2 of the guide. Every action on a card is a dated note in one fixed shape. A fixed shape lets a person read a card in seconds and lets a script find what it needs: the daily check looks for a `reply` note by address and domain, and the report looks for the first `sent` note to know when the AI agent first wrote to a company.

## The header line

```
**2026-03-04 09:12 · AI agent · reply**
<body>
```

- Date and time: `YYYY-MM-DD HH:MM`, in the timezone from `rules/settings.yml`. The date is always ISO.
- Writer: `AI agent`, or a person's name. When a person corrects or approves a draft in the Claude Code window, the AI agent still writes the note, and the body says who approved.
- Kind: one of the eleven kinds below.
- The first note is in the issue body. Every later note is its own comment.

## The kinds

| Kind | When it is written | The label move that goes with it |
|---|---|---|
| `found-out` | After the checks and the company lookup | None, or "Our person is in the thread", "No fit" or "Booked" if the check says so |
| `draft` | When a draft is written and waits | "Draft ready" |
| `sent` | The moment an email leaves | "Sent and waiting" |
| `reply` | When a reply is read | "New reply" |
| `link-opened` | The first time a lead opens a tracked link | None, the next message follows |
| `booking` | When a booking is matched to the card | "Booked" |
| `call-held` | When the calendar or the recording confirms the call | "Call held" |
| `next-step` | When something is parked, stopped or planned | "Parked" if there is a date |
| `handover` | When a person must act | None |
| `alarm` | When something is wrong or must be reviewed | None |
| `note` | A person's free note | None |

## The body of each kind

Write the lines in this order. A line with nothing to say stays, with `none` after it, so a reader sees that it was checked.

### found-out

```
**2026-03-04 09:12 · AI agent · found-out**
Customer check (CRM, by domain): not a customer, no open deal
Our person in the thread (CRM, mailbox, calendar, card): none found
Booking on the calendar: none
Company (Apollo): 42 technicians, HVAC, United States
Verdict: fits. Answer the pricing question, ask the three qualification questions.
```

### draft

```
**2026-03-04 09:40 · AI agent · draft**
To: name@company.example
Subject: Re: the original subject
Waits for: <approver name> (stage 1)
Material: <piece id> / <short URL> / <idString> (or "none")

<the email, in plain text, exactly as it would be sent>
```

The `Material:` line is the one place that ties a short link to its piece and to the link's statistics. It has three parts: the piece id from `knowledge/materials/index.yml`, the short URL, and the `idString` that Short.io returns (`connections/shortio.md`). If the draft carries no link, the line reads `Material: none`.

### sent

`sent` holds the email exactly as sent. Do not shorten it and do not fix it afterwards.

```
**2026-03-04 10:05 · AI agent · sent**
From: sender@northstardispatch.example
To: name@company.example
Subject: Re: the original subject
Approved by: <approver name>, 2026-03-04 10:02 (or "stage 2, routine" or "stage 3")
Follow-up due: 2026-03-07 (or "none")
Material: <piece id> / <short URL> / <idString> (or "none")

<the email, exactly as sent>
```

### reply

`reply` holds the reply in full. Do not summarize. Cut only an unchanged quoted history below the reply, and write `[quoted history cut]` where it was.

```
**2026-03-04 08:57 · AI agent · reply**
From: name@company.example
Subject: Re: the original subject
Thread: Smartlead campaign "Spring HVAC", lead 4821

<the reply, in full>
```

### link-opened

```
**2026-03-06 14:20 · AI agent · link-opened**
Material: <piece id> / <short URL> / <idString>, copied from the `sent` note that carried the link
First opened: 2026-03-06 14:20 (the run that saw the click; the service gives no click time)
Next: a message is written now, not on the follow-up schedule.
```

Short.io's click statistics give totals, not the time of each click (`connections/shortio.md`). So `First opened:` holds the date and time of the run that first saw a click. If you add the call that lists single clicks, write that click's time instead.

### booking

```
**2026-03-05 11:30 · AI agent · booking**
Meeting: 2026-03-09 15:00 (America/New_York), 30 minutes, with <call host>
Invitee: name@company.example
Matched by: email (or company domain, or name)
Created after the AI agent's first email to this company: yes (first sent 2026-03-03)
Qualification answers: fit, task, decision maker (one line each, from the thread)
```

### call-held

```
**2026-03-10 09:00 · AI agent · call-held**
Confirmed by: calendar (or recording link)
What happened: <two or three lines, from the host's note>
Next step: <what, who, by when>
```

If the host left no note and there is no recording, write `What happened: not recorded` and add a `handover` note for the host.

### next-step

```
**2026-03-04 12:00 · AI agent · next-step**
Do: come back with the case study for HVAC companies
On: 2026-06-01 (or "none")
Owner: AI agent (or a person's name)
Why: the lead said they plan their software in June
```

The `On:` date is what the AI agent reads on Parked cards. A card with `On:` set to today or earlier is picked up in the next run. When a sequence ends with no reply, the note reads `Do: nothing, the sequence ended after N unanswered emails`, with `On: none`. The AI agent skips the card from then on, until a reply arrives.

### handover

```
**2026-03-04 12:10 · AI agent · handover**
To: <person's name>
Needs: <the one thing the person must do or answer>
Because: <why the AI agent cannot go on, in one line>
Lead's last message: <short quote, or the date of the reply note>
```

### alarm

```
**2026-03-04 18:00 · AI agent · alarm**
What: <what is wrong or what to review>
Where: <the check, the key or the thread>
Who must act: <person's name, or "AI agent, next run">
```

### note

A person's free note. Same header, and the writer is the person's name.

```
**2026-03-04 16:15 · Sam Okafor · note**
Spoke to the dispatcher by phone. Wants the call on Monday.
```

## Rules for every note

- One action, one note. Do not bundle two emails in one note.
- Never put a key or a password in a note.
- Never rewrite or delete an old note. A mistake is corrected by a new `note` that points to the old one by its date and time.
- A person's comment that is not in this shape is still read by the AI agent. An approval is one such comment: see `rules/08-approval-and-people.md` for how a draft is approved.
