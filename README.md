# ai-sdr-starter

A template repository for an AI SDR: the rule files, the product knowledge, the board, the run instruction for three ways of running it, the scripts, the connections list, the approval stages, a daily check with no model inside, the owner report and the launch checklist. The AI agent is Claude Code. The board is GitHub Issues, one card per company. It is for a business owner or an SDR who knows what an SDR does, and a developer is needed once, for a server or a mailbox. This repository is the template that the guide "How to set up an AI SDR" on [apatrai.com](https://apatrai.com) points to. Press "Use this template", keep your copy private, and follow the guide step by step.

## What is in the box

| Folder or file | What it is | Step of the guide |
|---|---|---|
| `rules/` | The SDR's job as plain text: what to answer, what to check, who fits, how to write, when to stop, hard rules, launch rules, approval and people. Headings and guidance, no company content. `settings.yml` holds the small settings. | Step 1 |
| `knowledge/` | Plans and prices, FAQ, objections, what you have and do not have, and a folder of case studies and one-pagers with an index. | Step 1 |
| `board/` | The nine labels, the card template, the shape of every dated note, the Projects layout. | Step 2 |
| `.github/ISSUE_TEMPLATE/` | A new issue opens as an empty lead record. | Step 2 |
| `.claude/skills/` | `sdr-run`, `first-run-setup`, `draft-rules-from-threads`, `owner-report`. | Steps 1, 2, 3 and 6 |
| `engine/` | The one run instruction, and the three ways: A server on a timer, B Claude Code on your computer, C scripts on a schedule. | Step 3 |
| `connections/` | One file per key: what it is for, where to create it, the smallest scope, the calls the AI agent makes. | Step 4 |
| `control/` | The three approval stages, the stop switch, the one rule you never loosen. | Step 5 |
| `scripts/` | The daily check, the owner report, the label script, the GitHub App token script, the self-test. Node 20, no dependencies. | Step 6 and helpers |
| `docs/` | The launch checklist, and a map from each section of the guide to a file here. | Block 10 and all |
| `examples/northstar/` | The same template, filled for a fictional company, with nine sample cards. | A model to copy |
| `CLAUDE.md`, `AGENTS.md` | The standing instruction for the AI agent when it opens in this folder. | Step 3 |

## Your first evening

This is way B: Claude Code on your computer, no server, no developer. An evening gets you to a first run with sending off. It does not get you to the first email. The checklist in `docs/launch-checklist.md` does that.

1. Press "Use this template" on GitHub. Make your copy **private**. Clone it.
2. Install [Claude Code](https://claude.com/product/claude-code) and sign in. The guide uses a Claude Max subscription on a company email, not an employee's login.
3. Create the AI agent's GitHub App by following `connections/github-app.md`, and check it with `node scripts/gh-app-token.mjs --check`. Then copy `.env.example` to `.env` and fill the keys your setup needs. Leave the rest empty. `.env` is in `.gitignore`.
4. Export the last months of your SDR's threads into a folder **outside** the repository. Add the price page and your customer list. Open Claude Code in the folder and say: "Run the draft-rules-from-threads skill." It drafts `rules/` and `knowledge/`.
5. Read and correct every draft in one sitting. Then fill in the names the AI agent leaves empty: the four names under `approval:` in `rules/settings.yml` (approver, waiting-list answerer, call host, switch owner), the approver's GitHub login in `rules/08-approval-and-people.md`, and `setup` and `engine`.
6. Say: "Run the first-run-setup skill." It creates the nine labels from `board/labels.yml`, checks every key with a read-only call (for explee and the sign-ups you add that call yourself, from the vendor docs) and runs once with sending off. It refuses to run while the settings or the rules are still empty, so do steps 4 and 5 first.
7. Do not create the file `SENDING_ON`. Without it nothing leaves. Handle one real reply and read the draft and the notes on its card.
8. When you are ready, type `/loop 10m` followed by the run instruction from `engine/run-instruction.md`. The AI agent repeats it while the window is open.

## The three setups

One question picks the setup: where do your leads come from today?

| | Setup 1 | Setup 2 | Setup 3 |
|---|---|---|---|
| Where leads come from | You run outbound | No outbound yet | They come in on their own |
| You must already have | Mailboxes, contact data, verification, sending | A paid explee account | Sign-ups, forms or directory listings |
| Services the guide uses | InboxKit, Apollo, ZeroBounce, Smartlead | explee | Your product's sign-ups, a mailbox |
| Effort | Medium, about a month to the first approved email | Light, an evening, plus one step: you write the confirmed explee calls into `connections/explee.md` from the vendor docs | Light, about a week |

Two setups can run at once. From the first reply on, all three run the same way. The line `setup:` in `rules/settings.yml` says which one is yours, for example `[1, 3]`.

## The three ways

| | Way A | Way B | Way C |
|---|---|---|---|
| What it is | A server runs Claude Code on a timer | Claude Code on your computer, `/loop 10m` | Scripts on a schedule, no model inside |
| Where it lives | `engine/way-a-server/` | `engine/way-b-local/` | `engine/way-c-scripts/` |
| Approval | You on the card, or your team in Slack | You in the window | Nobody; you approved the templates once |
| When your computer is off | Keeps running | Stops | Keeps running on a server |

Start with way B. Move to way A when replies must go out with the window closed or your team approves in Slack. Add way C for sign-ups and forms.

## The example company

`examples/northstar/` holds the same template filled for Northstar Dispatch, a made-up scheduling and dispatch tool for field-service companies. Every address ends in `.example`, so none of it can reach a real inbox. It has the filled rules and knowledge, five pieces of material (three case studies and two one-pagers), and nine sample cards, one for each label. Read the cards first: they show what the AI agent writes on a card, and in which shape.

The example is a model. It is not your rules. The AI agent is told never to answer a lead from it.

## Run the checks

```
node scripts/selftest.mjs
DRY_RUN=1 node scripts/daily-check.mjs
DRY_RUN=1 node scripts/report.mjs
```

| Exit | Meaning |
|---|---|
| 0 | Everything held, or nothing was missed |
| 1 | An alarm was raised: a reply with no note on any card (missed reply), a reply or draft that waited too long, a booked call that ended with no confirmation (no-show), or a booked call with no host named (no-host) |
| 3 | The check could not run, so the step is not done |

`DRY_RUN=1` means a dry run: a practice run. The scripts read the fixtures, which are sample data files in `scripts/fixtures/`, and write nothing. The dry run of the daily check raises six sample alarms on purpose (missed replies, long waits and one unconfirmed call), so it exits 1: that is the expected result on the sample data, not a failure. On Windows PowerShell, the form `DRY_RUN=1 node ...` does not work. Write `$env:DRY_RUN = "1"` first, or add `--live` instead of `DRY_RUN=0`. A real check, with `DRY_RUN=0`, exits 1 only when it finds a real problem. The report exits 0. The self-test also checks that every required file exists, so a half-deleted copy fails it. The same test runs on every push in `.github/workflows/check.yml`.

## What this is not

- It is not a sending service. Smartlead, explee or your own mailbox sends. This repository tells the AI agent what to do through them.
- It is not a CRM. The CRM still gets the lead. The board is where you check the AI agent's work.
- It has no model inside the daily check. A small script runs it, so it cannot fail quietly or be talked out of an alarm.
- It does not tell you what to write. The rules are headings and guidance. Your SDR's threads fill them.
- It does not promise bookings. It makes the work visible, so you can see whether the calls come.

## Origin

Shaped by a real outbound pipeline that ran on GitHub issues in 2026. The company, its people and its leads are not in this repository. Every name in `examples/` is invented.

## License

MIT. See `LICENSE`.
