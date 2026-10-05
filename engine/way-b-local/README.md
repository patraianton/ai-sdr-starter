# Way B: Claude Code on your computer

Step 3 of the guide. Start here. A small flow runs on the subscription alone: no server and no developer. You read and approve each draft in the window, and the AI agent sends it. Nothing else is installed.

## What you need

- A [Claude](https://claude.com/pricing) Max subscription, on a company email used only by the AI agent (step 3, "Monthly cost").
- [Claude Code](https://claude.com/product/claude-code) on your computer.
- Node 20 or newer, for the scripts in `scripts/`.
- Your private copy of this template, with `rules/` and `knowledge/` filled and the keys in `.env`.

## Setup

1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`. Check with `claude --version`.
2. Open a terminal in your copy of the template and start `claude`. When it asks you to sign in, use the company email of the subscription.
3. Write the rules first. Export your SDR's threads into a folder outside the repository and type: `Follow .claude/skills/draft-rules-from-threads/SKILL.md`. Read and correct every draft. Then fill in `setup`, `engine` and the four names under `approval:` in `rules/settings.yml`, and the approver's name and GitHub login in `rules/08-approval-and-people.md`.
4. Run the first run. Type: `Follow .claude/skills/first-run-setup/SKILL.md`. It refuses to run while the settings or the names are empty. It creates the labels, checks the keys and does one run with sending off.
5. Check the card it made. Read the draft. Nothing left your mailbox.

## Start the loop

In the Claude Code window, type `/loop 10m` and paste the run instruction from `engine/run-instruction.md` after it:

```
/loop 10m <the text between the markers in engine/run-instruction.md>
```

The AI agent repeats the run every ten minutes while the window is open. Ten minutes is an example. The interval is yours: `/loop 5m` for faster, `/loop 30m` for slower.

## Approving in the window

At approval stage 1, the AI agent shows each draft in the window and asks the approver. The approver answers `approved`, or types the corrected text. The AI agent sends it, then writes the `sent` note on the card with the line `Approved by`. If nobody answers, the draft stays on the card with the label "Draft ready" and the next run asks again. A draft can also be approved on the card, with a comment (see `rules/08-approval-and-people.md`).

## When the window closes

When the window closes or the computer sleeps, the AI agent stops. Replies wait until you reopen it. On reopening, type `/loop 10m` and the instruction again. To keep it running through the working day, stop the computer from sleeping while the window is open (on a Mac, `caffeinate -i`; on Windows, set sleep to Never while plugged in).

A loop keeps one conversation. The cards and the files are the memory, so if the window gets slow, type `/clear` and start the loop again. Nothing is lost.

## Stopping

- All sending: delete the flag file `SENDING_ON` in the folder. The next run reads and writes drafts, and sends nothing.
- Everything: close the window, or tell Claude Code to stop the loop.
- One company: put the label "Do not write" on its card.

## The daily check

The daily check is a script outside the AI agent. Schedule it on your computer once a day: `DRY_RUN=0 node scripts/daily-check.mjs` (or `node scripts/daily-check.mjs --live`). It needs `DRY_RUN=0`: `.env.example` ships with `DRY_RUN=1`, and with that value the script reads only the sample files in `scripts/fixtures/`, checks nothing real and prints "fixtures only". On a Mac or Linux use `cron`, the scheduler built into both. On Windows use Task Scheduler with `node scripts/daily-check.mjs --live`, because the `DRY_RUN=0` prefix does not work there. Without Slack, its alarms go to `alarms/<date>-daily-check.md`, and the AI agent reads that folder at the start of every run. If the computer is off at the scheduled hour, run the script when you open the window.

## What it costs

The Claude subscription only.
