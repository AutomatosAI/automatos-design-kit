#!/bin/bash
# Launcher — Automatos Play pilot (PRD-001). Human-only: run it from your own terminal.
#
#   ./scripts/ralph/launch.sh
#
# Builds the 15 stories in scripts/ralph/prd.json on branch ralph/play-pilot (cut from docs/prd-001-pilot)
# in the worktree <workspace>/.worktrees/automatos-play/ralph+play-pilot, one fresh Opus 5.5 session per
# story. Then ONE push, ONE PR to main and ONE CI run, with up to 3 CI-fix rounds.
#
# Refuses: on battery (RALPH_ALLOW_BATTERY=1 overrides), missing tools, a dirty kit, the loop already running.
set -uo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"
mkdir -p scripts/ralph/logs
PRD_SRC="${RALPH_PRD:-scripts/ralph/prd.json}"
export RALPH_PRD="$(cd "$(dirname "$PRD_SRC")" && pwd)/$(basename "$PRD_SRC")"
LOG="scripts/ralph/logs/launch-$(jq -r .branchName "$RALPH_PRD" | tr '/' '+')-$(date +%F-%H%M).log"
export RALPH_MODEL="${RALPH_MODEL:-claude-opus-5-5}"
say() { echo "[launch-play] $*"; }
die() { echo "[launch-play] ABORT: $*" >&2; exit 1; }

for cmd in claude jq git gh rsync; do command -v "$cmd" >/dev/null || die "missing: $cmd"; done
command -v timeout >/dev/null || command -v gtimeout >/dev/null || die "missing timeout/gtimeout (brew install coreutils)"
gh auth status >/dev/null 2>&1 || die "gh is not logged in"

if command -v pmset >/dev/null 2>&1 && ! pmset -g batt 2>/dev/null | head -1 | grep -q "AC Power"; then
  [ "${RALPH_ALLOW_BATTERY:-0}" = "1" ] || die "on battery power — plug in (or set RALPH_ALLOW_BATTERY=1)."
  say "⚠️  on battery (RALPH_ALLOW_BATTERY=1)."
fi

BASE=$(jq -r .baseBranch "$RALPH_PRD")
git rev-parse --verify --quiet "$BASE" >/dev/null || die "base branch $BASE not found"
[ -z "$(git status --porcelain -- scripts/ralph/prd.json scripts/ralph/PROMPT_build.md scripts/ralph/PROMPT_cifix.md scripts/ralph/run.sh)" ] \
  || die "kit files have uncommitted changes — commit them on $BASE first (the worktree is cut from it)"
pgrep -f "^bash .*automatos-play/scripts/ralph/run.sh" >/dev/null && die "the loop is already running"
[ -d public/auto ] || say "⚠️  public/auto/ is missing — the app will show the mascot placeholder."

say "model $RALPH_MODEL · base $BASE · log $LOG"
nohup bash "$REPO/scripts/ralph/run.sh" > "$LOG" 2>&1 &
disown
say "started (pid $!). Follow it with:  tail -f $REPO/$LOG"
say "Per-session detail lands in scripts/ralph/logs/build-*.log. You get a macOS notification when it stops."
