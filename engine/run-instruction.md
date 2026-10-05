# The run instruction

Step 3 of the guide. Every way of running the AI agent starts it with the same instruction: way A from a scheduled job, way B after `/loop 10m`, way C only for the maintenance sessions. `CLAUDE.md` points to this file, and `engine/way-a-server/run-agent.sh` reads the text between the two markers below, so there is one text to edit.

The instruction is one paragraph. It is short on purpose. The detail lives in the rules, the product knowledge and the `sdr-run` skill, which the AI agent reads on every run. Stop conditions live in two places: `rules/05-follow-ups-and-stop.md` (when to stop writing to one lead) and section 6 of the `sdr-run` skill (when to stop the run). The alarm files in `alarms/` are named in the paragraph, so way A, which sees only the paragraph, handles them too.

## The text

<!-- instruction:start -->
Read every file in `rules/` and `knowledge/`, then read `rules/settings.yml`. Read the alarms in `alarms/` first: handle the card that each one names in this run, and report any alarm that names a connection or a failed run. Check whether the flag file named there as `sending_flag_file` exists next to `CLAUDE.md`; if it does not, send nothing in this run and leave every draft on its card. Pull the new replies and the follow-ups that are due, for the setup or setups named in `rules/settings.yml`. For each one, run the checks in `rules/02-what-to-check.md` by company domain, research the company, and then draft or send as the approval stage in `rules/settings.yml` says. Write every action on the card in the same run, before you do anything else: if it is not on the card, it did not happen. Never write where one of our people is already in the thread. Stop writing to a lead when `rules/05-follow-ups-and-stop.md` says so, and stop the run on the conditions in section 6 of `.claude/skills/sdr-run/SKILL.md`. When nothing is left to handle, exit. Each run starts clean: keep nothing from earlier runs in your head, because the rules and the cards are the memory.
<!-- instruction:end -->

## How each way uses it

| Way | How the instruction reaches the AI agent |
|---|---|
| A, server on a timer | `run-agent.sh` reads the text above and starts `claude -p` with it. |
| B, Claude Code on your computer | Type `/loop 10m` and paste the text after it. The interval is yours. Ten minutes is an example. |
| C, scripts on a schedule | No model runs. You use the text only in a Claude Code session when you ask the AI agent to read the logs and repair the scripts. |

## Editing the instruction

Change a word only when a run goes wrong in a way the rules cannot fix. A rule goes in `rules/`, not here. If you change the text, keep the paragraph between the markers and keep it to one paragraph.
