#!/usr/bin/env bash
# Step 3 of the guide, way A: start one clean Claude Code run with the run instruction, log it to runs/, exit.
#
# Linux only: it needs flock and GNU timeout (on a Mac or in Git Bash they are missing, and the script stops
# with an alarm instead of skipping every run). Run it by hand on the server to test, or from cron (see crontab.example).
#   engine/way-a-server/run-agent.sh           one run
#   engine/way-a-server/run-agent.sh --help    this text
#
# What it needs:
#   - Claude Code installed (the command `claude` is found).
#   - The one-year token from `claude setup-token`, alone on one line in
#     $AI_SDR_CLAUDE_TOKEN_FILE (default: ~/.config/ai-sdr/claude-token, mode 600).
#     It lives outside this repository on purpose.
#   - .env in the repository root, with the keys (the AI agent reads it, this script does not).
#
# Exit codes: 0 the run finished, 3 it could not start, anything else is the exit code of Claude Code.
# Optional environment: RUN_TIMEOUT (default 20m), MAX_TURNS (default 80).

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 3
mkdir -p runs alarms

export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

TODAY="$(date +%F)"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="runs/run-$STAMP.log"
ALARM="alarms/$TODAY.md"
TOKEN_FILE="${AI_SDR_CLAUDE_TOKEN_FILE:-$HOME/.config/ai-sdr/claude-token}"

alarm() {
  # One line in today's alarm file. The AI agent reads alarms/ at the start of every run.
  printf '%s run-agent.sh: %s\n' "$(date '+%Y-%m-%d %H:%M')" "$1" >> "$ALARM"
}

# Without these two tools every run would look like "the last run is still going" and be skipped in silence.
for tool in flock timeout; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    alarm "'$tool' was not found. This script needs Linux (flock and GNU timeout)."
    echo "$tool not found; this script needs Linux" >&2
    exit 3
  fi
done

if ! command -v claude >/dev/null 2>&1; then
  alarm "the command 'claude' was not found. Install Claude Code for this user."
  echo "claude not found" >&2
  exit 3
fi

if [ ! -s "$TOKEN_FILE" ]; then
  alarm "no Claude token at $TOKEN_FILE. Run 'claude setup-token' and save the token there."
  echo "token file missing" >&2
  exit 3
fi

# One run at a time. If the last run is still going, skip this start without noise.
exec 9> runs/.lock
if ! flock -n 9; then
  echo "$(date '+%Y-%m-%d %H:%M') previous run still going, skipped" >> runs/skipped.log
  exit 0
fi

# Sign in with the subscription token. Remove any API key so the run cannot fall back to per-use billing.
CLAUDE_CODE_OAUTH_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
export CLAUDE_CODE_OAUTH_TOKEN
unset ANTHROPIC_API_KEY

# An edit to rules/ or knowledge/ pushed from your computer applies from this run.
if [ -d .git ]; then
  git pull --ff-only --quiet >> "$LOG" 2>&1 || echo "git pull failed, running with the files on disk" >> "$LOG"
fi

# The instruction is the text between the two markers in engine/run-instruction.md.
INSTRUCTION="$(awk '/<!-- instruction:end -->/{f=0} f{print} /<!-- instruction:start -->/{f=1}' engine/run-instruction.md)"
if [ -z "$INSTRUCTION" ]; then
  alarm "engine/run-instruction.md has no text between the instruction markers."
  exit 3
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') run start" >> "$LOG"

timeout "${RUN_TIMEOUT:-20m}" claude -p "$INSTRUCTION" \
  --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
  --max-turns "${MAX_TURNS:-80}" >> "$LOG" 2>&1
CODE=$?

echo "$(date '+%Y-%m-%d %H:%M:%S') run end, exit $CODE" >> "$LOG"

if [ "$CODE" -ne 0 ]; then
  if [ "$CODE" -eq 124 ]; then
    alarm "a run hit the time limit ($LOG). Check it."
  else
    alarm "a run failed with exit $CODE ($LOG). If the log says the login was refused, the token expired: run 'claude setup-token' again."
  fi
fi

# Keep two weeks of logs.
find runs -maxdepth 1 -name 'run-*.log' -mtime +14 -delete 2>/dev/null

exit "$CODE"
