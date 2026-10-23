#!/bin/bash
# Launcher for one theme wave (the Automatos design kit's templates/ralph). Human-only: a person runs it from their
# own terminal, naming the model.
#
#   RALPH_MODEL=claude-opus-5-5 ./launch.sh
#
# Builds the stories of theme-wave.json (or RALPH_WAVE, a file beside this script) on the wave's branch, in a
# worktree outside the repo, one fresh session per story; then ONE push, ONE pull request and ONE CI run, with up to
# three CI-fix rounds (run.sh).
#
# Refuses: a start with no terminal (an agent session, a pipe, a scheduler), no explicit model id, missing tools, gh
# not signed in, battery power (RALPH_ALLOW_BATTERY=1 overrides), the wave's files uncommitted, the base branch
# missing, the loop already running for this folder.
set -uo pipefail

MODEL_ID_PATTERN='^claude-[a-z0-9.-]*[0-9][a-z0-9.-]*(\[1m\])?$'

say() { echo "[launch] $*"; }
die() { echo "[launch] REFUSED: $*" >&2; exit 1; }

# A person starts an unattended loop, at a terminal; this is the first check, before anything is read or written.
[ -t 0 ] || die "this start has no terminal: launch.sh starts an unattended loop, so a person runs it from a terminal."

[ -n "${RALPH_MODEL:-}" ] || die "RALPH_MODEL is not set. Name the model explicitly, for example RALPH_MODEL=claude-opus-5-5."
[[ "$RALPH_MODEL" =~ $MODEL_ID_PATTERN ]] || die "RALPH_MODEL=$RALPH_MODEL is not a model id: name one exactly, never an alias."
export RALPH_MODEL

KIT="$(cd "$(dirname "$0")" && pwd)"
for cmd in claude jq git gh; do command -v "$cmd" >/dev/null || die "missing: $cmd"; done
command -v timeout >/dev/null || command -v gtimeout >/dev/null || die "missing: timeout (or gtimeout, from coreutils)"
gh auth status >/dev/null 2>&1 || die "gh is not signed in"
REPO="$(git -C "$KIT" rev-parse --show-toplevel)" || die "$KIT is not in a git repository"

if command -v pmset >/dev/null 2>&1 && ! pmset -g batt 2>/dev/null | head -1 | grep -q "AC Power"; then
  [ "${RALPH_ALLOW_BATTERY:-0}" = "1" ] || die "on battery power: plug in, or set RALPH_ALLOW_BATTERY=1."
  say "on battery (RALPH_ALLOW_BATTERY=1)."
fi

WAVE_SRC="$KIT/${RALPH_WAVE:-theme-wave.json}"
[ -f "$WAVE_SRC" ] || die "no wave file at $WAVE_SRC"
BASE=$(jq -r .baseBranch "$WAVE_SRC") || die "$WAVE_SRC is not JSON"
BR=$(jq -r .branchName "$WAVE_SRC")
git -C "$REPO" rev-parse --verify --quiet "$BASE" >/dev/null || die "base branch $BASE not found"
[ -z "$(git -C "$KIT" status --porcelain -- .)" ] \
  || die "files in $KIT are not committed: commit them on $BASE first (the worktree is cut from it)"
pgrep -f -- "$KIT/run.sh" >/dev/null && die "the loop is already running for $KIT"

WT_ROOT="${RALPH_WORKTREE_ROOT:-$(dirname "$REPO")/$(basename "$REPO")-worktrees}"
mkdir -p "$WT_ROOT/logs"
LOG="$WT_ROOT/logs/launch-$(echo "$BR" | tr '/' '+')-$(date +%F-%H%M).log"

say "model $RALPH_MODEL · base $BASE · branch $BR · log $LOG"
nohup bash "$KIT/run.sh" > "$LOG" 2>&1 &
disown
say "started (pid $!). Follow it with:  tail -f $LOG"
say "Each session's detail lands in $WT_ROOT/logs/build-*.log. On macOS a notification says when it stops."
