# AGENTS.md

Step 3 of the guide (where the AI agent runs).

For any coding agent that is not Claude Code. Read `CLAUDE.md` first: it is the standing instruction for this folder, and the other files point back to it.

- Run instruction: the section "The run instruction" in `CLAUDE.md`. The same text is in `engine/run-instruction.md`.
- Hard rules: the section "Hard rules" in `CLAUDE.md`, and the full list in `rules/06-hard-rules.md`.
- Stop switch: the section "The stop switch". Never create the file `SENDING_ON`. A person does.
- Board and note shape: `board/note-shapes.md`. If it is not on the card, it did not happen.
- Skills: the files `.claude/skills/*/SKILL.md` are plain step-by-step procedures. If your tool has no skills, open the file and follow it as written.
- Anti-patterns: the table at the end of `CLAUDE.md`.
- `examples/northstar/` is a model for a fictional company, not rules.

Before you change a script, run `node scripts/selftest.mjs`. Report the exit code. Exit 3 means the step is not done.
