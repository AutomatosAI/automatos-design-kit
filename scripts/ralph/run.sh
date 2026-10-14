#!/bin/bash
# Ralph runner — Automatos Play pilot (PRD-001). Started by launch.sh; never run by an AI session.
#
# One wave: one fresh `claude --print` session per story until every story passes, then ONE push,
# ONE PR and ONE CI run. A red CI gets up to RALPH_CI_ROUNDS fix sessions (one push each).
#
# Env: RALPH_MODEL (pinned, default claude-opus-5-5) · RALPH_MAX_ITERS (22) · RALPH_ITER_TIMEOUT (60m)
#      RALPH_CI_ROUNDS (3) · RALPH_CI_WAIT_MIN (40)
#
# Carried over from the automatos-ai kits: sentinels are read from the LAST non-empty line only
# (a sentinel quoted in prose once ended a wave early), every session is fresh, no per-story CI.
set -u

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PLATFORM="$(dirname "$REPO")"
CORE="$PLATFORM/automatos-ai"
KIT="$REPO/scripts/ralph"
PRD_SRC="${RALPH_PRD:-$KIT/prd.json}"   # a later wave passes its own prd.json (the worktree copy)
BR=$(jq -r .branchName "$PRD_SRC")
BASE=$(jq -r .baseBranch "$PRD_SRC")
PR_BASE=$(jq -r .prBase "$PRD_SRC")
PR_TITLE=$(jq -r '.prTitle // "feat: Automatos Play pilot (PRD-001)"' "$PRD_SRC")
PRD_DOC=$(jq -r '.prdDoc // "docs/prd/PRD-001-FUN-UI-PILOT.md"' "$PRD_SRC")
WT="$PLATFORM/.worktrees/automatos-play/$(echo "$BR" | tr '/' '+')"
RALPH_MODEL="${RALPH_MODEL:-claude-opus-5-5}"
MAX_ITERS="${RALPH_MAX_ITERS:-22}"
ITER_TIMEOUT="${RALPH_ITER_TIMEOUT:-60m}"
CI_ROUNDS="${RALPH_CI_ROUNDS:-3}"
CI_WAIT_MIN="${RALPH_CI_WAIT_MIN:-40}"
TIMEOUT_BIN=$(command -v timeout || command -v gtimeout)
LOGDIR="$KIT/logs"
mkdir -p "$LOGDIR"
STAMP=$(date +%F-%H%M)
BUILD_LOG="$LOGDIR/build-$(echo "$BR" | tr '/' '+')-$STAMP.log"

say() { echo "[ralph-play $(date +%H:%M:%S)] $*" | tee -a "$BUILD_LOG"; }
notify() { osascript -e "display notification \"$1\" with title \"Ralph · Automatos Play\"" >/dev/null 2>&1 || true; }
die() { say "STOP: $*"; notify "Stopped: $*"; exit 1; }

last_line() { printf '%s\n' "$1" | sed 's/\x1b\[[0-9;]*m//g; s/[[:space:]]*$//' | grep -v '^[[:space:]]*$' | tail -1; }
ends_with() { local last; last=$(last_line "$1"); [[ "$last" == *"$2"* ]] && [[ ${#last} -le 80 ]]; }

# --- worktree --------------------------------------------------------------------------------
ensure_worktree() {
  if [ ! -d "$WT" ]; then
    mkdir -p "$(dirname "$WT")"
    if git -C "$REPO" show-ref --verify --quiet "refs/heads/$BR"; then
      git -C "$REPO" worktree add "$WT" "$BR" >>"$BUILD_LOG" 2>&1 || die "worktree add failed"
    else
      git -C "$REPO" worktree add -b "$BR" "$WT" "$BASE" >>"$BUILD_LOG" 2>&1 || die "worktree add failed"
    fi
    say "worktree created: $WT ($BR from $BASE)"
  fi
  # Provision on create AND reuse: the mascot files are git-ignored, so copy them in for local runs.
  if [ -d "$REPO/public/auto" ]; then
    mkdir -p "$WT/public/auto" && rsync -a "$REPO/public/auto/" "$WT/public/auto/"
  fi
}

render_prompt() {  # $1 = prompt file in the worktree → rendered temp file path on stdout
  local out; out=$(mktemp)
  sed "s#{{CORE}}#$CORE#g" "$1" > "$out"
  echo "$out"
}

all_pass() { [ "$(jq '[.userStories[] | select(.passes != true)] | length' "$WT/scripts/ralph/prd.json")" = "0" ]; }
next_story() { jq -r '[.userStories[] | select(.passes != true)] | sort_by(.priority) | .[0].id // "none"' "$WT/scripts/ralph/prd.json"; }

# --- one headless claude session (sets CLAUDE_RESULT) ------------------------------------------
run_claude() {
  local prompt_file="$1" logfile="$2" tmp; tmp=$(mktemp)
  ( cd "$WT" && "$TIMEOUT_BIN" --kill-after=30s "$ITER_TIMEOUT" claude --print \
      --model "$RALPH_MODEL" --verbose --output-format stream-json --dangerously-skip-permissions \
      < "$prompt_file" ) 2>&1 | tee "$tmp" >> "$logfile"
  CLAUDE_RESULT=$(sed 's/\x1b\[[0-9;]*m//g' "$tmp" | grep '^{' \
    | jq -rs '[.[] | select(.type == "result") | .result // empty] | last // empty' 2>/dev/null)
  local secs; secs=$(sed 's/\x1b\[[0-9;]*m//g' "$tmp" | grep '^{' \
    | jq -rs '[.[] | select(.type == "result") | .duration_ms] | last // 0 | ./1000 | floor' 2>/dev/null)
  say "session ended after ${secs:-?}s; last line: $(last_line "${CLAUDE_RESULT:-<none>}" | cut -c1-80)"
  rm -f "$tmp"
}

# --- build loop --------------------------------------------------------------------------------
build_loop() {
  local i misses=0
  for ((i = 1; i <= MAX_ITERS; i++)); do
    if all_pass; then say "all stories pass"; return 0; fi
    local story; story=$(next_story)
    say "build iteration $i/$MAX_ITERS · next story $story"
    local p; p=$(render_prompt "$WT/scripts/ralph/PROMPT_build.md")
    run_claude "$p" "$BUILD_LOG"; rm -f "$p"
    if ends_with "${CLAUDE_RESULT:-}" "RALPH_BLOCKED"; then die "blocked — $(last_line "$CLAUDE_RESULT")"; fi
    if ends_with "${CLAUDE_RESULT:-}" "RALPH_COMPLETE" && all_pass; then say "build COMPLETE"; return 0; fi
    if ends_with "${CLAUDE_RESULT:-}" "STORY_DONE"; then misses=0; continue; fi
    misses=$((misses + 1))
    say "no sentinel (timeout or crash) — $misses in a row"
    [ "$misses" -ge 3 ] && die "3 sessions in a row ended without a sentinel"
  done
  all_pass || die "iteration cap reached with stories left ($(next_story) next)"
}

# --- one push, one PR, one CI run --------------------------------------------------------------
push_and_pr() {
  git -C "$WT" push -u origin "$BR" >>"$BUILD_LOG" 2>&1 || die "push failed"
  if [ "$(gh pr list -R AutomatosAI/automatos-play --head "$BR" --state open --json number --jq 'length' 2>/dev/null)" = "0" ]; then
    gh pr create -R AutomatosAI/automatos-play --base "$PR_BASE" --head "$BR" \
      --title "$PR_TITLE" \
      --body "Built by the Ralph loop from scripts/ralph/prd.json ($PRD_DOC). Story notes: scripts/ralph/prd.json. Learnings: scripts/ralph/progress.txt. Skill gaps: docs/SKILL-GAPS.md. Manual checks for the local run: docs/RUN-CHECKLIST.md." \
      >>"$BUILD_LOG" 2>&1 || die "PR create failed"
  fi
  say "pushed $(git -C "$WT" rev-parse --short HEAD); PR: $(gh pr list -R AutomatosAI/automatos-play --head "$BR" --json url --jq '.[0].url')"
}

# Waits for the CI run on HEAD. Echoes success | failure | timeout.
wait_ci() {
  local sha deadline
  sha=$(git -C "$WT" rev-parse HEAD)
  deadline=$(( $(date +%s) + CI_WAIT_MIN * 60 ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    local row; row=$(gh run list -R AutomatosAI/automatos-play --branch "$BR" --json headSha,status,conclusion,databaseId \
      --jq ".[] | select(.headSha == \"$sha\") | \"\(.status) \(.conclusion) \(.databaseId)\"" 2>/dev/null | head -1)
    case "$row" in
      "completed success "*) echo success; return ;;
      "completed "*) echo failure; return ;;
    esac
    sleep 60
  done
  echo timeout
}

ci_rounds() {
  local round result
  for ((round = 0; round <= CI_ROUNDS; round++)); do
    result=$(wait_ci)
    say "CI on $(git -C "$WT" rev-parse --short HEAD): $result"
    [ "$result" = success ] && return 0
    [ "$result" = timeout ] && die "CI did not finish within ${CI_WAIT_MIN} min"
    [ "$round" -eq "$CI_ROUNDS" ] && die "CI still red after $CI_ROUNDS fix rounds"
    local run_id; run_id=$(gh run list -R AutomatosAI/automatos-play --branch "$BR" --json headSha,databaseId \
      --jq ".[] | select(.headSha == \"$(git -C "$WT" rev-parse HEAD)\") | .databaseId" | head -1)
    mkdir -p "$WT/scripts/ralph/logs"
    gh run view -R AutomatosAI/automatos-play "$run_id" --log-failed > "$WT/scripts/ralph/logs/ci-failure.txt" 2>&1
    [ -s "$WT/scripts/ralph/logs/ci-failure.txt" ] || die "CI failed but the failure log is empty (run $run_id)"
    say "CI fix round $((round + 1))/$CI_ROUNDS (run $run_id)"
    local p; p=$(render_prompt "$WT/scripts/ralph/PROMPT_cifix.md")
    run_claude "$p" "$BUILD_LOG"; rm -f "$p"
    ends_with "${CLAUDE_RESULT:-}" "CI_FIX_DONE" || die "CI fix session ended without CI_FIX_DONE"
    git -C "$WT" push origin "$BR" >>"$BUILD_LOG" 2>&1 || die "push failed"
  done
}

main() {
  say "start · model $RALPH_MODEL · branch $BR (from $BASE) · iters $MAX_ITERS · session timeout $ITER_TIMEOUT"
  ensure_worktree
  build_loop
  push_and_pr
  ci_rounds
  say "DONE: wave built, pushed and CI green. Next: Gerard's local run (docs/RUN-CHECKLIST.md)."
  notify "Pilot built and CI green"
}
main "$@"
