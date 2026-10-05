# The board: one card per company

Step 2 of the guide. This folder describes the board: the labels, the shape of a card, the shape of every note on it, and how GitHub Projects shows the cards as columns. The cards themselves are GitHub Issues in your private copy of this repository.

## The rule

One card per company. Everything the AI agent does is written on the card, in a dated note, in the same run, before anything else. If it is not on the card, it did not happen.

The card opens with the lead's record (see `card-template.md`): company, domain, contacts, size, industry, country, the campaign or sign-up it came from, the CRM record and the setup. Under it, every action is a note in a fixed shape (see `note-shapes.md`): what the AI agent found out, the draft, the email exactly as sent, the reply in full, the opened link, the booking, what happened on the call and the next step.

## Search before you create

Before the AI agent creates a card, it searches the cards, open and closed, by company domain. The card title always ends with the domain in brackets, so one search finds it:

```
GET /search/issues?q=repo:OWNER/NAME+is:issue+"blueridgehvac.example"+in:title
```

If a card exists, a second person from the same company becomes a new contact line in the record and a `note` or `reply` on that card. A closed card is reopened when the company writes again. GitHub's search index can lag by a minute, so inside one run the AI agent also keeps a list of the cards it created in that run and checks it first.

## The statuses

The status is one label on the card, and a card carries one label at a time. The AI agent moves it along the funnel. The two stop labels at the end are yours. The same list is in `labels.yml`, and the AI agent creates the labels from that file on its first run (`.claude/skills/first-run-setup/SKILL.md`, which runs `scripts/board-labels.mjs`).

The second column is the text of `labels.yml`, word for word. The last column adds detail that GitHub does not show.

| Label | What it means | Who sets it | More |
|---|---|---|---|
| New reply | The card exists or a reply landed. Nothing has been sent yet. | AI agent | |
| Draft ready | The draft waits on the card for approval. | AI agent | Step 5. Once routine replies go out on their own, this lasts seconds. |
| Sent, waiting | The email is out. The follow-up sequence runs. | AI agent | |
| Booked | The meeting is on the calendar. Follow-ups stop, the sales rep takes over. | AI agent | |
| Call held | The calendar or the recording confirms the call. | AI agent | The card records what happened and the next step. |
| Parked | The lead said not now, with a date. The AI agent comes back on that date. | AI agent | |
| No fit | Below the size floor, refused, or wrong person. The card closes. | AI agent | |
| Do not write | Set by a person. The AI agent sends nothing to this company until the label is removed. | A person | It holds in every run. |
| Our person is in the thread | A colleague is talking to this company. The AI agent never writes in that thread again. | A person, or the AI agent when it sees a colleague's message | |

How labels move:

- To move a card, the AI agent removes the old label and adds the new one in the same step. It writes the note for the move first.
- If a person sets a stop label on a card that already has a status label, the stop label wins. On its next run the AI agent removes the other label and writes a `next-step` note saying which label it removed and why.
- "Do not write" stops emails to one company. The switch in `control/README.md` stops all sending. They are different tools.
- A card closes on "No fit". A reply on a closed card reopens it. Every other state stays open.

## The signal on the card

The AI agent sends a requested case study or one-pager as a tracked short link (`connections/shortio.md`). On every run it checks whether the link was opened. The first open lands on the card as a `link-opened` note, and the AI agent writes its next message then, while the lead is warm, not on the follow-up schedule days later. A booking or a sign-up lands on the card the same way, in the run that sees it.

## The AI agent's own identity

Give the AI agent its own identity: a GitHub App (or a separate GitHub account) installed only on this repository. It may read and write issues, and nothing else. Every note shows who wrote it, `AI agent` or a person's name, so the board always shows who did what. A leaked key opens one repository, not your company's GitHub. `connections/github-app.md` shows how to create the App, and `scripts/gh-app-token.mjs` turns its key into a short-lived token for each run.

## Files in this folder

| File | What it holds |
|---|---|
| `labels.yml` | The nine labels, with colors and descriptions. |
| `card-template.md` | The lead record at the top of every card, and the first note. |
| `note-shapes.md` | The fixed shape of each kind of dated note, and the label move that goes with it. |
| `project-layout.md` | GitHub Projects columns and the phone app. |

A filled example of nine cards, one per label, is in `examples/northstar/cards/`.
