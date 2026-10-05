# Way A: on a server, on a timer

Step 3 of the guide. The AI agent runs around the clock with your computer off. A developer does the one-time setup below; after that nobody logs in on the server except to stop sending.

A scheduled job starts Claude Code every few minutes with one instruction: read the folder, handle new replies and due follow-ups, update the cards, exit. Each run starts clean and reads the rules again, so an edit applies from the next run.

## What you need

| Item | Notes |
|---|---|
| A small Linux server | The small [Hetzner](https://www.hetzner.com/cloud) cloud server from the cost table, about 12 euros a month. Any small Linux server does. |
| A Claude subscription on a company email | Claude Max, on an address used only by the AI agent, not an employee's login. |
| A developer, once | About an hour. |
| Your copy of this template | Private, with `rules/` and `knowledge/` filled and the board created. |

## Setup, step by step

The developer does these once, on the server.

1. **A user for the AI agent.** Create a normal user, for example `sdr`, with no other duties on the machine. Do everything below as that user. Keys will sit in its folder, so nothing else should run there.
2. **Install Node and Claude Code.** Install Node 20 or newer (the scripts need it), then Claude Code: `npm install -g @anthropic-ai/claude-code`. Check with `claude --version`.
3. **Make the one-year token.** Run `claude setup-token`. It signs in with your Claude subscription and prints a token that lasts one year. If the server cannot open a browser, run the command on your own computer and copy the token. Nobody logs in on the server again.
4. **Save the token outside the repository.** Put it alone on one line in `~/.config/ai-sdr/claude-token`, then `chmod 600` the file. `run-agent.sh` reads it from there. Put a reminder in the calendar for eleven months from now, to make a new token.
5. **Get the folder onto the server.** Clone your private copy of the template into `~/ai-sdr`, using a read-only deploy key (GitHub: the repository's Settings, then Deploy keys). The server only reads the repository. It never pushes.
6. **Fill the keys.** Create `~/ai-sdr/.env` from `.env.example` and paste the keys, one per line, then `chmod 600 .env`. The GitHub App's private key file goes outside the folder; put its path in `GITHUB_APP_PRIVATE_KEY_PATH`. `.env` is ignored by git and must stay that way.
7. **Test by hand with sending off.** The flag file `SENDING_ON` must not exist. Run `engine/way-a-server/run-agent.sh` once and read `runs/run-*.log`. If the labels do not exist yet, the first run is the `first-run-setup` skill: open `claude` in the folder once and type `Follow .claude/skills/first-run-setup/SKILL.md`.
8. **Install the schedule.** Copy the lines of `crontab.example` into `crontab -e`, with the path changed to your folder.
9. **Turn sending on later, and only the owner does.** The owner creates the flag file when the launch checklist is done: `touch ~/ai-sdr/SENDING_ON`. The owner deletes the same file to stop everything: `rm ~/ai-sdr/SENDING_ON`. Give the owner a one-line command for it, or access to a shell on the server.

## Changing the rules

Edit `rules/` or `knowledge/` on your computer and push. At the start of every run, `run-agent.sh` pulls the latest copy, so the edit applies from the next run. Nobody edits the rules on the server.

## Approval on the card

In way A the draft waits on the card with the label "Draft ready" until the approver approves it, from the board or from the GitHub app on their phone. The approver comments `approved` on the card, or `approved, with changes:` followed by the corrected text. The next run sees the comment and sends. Who may approve is named in `rules/08-approval-and-people.md`. Step 5 of the guide covers when to let routine replies go out on their own.

## When the team approves in Slack

If other people must see and approve the emails, the drafts go to Slack, where your SDR or another employee approves each one. For that, [OpenClaw](https://openclaw.ai) or [Hermes Agent](https://github.com/NousResearch/hermes-agent) runs on the same server, keeps the AI agent running and passes each draft to Slack. Both are open source and free. Installing one on the server and connecting it to Slack is a developer's job, done once; follow the project's own documentation.

Two things to settle with the developer:

- The card stays the record. An approval given in Slack must end as an `approved` comment on the card, or the AI agent will not send the draft.
- Neither tool uses the subscription's normal allowance. Budget an API key billed per use, or Claude Max with extra-usage credits. The terms changed several times in 2026, so check them before choosing.

## Watching it

- `runs/run-*.log` is one log per run. Two weeks are kept.
- `alarms/<date>.md` collects one line per problem: a run that failed, a run that hit the time limit, an expired token. The AI agent reads the alarms at the start of every run, and `scripts/daily-check.mjs` writes its own findings to `alarms/<date>-daily-check.md` (or to Slack), a separate file it rewrites on each run, so it never erases a line written here.
- A run that fails with a refused login means the token expired. Make a new one (step 3 above) and replace the file.

## What it costs

The Claude subscription, and about 12 euros a month for the server. Slack approval adds API billing.
