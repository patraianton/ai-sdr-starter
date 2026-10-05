# The engine: where the AI agent runs

Step 3 of the guide. All three ways share the rules, the product knowledge and the board. What changes is what wakes the AI agent, where it lives and who approves each email.

## The three ways side by side

| | Way A: server on a timer | Way B: Claude Code on your computer | Way C: scripts on a schedule |
|---|---|---|---|
| How fast a reply goes out | Within minutes, around the clock | Within minutes while the window is open | On the schedule; replies wait for a person |
| What it costs to keep | The Claude subscription and the server; Slack approval adds API billing | The Claude subscription only | The server or nothing; the subscription only for maintenance |
| When your computer is off | Keeps running | Stops until you open the window | Keeps running on a server; stops on your computer |
| Who approves | You on the card, or the team in Slack | You in the window | Nobody; you approved the templates once |
| A model inside | Yes | Yes | No |
| Folder | `way-a-server/` | `way-b-local/` | `way-c-scripts/` |

## Which one to start with

Start with way B. It runs on the subscription alone, with no server and no developer.

Move to way A when replies must go out with the window closed, or when the team approves in Slack.

Add way C for sign-ups and forms (setup 3). Its scripts answer nothing: they flag replies on the card for a person, or for the AI agent in way A or B.

Two ways can run at once on one subscription. The sensible pairs are A with C and B with C. Never run A and B at the same time on the same board: both would find the same reply and both would answer it.

## What every way starts with

One instruction, in `run-instruction.md`. It is the same text that `CLAUDE.md` in the repository root points to.

## What every way needs first

1. A copy of this template, private, with `rules/` and `knowledge/` filled (step 1 of the guide).
2. The board created and the keys in `.env` (steps 2 and 4).
3. A first run with the flag file missing: the `first-run-setup` skill walks through it.
4. The daily check on a schedule (step 6): `DRY_RUN=0 node scripts/daily-check.mjs` once a day, on the machine where the AI agent runs. It needs `DRY_RUN=0`, or `--live`: with `DRY_RUN=1` it reads only the sample fixtures and checks nothing real.

## The stop switch in every way

The flag file `SENDING_ON` next to `CLAUDE.md` is the switch (`control/README.md`). With the file, sending is on. Without it, nothing leaves in any way, and the AI agent still reads and writes drafts. The owner holds the switch.
