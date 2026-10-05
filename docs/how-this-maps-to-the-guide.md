# How this repository maps to the guide

Read the guide in order. This page says, for each section, which file here holds what the section describes. A section is either a file you fill, a file the AI agent reads, or a script you run.

## How you and an AI agent split SDR work

The diagram says who handles each step of one lead: you decide the ICP, the AI agent builds and runs the work, a person answers what the AI agent is unsure of and runs the call. Here the split is written down in two places.

- `rules/03-icp-and-qualification.md`: the ICP you decide.
- `rules/08-approval-and-people.md`: the steps marked "Human" and the names of the people who do them.

## Choose your setup by where leads come from

| Guide | Here |
|---|---|
| Setup 1, you run outbound | `rules/07-launch-rules.md`, `connections/apollo.md`, `zerobounce.md`, `smartlead.md` |
| Setup 2, no outbound yet | `connections/explee.md` |
| Setup 3, leads come in on their own | `connections/mailbox.md`, `connections/signups.md`, `engine/way-c-scripts/` |
| The choice itself | `setup:` in `rules/settings.yml` |

## The seven parts of every setup and their monthly cost

| Part | Here |
|---|---|
| 1. Rules | `rules/` |
| 2. Product knowledge | `knowledge/` |
| 3. Board | `board/`, `.github/ISSUE_TEMPLATE/` |
| 4. Where the AI agent runs | `engine/` |
| 5. Connections | `connections/`, `.env.example` |
| 6. Control | `control/`, `approval:` in `rules/settings.yml` |
| 7. Daily check | `scripts/daily-check.mjs`, `scripts/report.mjs`, `alarms/` |

The monthly cost table is in the guide only. Nothing in this repository costs money; the services it points at do.

## Step 1: Rules and product knowledge

| Guide | Here |
|---|---|
| Rule file 1, what to answer and what to skip | `rules/01-what-to-answer.md` |
| Rule file 2, what to check before writing | `rules/02-what-to-check.md` |
| Rule file 3, who fits and what to ask | `rules/03-icp-and-qualification.md` |
| Rule file 4, how to write | `rules/04-how-to-write.md` |
| Rule file 5, follow-ups and when to stop | `rules/05-follow-ups-and-stop.md` |
| Rule file 6, hard rules | `rules/06-hard-rules.md` |
| Rule file 7, launch rules (setup 1 only) | `rules/07-launch-rules.md` |
| The people and the approval stage | `rules/08-approval-and-people.md` |
| The settings that live here | `rules/settings.yml` |
| Product knowledge | `knowledge/plans-and-prices.md`, `faq.md`, `objections.md`, `have-and-do-not-have.md` |
| Case studies and one-pagers | `knowledge/materials/` |
| Writing the first version | `.claude/skills/draft-rules-from-threads/SKILL.md` |
| A filled model | `examples/northstar/rules/`, `examples/northstar/knowledge/` |

## Step 2: The board, one card per company

| Guide | Here |
|---|---|
| The card opens with the lead's record | `board/card-template.md`, `.github/ISSUE_TEMPLATE/lead-card.md` |
| Dated notes in a fixed shape | `board/note-shapes.md` |
| Statuses | `board/labels.yml`, `scripts/board-labels.mjs` |
| GitHub Projects and the phone app | `board/project-layout.md` |
| The signal on the card | `knowledge/materials/README.md`, `connections/shortio.md` |
| The AI agent's own identity | `scripts/gh-app-token.mjs` |
| Start from the template | This repository. The first run is `.claude/skills/first-run-setup/SKILL.md`. |
| Real cards, one per label | `examples/northstar/cards/` |

## Step 3: Where the AI agent runs

| Guide | Here |
|---|---|
| The one instruction | `engine/run-instruction.md`, quoted in `CLAUDE.md` |
| Way A, on a server, on a timer | `engine/way-a-server/` |
| Way B, Claude Code on your computer | `engine/way-b-local/` |
| Way C, scripts on a schedule | `engine/way-c-scripts/` |
| The three ways side by side | `engine/README.md` |

## Step 4: Connections

| Guide | Here |
|---|---|
| The connections table | `connections/README.md` |
| One file per key | `connections/github-app.md`, `apollo.md`, `zerobounce.md`, `smartlead.md`, `explee.md`, `mailbox.md`, `crm.md`, `calendly.md`, `shortio.md`, `slack.md`, `signups.md` |
| One line per key in the settings file | `.env.example` |
| Material on request | `knowledge/materials/` |
| Two rules for keys | `connections/README.md`, and the "Keys" section of `CLAUDE.md` |

## Step 5: Control

| Guide | Here |
|---|---|
| Three stages of approval | `control/README.md`, `approval.stage` in `rules/settings.yml` |
| The waiting list for stage 2 | `rules/08-approval-and-people.md` |
| The stop switch | The file `SENDING_ON`, `sending_flag_file` in `rules/settings.yml`, `control/README.md` |
| The one rule you never loosen | `rules/06-hard-rules.md`, `rules/02-what-to-check.md`, the label `Our person is in the thread` |

## Step 6: The daily check, the report and the people

| Guide | Here |
|---|---|
| The daily check | `scripts/daily-check.mjs`, `scripts/README.md` |
| An alarm names the lead and the card | `alarms/YYYY-MM-DD-daily-check.md`, or the Slack alarms channel |
| The report | `scripts/report.mjs`, `.claude/skills/owner-report/SKILL.md` |
| The people behind the steps | `rules/08-approval-and-people.md` |
| Tests for all of it | `scripts/selftest.mjs`, run on every push by `.github/workflows/check.yml` |

## Launch checklist

`docs/launch-checklist.md`: the same table as the guide, as boxes you tick.
