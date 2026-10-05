# Example: Northstar Dispatch

Step 1 and step 2 of the guide, filled in. This folder is the same template as `rules/`, `knowledge/` and `board/` at the top of the repository, completed for one made-up company, so you can see what finished files and a working board look like before you write your own.

This folder is a model. Never answer a lead from this folder, and never copy a fact, a price or a name from it into a draft.

Northstar Dispatch sells scheduling and dispatch software to field-service companies (HVAC, plumbing, electrical, appliance repair) in the US and Canada. Everything here is fictional. Every web address ends in `.example`, a domain that is reserved for documentation and never resolves. The people are made up, the prices are made up, and no real company appears.

## What is filled

| Folder | What is in it | Guide step |
|---|---|---|
| `rules/settings.yml` | The small settings with real values: approval stage 1, 120-word emails, three emails in a row at most (the first email and 2 follow-ups, on days 3 and 7), a size floor of 15 technicians. | Step 1 |
| `rules/01` to `08` | The eight rule files, 8 to 20 lines each, written as a job description for someone starting tomorrow. | Step 1 |
| `knowledge/` | Plans and prices, 15 questions with answers, 9 objections with answers, the "we have" and "we do not have" lists, and the material list with five pieces: three case studies and two one-pagers. | Step 1 |
| `cards/` | Nine sample cards, one for each state a card can be in. | Step 2 |

The people: Priya Natarajan is the owner and holds the stop switch. Sam Okafor is the SDR who approves every email at stage 1 and answers the waiting list. Dana Reyes is the sales rep who hosts the calls.

## How to use it as a model

1. Read `rules/06-hard-rules.md` first. It is short, and it holds the bans that no other file may loosen.
2. Open a rule file next to the same file in the top-level `rules/` folder. The headings are the same. The template shows what goes under each heading, this folder shows a finished version.
3. Read three cards: `cards/04-sunbelt-appliance-repair.md` for a full thread from sign-up to booking, `cards/09-gulf-coast-cooling.md` for the rule you never loosen, and `cards/03-maple-electric-ltd.md` for a link opened and the next message written that run.
4. Write your own rules in the top-level `rules/` folder. Do not copy the Northstar facts: its prices, plans and "we do not have" list belong to a company that does not exist.

## The nine cards

Each file is one card. The block at the top (between the two `---` lines) holds the issue title, its label and whether it is open or closed. Below it comes the lead's record as a table, a line, and the first note. Every later note sits under `## Comments`, one `### comment` section per note, in the same shape as on the board: `**date time · writer · kind**`, then the lines of that kind from `board/note-shapes.md`, in the pinned order. An approval is the one comment that is not a note: it is a `### comment (sokafor-ns)` section whose text is exactly `approved`, from the approver's GitHub login named in `rules/08-approval-and-people.md`. The `sent` note that follows says `Approved by: Sam Okafor` with the time. Times are Eastern, the time zone in `settings.yml`. All dates are in March 2026.

| File | Label | Setup | What it shows |
|---|---|---|---|
| `01-blue-ridge-hvac.md` | New reply | 1 | A reply to the outbound sequence, the checks, the HubSpot lead created before the first email, no draft yet. |
| `02-harbor-plumbing-co.md` | Draft ready | 1 | A draft that answers a price question with the public page and waits for Sam at stage 1. |
| `03-maple-electric-ltd.md` | Sent, waiting | 1 | A sent email approved by Sam, a link opened, the next message written that run, and the follow-up days. |
| `04-sunbelt-appliance-repair.md` | Booked | 3 | A trial sign-up, three qualification answers, a booking matched from Calendly and the handover to Dana. |
| `05-northwind-mechanical.md` | Call held | 1 | A one-pager link opened, a booking, the calendar confirming the call and Dana's note with the next step. |
| `06-prairie-comfort-heating.md` | Parked | 1 | "Not now" with a reason, and the date the AI agent comes back: 2026-06-01. |
| `07-cedar-valley-services.md` | No fit (closed) | 1 | Nine technicians, below the floor of 15, and the one short answer a company below the floor gets. |
| `08-granite-state-electric.md` | Do not write | 1 | Priya sets the label for a partner relationship, and the AI agent logs why it sent nothing. |
| `09-gulf-coast-cooling.md` | Our person is in the thread | 1 | Dana is already talking to the company. The match is by domain, so the AI agent stops and hands over. |

Each card becomes one GitHub issue: the title is the issue title, the label is the issue label, and the body and comments are posted as written.

## Notes on the example

- The setups: `settings.yml` says `setup: [1, 3]`. Outbound runs through Apollo, ZeroBounce and Smartlead, and trial sign-ups come in as well. Both go through the same AI agent, which runs on way B (Claude Code on Sam's computer).
- In setup 1 the emails go out from the campaign mailboxes on `getnorthstar.example` and are signed "Sam". In setup 3 they go out from Dana's mailbox and are signed "Dana". Each `sent` note says which.
- Every email is plain text, under 120 words, ends with one next step and uses the booking link `https://calendly.com/northstar-dispatch/intro-call`. Prices come only from `knowledge/plans-and-prices.md`.
