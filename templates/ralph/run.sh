#!/bin/bash
# Ralph runner for one theme wave (the Automatos design kit's templates/ralph). Started by launch.sh from a
# person's terminal; never by an agent session.
#
# One wave: one fresh `claude --print` session per story of the wave file until every story passes, then ONE push,
# ONE pull request and ONE CI run. A red CI run gets up to RALPH_CI_ROUNDS fix sessions, one push each.
#
# Env: RALPH_MODEL (required: an explicit model id, such as claude-opus-5-5; there is no default, and an alias is
#      refused, so an unattended run never changes model under you) · RALPH_WAVE (the wave file's name beside this
#      script, default theme-wave.json) · RALPH_WORKTREE_ROOT (default: <repo>-worktrees beside the repo) ·
#      RALPH_CORE (a read-only core checkout the sessions may read, optional) · RALPH_GH_REPO (owner/name, default:
#      the repo's own) · RALPH_MAX_ITERS (22) · RALPH_ITER_TIMEOUT (60m) · RALPH_CI_ROUNDS (3) ·
#      RALPH_CI_WAIT_MIN (40)
#
# Sentinels are read from the LAST non-empty line only (a sentinel quoted in prose must not end a wave early),
# every session is fresh, and CI runs once per push, never per story.
set -u

MODEL_ID_PATTERN='^claude-[a-z0-9.-]*[0-9][a-z0-9.-]*(\[1m\])?$'
THEME_ID_PATTERN='^[a-z0-9][a-z0-9-]{0,38}/[a-z0-9][a-z0-9-]{0,62}$'
THEME_DIR_PATTERN='^themes/[a-z0-9][a-z0-9-]{0,62}$'
SENTINEL_MAX=80
API_WAITS_MAX=30
API_WAIT_SECONDS=120
MISSES_MAX=3
CI_POLL_SECONDS=60

refuse() { echo "[ralph] REFUSED: $*" >&2; exit 2; }

# The model is named by the person who starts the wave, exactly; nothing runs before this check.
require_model() {
  [ -n "${RALPH_MODEL:-}" ] \
    || refuse "RALPH_MODEL is not set. Name the model explicitly, for example RALPH_MODEL=claude-opus-5-5: there is no default."
  [[ "$RALPH_MODEL" =~ $MODEL_ID_PATTERN ]] \
    || refuse "RALPH_MODEL=$RALPH_MODEL is not a model id. Name one exactly (claude-<family>-<version>): an alias such as opus or sonnet can change under an unattended run."
}
require_model

for cmd in claude jq git gh; do command -v "$cmd" >/dev/null || refuse "missing: $cmd"; done
TIMEOUT_BIN=$(command -v timeout || command -v gtimeout) || refuse "missing: timeout (or gtimeout)"

KIT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$KIT" rev-parse --show-toplevel)" || refuse "$KIT is not in a git repository"
KIT_REL="$(git -C "$KIT" rev-parse --show-prefix)"
WAVE_NAME="${RALPH_WAVE:-theme-wave.json}"
WAVE_SRC="$KIT/$WAVE_NAME"
[ -f "$WAVE_SRC" ] || refuse "no wave file at $WAVE_SRC"
jq -e . "$WAVE_SRC" >/dev/null 2>&1 || refuse "$WAVE_SRC is not JSON"

THEME_ID=$(jq -r .themeId "$WAVE_SRC")
THEME_DIR=$(jq -r .themeDir "$WAVE_SRC")
[[ "$THEME_ID" =~ $THEME_ID_PATTERN ]] || refuse "themeId \"$THEME_ID\" is not publisher/slug"
[[ "$THEME_DIR" =~ $THEME_DIR_PATTERN ]] || refuse "themeDir \"$THEME_DIR\" is not themes/<slug>"
BR=$(jq -r .branchName "$WAVE_SRC")
BASE=$(jq -r .baseBranch "$WAVE_SRC")
PR_BASE=$(jq -r .prBase "$WAVE_SRC")
PR_TITLE=$(jq -r '.prTitle // ("feat: " + .themeId + " theme wave")' "$WAVE_SRC")
SLUG=$(echo "$BR" | tr '/' '+')
WT_ROOT="${RALPH_WORKTREE_ROOT:-$(dirname "$REPO")/$(basename "$REPO")-worktrees}"
WT="$WT_ROOT/$SLUG"
WAVE="${KIT_REL}${WAVE_NAME}"
PROGRESS="${KIT_REL}progress.txt"
CORE="${RALPH_CORE:-not checked out here: read the guides and themes/play; core is AutomatosAI/automatos-ai on GitHub}"
GH_REPO="${RALPH_GH_REPO:-$(cd "$REPO" && gh repo view --json nameWithOwner --jq .nameWithOwner)}"
[ -n "$GH_REPO" ] || refuse "can't name this repository on GitHub: set RALPH_GH_REPO=<owner>/<name>"
MAX_ITERS="${RALPH_MAX_ITERS:-22}"
ITER_TIMEOUT="${RALPH_ITER_TIMEOUT:-60m}"
CI_ROUNDS="${RALPH_CI_ROUNDS:-3}"
CI_WAIT_MIN="${RALPH_CI_WAIT_MIN:-40}"
LOGDIR="$WT_ROOT/logs"
CI_LOG="$LOGDIR/ci-failure-$SLUG.txt"
mkdir -p "$LOGDIR"
BUILD_LOG="$LOGDIR/build-$SLUG-$(date +%F-%H%M).log"

say() { echo "[ralph $(date +%H:%M:%S)] $*" | tee -a "$BUILD_LOG"; }
notify() {
  command -v osascript >/dev/null 2>&1 || return 0
  osascript -e "display notification \"$1\" with title \"Ralph · $THEME_ID\"" >/dev/null 2>&1 || true
}
die() { say "STOP: $*"; notify "Stopped: $*"; exit 1; }

last_line() { printf '%s\n' "$1" | sed 's/\x1b\[[0-9;]*m//g; s/[[:space:]]*$//' | grep -v '^[[:space:]]*$' | tail -1; }
ends_with() { local last; last=$(last_line "$1"); [[ "$last" == *"$2"* ]] && [[ ${#last} -le $SENTINEL_MAX ]]; }

# --- worktree ----------------------------------------------------------------------------------
ensure_worktree() {
  [ -d "$WT" ] && return 0
  mkdir -p "$WT_ROOT"
  if git -C "$REPO" show-ref --verify --quiet "refs/heads/$BR"; then
    git -C "$REPO" worktree add "$WT" "$BR" >>"$BUILD_LOG" 2>&1 || die "worktree add failed"
  else
    git -C "$REPO" worktree add -b "$BR" "$WT" "$BASE" >>"$BUILD_LOG" 2>&1 || die "worktree add failed"
  fi
  say "worktree created: $WT ($BR from $BASE)"
}

# The prompt with this wave's values in place of its {{…}} placeholders, as a temp file; its path on stdout.
escape() { printf '%s' "$1" | sed 's/[#&\\]/\\&/g'; }
render_prompt() {
  local out; out=$(mktemp)
  sed -e "s#{{THEME_ID}}#$(escape "$THEME_ID")#g" -e "s#{{THEME_DIR}}#$(escape "$THEME_DIR")#g" \
      -e "s#{{WAVE}}#$(escape "$WAVE")#g" -e "s#{{PROGRESS}}#$(escape "$PROGRESS")#g" \
      -e "s#{{CI_LOG}}#$(escape "$CI_LOG")#g" -e "s#{{CORE}}#$(escape "$CORE")#g" "$1" > "$out"
  echo "$out"
}

all_pass() { [ "$(jq '[.userStories[] | select(.passes != true)] | length' "$WT/$WAVE")" = "0" ]; }
next_story() { jq -r '[.userStories[] | select(.passes != true)] | sort_by(.priority) | .[0].id // "none"' "$WT/$WAVE"; }

# --- one headless claude session (sets CLAUDE_RESULT) -------------------------------------------
run_claude() {
  local prompt_file="$1" tmp secs; tmp=$(mktemp)
  ( cd "$WT" && "$TIMEOUT_BIN" --kill-after=30s "$ITER_TIMEOUT" claude --print \
      --model "$RALPH_MODEL" --verbose --output-format stream-json --dangerously-skip-permissions \
      < "$prompt_file" ) 2>&1 | tee "$tmp" >> "$BUILD_LOG"
  CLAUDE_RESULT=$(sed 's/\x1b\[[0-9;]*m//g' "$tmp" | grep '^{' \
    | jq -rs '[.[] | select(.type == "result") | .result // empty] | last // empty' 2>/dev/null)
  secs=$(sed 's/\x1b\[[0-9;]*m//g' "$tmp" | grep '^{' \
    | jq -rs '[.[] | select(.type == "result") | .duration_ms] | last // 0 | ./1000 | floor' 2>/dev/null)
  say "session ended after ${secs:-?}s; last line: $(last_line "${CLAUDE_RESULT:-<none>}" | cut -c1-80)"
  rm -f "$tmp"
}

# --- build loop ----------------------------------------------------------------------------------
build_loop() {
  local i misses=0 api_waits=0 story prompt
  for ((i = 1; i <= MAX_ITERS; i++)); do
    if all_pass; then say "all stories pass"; return 0; fi
    story=$(next_story)
    say "build iteration $i/$MAX_ITERS · next story $story"
    prompt=$(render_prompt "$WT/${KIT_REL}PROMPT_build.md")
    run_claude "$prompt"; rm -f "$prompt"
    if ends_with "${CLAUDE_RESULT:-}" "RALPH_BLOCKED"; then die "blocked: $(last_line "$CLAUDE_RESULT")"; fi
    if ends_with "${CLAUDE_RESULT:-}" "RALPH_COMPLETE" && all_pass; then say "build COMPLETE"; return 0; fi
    if ends_with "${CLAUDE_RESULT:-}" "STORY_DONE"; then misses=0; continue; fi
    # A dropped network or an API outage is not the story's fault: wait and retry it without counting a miss.
    if [[ "${CLAUDE_RESULT:-}" == *"API Error"* ]] && [ "$api_waits" -lt "$API_WAITS_MAX" ]; then
      api_waits=$((api_waits + 1)); i=$((i - 1))
      say "API unreachable ($api_waits/$API_WAITS_MAX): waiting ${API_WAIT_SECONDS}s, then the same story again"
      sleep "$API_WAIT_SECONDS"; continue
    fi
    misses=$((misses + 1))
    say "no sentinel (timeout or crash): $misses in a row"
    [ "$misses" -ge "$MISSES_MAX" ] && die "$MISSES_MAX sessions in a row ended without a sentinel"
  done
  all_pass || die "iteration cap reached with stories left ($(next_story) next)"
}

# --- one push, one pull request, one CI run ----------------------------------------------------
push_and_pr() {
  git -C "$WT" push -u origin "$BR" >>"$BUILD_LOG" 2>&1 || die "push failed"
  if [ "$(gh pr list -R "$GH_REPO" --head "$BR" --state open --json number --jq 'length' 2>/dev/null)" = "0" ]; then
    gh pr create -R "$GH_REPO" --base "$PR_BASE" --head "$BR" --title "$PR_TITLE" \
      --body "Theme $THEME_ID, built by the Ralph loop from $WAVE. Story notes: $WAVE. Learnings: $PROGRESS." \
      >>"$BUILD_LOG" 2>&1 || die "pull request create failed"
  fi
  say "pushed $(git -C "$WT" rev-parse --short HEAD); PR: $(gh pr list -R "$GH_REPO" --head "$BR" --json url --jq '.[0].url')"
}

# The CI run on HEAD: echoes success, failure or timeout.
wait_ci() {
  local sha deadline row
  sha=$(git -C "$WT" rev-parse HEAD)
  deadline=$(( $(date +%s) + CI_WAIT_MIN * 60 ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    row=$(gh run list -R "$GH_REPO" --branch "$BR" --json headSha,status,conclusion,databaseId \
      --jq ".[] | select(.headSha == \"$sha\") | \"\(.status) \(.conclusion) \(.databaseId)\"" 2>/dev/null | head -1)
    case "$row" in
      "completed success "*) echo success; return ;;
      "completed "*) echo failure; return ;;
    esac
    sleep "$CI_POLL_SECONDS"
  done
  echo timeout
}

ci_rounds() {
  local round result run_id prompt
  for ((round = 0; round <= CI_ROUNDS; round++)); do
    result=$(wait_ci)
    say "CI on $(git -C "$WT" rev-parse --short HEAD): $result"
    [ "$result" = success ] && return 0
    [ "$result" = timeout ] && die "CI did not finish within ${CI_WAIT_MIN} min"
    [ "$round" -eq "$CI_ROUNDS" ] && die "CI still red after $CI_ROUNDS fix rounds"
    run_id=$(gh run list -R "$GH_REPO" --branch "$BR" --json headSha,databaseId \
      --jq ".[] | select(.headSha == \"$(git -C "$WT" rev-parse HEAD)\") | .databaseId" | head -1)
    gh run view -R "$GH_REPO" "$run_id" --log-failed > "$CI_LOG" 2>&1
    [ -s "$CI_LOG" ] || die "CI failed but its failure log is empty (run $run_id): read the run yourself"
    say "CI fix round $((round + 1))/$CI_ROUNDS (run $run_id)"
    prompt=$(render_prompt "$WT/${KIT_REL}PROMPT_cifix.md")
    run_claude "$prompt"; rm -f "$prompt"
    ends_with "${CLAUDE_RESULT:-}" "CI_FIX_DONE" || die "CI fix session ended without CI_FIX_DONE"
    git -C "$WT" push origin "$BR" >>"$BUILD_LOG" 2>&1 || die "push failed"
  done
}

main() {
  say "start · theme $THEME_ID · model $RALPH_MODEL · branch $BR (from $BASE) · iters $MAX_ITERS · session timeout $ITER_TIMEOUT"
  ensure_worktree
  build_loop
  push_and_pr
  ci_rounds
  say "DONE: wave built, pushed and CI green. Next: a person tries the theme (the template README's last step)."
  notify "Theme wave built and CI green"
}
main "$@"
