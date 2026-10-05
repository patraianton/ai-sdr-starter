# Launch checklist

Block 10 of the guide. Walk through this list before the first email. Each row gives a proof you can see at your company. Tick a box only when you can show the proof, not when you believe it is true.

- [ ] **Setup chosen.** Done when you can name setup 1, 2 or 3 and its lead source. Two can run at once.
  Step: choose your setup. File: `setup:` in `rules/settings.yml`.

- [ ] **Who approves decided.** Done when one person approves with Claude Code, or the team approves in Slack. The Claude Max subscription is on a company email, not an employee's login.
  Step: the seven parts. File: `approval:` in `rules/settings.yml`, `rules/08-approval-and-people.md`.

- [ ] **Rules and product knowledge written.** Done when the folder holds the rule files and the product files drafted from your SDR's threads, including the "we do not have" list, and you have read and corrected every one in one sitting.
  Step 1. Files: `rules/`, `knowledge/`, and the `draft-rules-from-threads` skill.

- [ ] **Suppression lists loaded (setup 1 only).** Done when, before the first send, the sending service holds your customers, everyone your team has written to and everyone who said no.
  Step 1. File: `rules/07-launch-rules.md`.

- [ ] **Board created.** Done when a private repository from the template has the AI agent's own GitHub App installed only there. The labels appear after the first run.
  Step 2. Files: `board/`, `scripts/gh-app-token.mjs`, `first-run-setup` skill.

- [ ] **Where the AI agent runs chosen.** Done when, for way B, Claude Code opens in the rules folder on your computer; for way A, a server job starts it. For setup 3, the way C scripts run on their schedule.
  Step 3. Files: `engine/`.

- [ ] **Connections in place.** Done when the AI agent's settings file has one line per key, and none appears in the repository, on a card or in chat. The Slack app posts to two channels and reads nothing.
  Step 4. Files: `.env.example`, `connections/`.

- [ ] **A run with sending off.** Done when, without the flag file, the AI agent handles a real reply: it checks the CRM, the mailbox and the calendar, writes the draft and the notes on the card, and no email leaves.
  Step 5. Files: `control/README.md`, `sdr-run` skill.

- [ ] **Stop switch tested.** Done when you deleted the flag file, saw no email leave on the next run and put it back.
  Step 5. File: `SENDING_ON` (local, not in git).

- [ ] **Stage 1 for the first days.** Done when the rules file names who approves, and that person approves every email until drafts go out unchanged for several days in a row.
  Step 5. Files: `approval.stage` in `rules/settings.yml`, `control/README.md`.

- [ ] **Daily check on.** Done when the check is scheduled as `DRY_RUN=0 node scripts/daily-check.mjs` (with `DRY_RUN=1` it reads only fixtures), ran once and its alarm reached the Slack channel or the folder you read. A missed reply would name the lead and the card.
  Step 6. Files: `scripts/daily-check.mjs`, `alarms/`.

- [ ] **People named.** Done when the rules file names who answers the waiting list, who hosts the call and who puts the switch back. Every calendar the AI agent points to has a named host, and the report's first line is calls booked and held.
  Step 6. Files: `rules/08-approval-and-people.md`, `scripts/report.mjs`, `owner-report` skill.

## How long the build takes

These are orders of magnitude, and the time is yours, not a developer's. The first days after launch are stage 1 in every setup, so add them before the AI agent sends on its own.

| Setup | To the first approved email | What takes the time |
|---|---|---|
| Setup 2, no outbound yet | An evening | You take one key from the explee account you already have and write the confirmed calls into `connections/explee.md` from the vendor docs, because the template holds none. Claude Code drafts the rules from your threads, you correct them in one sitting and create the board from the template. |
| Setup 3, leads come in on their own | A week | You prepare the rules and the board as above, and a developer connects the mailbox once and, if needed, the sign-up feed. Claude Code writes the way C scripts, and you run them with sending off. |
| Setup 1, you run outbound | A month | You prepare the rules and the board, buy and connect the mailboxes, and anchor the ICP on who pays. You approve the sequence, load the suppression lists and set the launch rules. |
