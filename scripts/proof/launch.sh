#!/bin/bash
# The proof launcher (PRD-261 B-06a; the protocol is proof/README.md). It prepares a clean clone of the kit at a base
# tag, outside this repository, for one proof run, then starts the run: a fresh `claude -p` session, its model pinned,
# that builds the theme a brief describes with the kit alone.
#
#   scripts/proof/launch.sh --id b06 --slug harbour --brief <file> --model <model id> --dest <folder> \
#     [--base kit-b06-base] [--dry-run]
#
# It refuses, before it reads or writes anything else: no --model (an exact model id, never an alias), a bad id, slug
# or base, a brief that is not a readable file, and a --dest that exists or lies inside this repository, inside the
# folder it runs from, inside the home folder's Claude Code folder or inside the home folder (the run's rules deny the
# home folder). Then it clones the base tag (one commit deep, that tag only), makes the branch proof/<id>-<slug>,
# deletes every path proof/leak-paths.txt lists and commits the deletion, commits proof/<id>/{BRIEF.md,RUN.md,GAPS.md,
# BASE}, gives the clone the git identity this machine commits with, writes the clone's Claude Code settings (the
# base's proof/run-settings.json, filled in with the clone's paths: the run's permission rules and its sandbox, kept
# out of git) and the run's task (proof/PROMPT.md, filled in) to <dest>.prompt.md, and prints the run's command.
# Unless --dry-run, it runs that command in the clone, with npm's cache at <dest>.npm-cache (beside the clone, never
# inside it), its stream-json transcript to <dest>.transcript.jsonl (beside it too), then adds the end time to RUN.md.
# It sends nothing to any remote, and never reads or writes the home folder's Claude Code folder.
#
# PROOF_KIT_URL overrides the repository it clones (the tests clone a throwaway one); the kit's own by default.
set -eu

readonly KIT_URL="${PROOF_KIT_URL:-https://github.com/AutomatosAI/automatos-design-kit.git}"
readonly DEFAULT_BASE='kit-b06-base'
# An exact model id (claude-<family>-<version>, as templates/ralph takes it): an alias such as opus can change model.
readonly MODEL_ID_PATTERN='^claude-[a-z0-9.-]*[0-9][a-z0-9.-]*(\[1m\])?$'
readonly ID_PATTERN='^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
readonly ID_MAX=32
readonly SLUG_MIN=3
readonly SLUG_MAX=32
readonly TAG_PATTERN='^[A-Za-z0-9][A-Za-z0-9._-]*$'
readonly TAG_MAX=100
readonly LEAK_LIST='proof/leak-paths.txt'
readonly PROMPT_TEMPLATE='proof/PROMPT.md'
readonly RUN_SETTINGS='proof/run-settings.json'
readonly SETTINGS_DIR='.claude'
readonly TRANSCRIPT_SUFFIX='.transcript.jsonl'
readonly PROMPT_SUFFIX='.prompt.md'
readonly NPM_CACHE_SUFFIX='.npm-cache'
# npm reads no user config in the run: the home folder's .npmrc is out of the sandbox's reach, and its tokens with it.
readonly NPM_USERCONFIG='/dev/null'
# A path the settings take as it is: absolute, and no character JSON or sed would read as more than itself.
readonly SETTINGS_PATH_PATTERN='^/[^"\\#&[:cntrl:]]*$'
readonly SYMLINK_MAX=40

ID='' SLUG='' BRIEF='' MODEL='' BASE="$DEFAULT_BASE" DEST='' DRY_RUN=0 CLAUDE_HOME='' BASE_COMMIT=''
NPM_CACHE='' TOOLCHAIN=''

say() { printf '[proof] %s\n' "$*"; }
refuse() { printf '[proof] REFUSED: %s\n' "$*" >&2; exit 1; }
usage() {
  printf '%s\n' 'usage: scripts/proof/launch.sh --id <id> --slug <slug> --brief <file> --model <model id> --dest <folder>' \
    '                                [--base <tag>] [--dry-run]'
}

# --- the arguments ----------------------------------------------------------------------------------------------
value_of() { [ "$#" -ge 2 ] && [ -n "$2" ] || refuse "$1 needs a value."; }

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --id) value_of "$@"; ID=$2; shift 2 ;;
      --slug) value_of "$@"; SLUG=$2; shift 2 ;;
      --brief) value_of "$@"; BRIEF=$2; shift 2 ;;
      --model) value_of "$@"; MODEL=$2; shift 2 ;;
      --base) value_of "$@"; BASE=$2; shift 2 ;;
      --dest) value_of "$@"; DEST=$2; shift 2 ;;
      --dry-run) DRY_RUN=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) usage >&2; refuse "unknown argument: $1" ;;
    esac
  done
}

check_model() {
  [ -n "$MODEL" ] || refuse "--model is required: name the model exactly (claude-<family>-<version>); a proof run never takes a default."
  [[ "$MODEL" =~ $MODEL_ID_PATTERN ]] || refuse "--model $MODEL is not a model id: name one exactly, never an alias such as opus."
}

check_names() {
  [[ "$ID" =~ $ID_PATTERN ]] && [ "${#ID}" -le "$ID_MAX" ] \
    || refuse "--id '$ID' is not a proof id: lower-case words joined by single dashes, at most $ID_MAX characters (b06)."
  [[ "$SLUG" =~ $ID_PATTERN ]] && [ "${#SLUG}" -ge "$SLUG_MIN" ] && [ "${#SLUG}" -le "$SLUG_MAX" ] \
    || refuse "--slug '$SLUG' is not a theme folder's name: $SLUG_MIN to $SLUG_MAX characters, lower-case words joined by single dashes, starting with a letter."
  [[ "$BASE" =~ $TAG_PATTERN ]] && [ "${#BASE}" -le "$TAG_MAX" ] && [[ "$BASE" != *..* ]] \
    || refuse "--base '$BASE' is not a tag name: letters, digits, dots, dashes and underscores."
}

# --- where things may go ----------------------------------------------------------------------------------------
# Whether $1 is $2 or lies under it (both absolute, symlinks resolved).
is_within() { [ "$1" = "$2" ] || [ "${1#"$2"/}" != "$1" ]; }

# A folder's real absolute path, or nothing when it does not exist.
real_dir() { (CDPATH='' cd -- "$1" 2>/dev/null && pwd -P) || true; }

# Sets CLAUDE_HOME: the home folder's Claude Code folder, which the launcher keeps out of every path it takes.
find_claude_home() {
  [ -n "${HOME:-}" ] || refuse "HOME is not set, so the home folder's Claude Code folder can't be kept out."
  CLAUDE_HOME="$(real_dir "$HOME")/$SETTINGS_DIR"
}

check_brief() {
  [ -f "$BRIEF" ] && [ -r "$BRIEF" ] || refuse "--brief $BRIEF is not a readable file."
  local brief_dir
  brief_dir=$(real_dir "$(dirname "$BRIEF")")
  ! is_within "$brief_dir" "$CLAUDE_HOME" || refuse "--brief $BRIEF is inside the home folder's Claude Code folder; the launcher never reads there."
}

# Sets DEST to its absolute path once every rule holds.
check_dest() {
  [ -n "$DEST" ] || refuse "--dest is required: a new folder for the clone, outside this repository."
  [ ! -e "$DEST" ] && [ ! -L "$DEST" ] || refuse "--dest $DEST exists already: a proof starts from a new folder."
  local parent top here
  parent=$(real_dir "$(dirname "$DEST")")
  [ -n "$parent" ] || refuse "--dest $DEST: its parent folder does not exist."
  DEST="$parent/$(basename "$DEST")"
  top=$(git rev-parse --show-toplevel 2>/dev/null || true)
  [ -z "$top" ] || ! is_within "$DEST" "$(real_dir "$top")" || refuse "--dest $DEST is inside this repository ($top): put the clone outside it."
  here=$(pwd -P)
  ! is_within "$DEST" "$here" || refuse "--dest $DEST is inside the folder the launcher runs from ($here): put the clone outside it."
  ! is_within "$DEST" "$CLAUDE_HOME" || refuse "--dest $DEST is inside the home folder's Claude Code folder."
  local home
  home=$(real_dir "$HOME")
  [ -z "$home" ] || ! is_within "$DEST" "$home" \
    || refuse "--dest $DEST is inside your home folder ($home): put the clone outside your home folder, e.g. under /tmp, so the run's file rules can deny your home."
  NPM_CACHE="$DEST$NPM_CACHE_SUFFIX"
}

# --- the run's toolchain --------------------------------------------------------------------------------------------
# A file's real path, its symlinks followed (readlink without -f, which macOS's lacks).
real_file() {
  local path=$1 link count=0
  while [ -L "$path" ] && [ "$count" -lt "$SYMLINK_MAX" ]; do
    link=$(readlink "$path")
    case "$link" in /*) path=$link ;; *) path="$(dirname "$path")/$link" ;; esac
    count=$((count + 1))
  done
  printf '%s/%s' "$(real_dir "$(dirname "$path")")" "$(basename "$path")"
}

# Sets TOOLCHAIN: node's install prefix (two folders up from its real binary, ~/.nvm/versions/node/<version> say) when
# it lies inside the home folder, which the sandbox's denyRead takes, so its allowRead can give it back to npm and
# node; empty otherwise. allowRead carving that prefix out of denyRead is the sandbox's documented rule, but unproven
# here until the first real launch; failIfUnavailable stops the run if the sandbox can't start at all.
find_toolchain() {
  local node prefix home
  node=$(command -v node || true)
  case "$node" in /*) ;; *) TOOLCHAIN=''; return 0 ;; esac
  prefix=$(dirname "$(dirname "$(real_file "$node")")")
  home=$(real_dir "$HOME")
  if [ -n "$home" ] && is_within "$prefix" "$home"; then TOOLCHAIN=$prefix; else TOOLCHAIN=''; fi
}

# Refuses a path the settings can't hold as it is (they are filled in with sed, and are JSON).
check_settings_path() {
  [ -z "$2" ] || [[ "$2" =~ $SETTINGS_PATH_PATTERN ]] \
    || refuse "$1 $2 has a character the run's settings can't hold (a quote, a backslash, #, & or a control character)."
}

# --- the clone --------------------------------------------------------------------------------------------------
clone_base() {
  say "cloning $BASE from $KIT_URL into $DEST"
  git -c advice.detachedHead=false clone --quiet --depth 1 --single-branch --branch "$BASE" -- "$KIT_URL" "$DEST"
  BASE_COMMIT=$(git -C "$DEST" rev-parse HEAD)
  git -C "$DEST" switch --quiet -c "proof/$ID-$SLUG"
  [ ! -e "$DEST/themes/$SLUG" ] || refuse "themes/$SLUG is in $BASE already: a proof builds a new theme (the clone is left at $DEST)."
}

# A line without its leading and trailing blanks.
trimmed() { local text="${1#"${1%%[![:space:]]*}"}"; printf '%s' "${text%"${text##*[![:space:]]}"}"; }

# Deletes one leak list entry (a git glob, or a folder and everything under it); prints how many files it removed.
remove_entry() {
  local count
  count=$(git -C "$DEST" ls-files -- ":(glob)$1" ":(glob)$1/**" < /dev/null | wc -l | tr -d ' ')
  git -C "$DEST" rm -r -q --ignore-unmatch -- ":(glob)$1" ":(glob)$1/**" < /dev/null > /dev/null || return 1
  printf '%s' "$count"
}

remove_leaks() {
  [ -f "$DEST/$LEAK_LIST" ] || refuse "$BASE has no $LEAK_LIST: the launcher needs a base that lists its leak paths."
  local message="proof($ID): remove the leak paths before the run"$'\n\n'"Removed from $BASE, as $LEAK_LIST lists them:"
  local line entry
  while IFS= read -r line || [ -n "$line" ]; do
    entry=$(trimmed "$line")
    case "$entry" in '' | '#'*) continue ;; esac
    message="$message"$'\n'"- $entry: $(remove_entry "$entry") files"
  done < "$DEST/$LEAK_LIST"
  git -C "$DEST" commit --quiet --allow-empty -s -m "$message"
  say "removed the leak paths ($LEAK_LIST) in one commit"
}

# --- the proof folder -------------------------------------------------------------------------------------------
write_run_record() {
  local started
  started=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  cat > "$DEST/proof/$ID/RUN.md" <<EOF
# Proof $ID: $SLUG

The record of one proof run (proof/README.md). The launcher wrote the table's first rows and adds the end time when
the run stops; the owner copies the turns and the cost from the audit's first line; the run writes what it did.

| Field | Value |
|---|---|
| Base tag | \`$BASE\` |
| Base commit | \`$BASE_COMMIT\` |
| Branch | \`proof/$ID-$SLUG\` |
| Theme folder | \`themes/$SLUG\` |
| Model | \`$MODEL\` |
| Started (UTC) | $started |
| Ended (UTC) | to fill |
| Turns | to fill |
| Cost (USD) | to fill, when the transcript has it |

## What the run did

To fill: the steps, in order, and what was left unfinished.
EOF
}

write_gaps() {
  cat > "$DEST/proof/$ID/GAPS.md" <<EOF
# Gaps: proof $ID

Every gap the run met, one row each, in the order it met them: what was missing, wrong or harder than it should
be, where (a file, a command or a guide), its category (proof/README.md lists them) and what the agent did instead.

| Gap | Where | Category | What the agent did |
|---|---|---|---|
EOF
}

write_proof_folder() {
  mkdir -p "$DEST/proof/$ID"
  cp "$BRIEF" "$DEST/proof/$ID/BRIEF.md"
  printf '%s\n' "$BASE" > "$DEST/proof/$ID/BASE"
  write_run_record
  write_gaps
  git -C "$DEST" add -- "proof/$ID/BRIEF.md" "proof/$ID/RUN.md" "proof/$ID/GAPS.md" "proof/$ID/BASE"
  git -C "$DEST" commit --quiet -s -m "proof($ID): the brief, the run's records and the base tag for themes/$SLUG"
  say "wrote proof/$ID/BRIEF.md, RUN.md, GAPS.md and BASE"
}

# --- the run's settings and task --------------------------------------------------------------------------------
# The run's commits need an identity, and the sandbox keeps git from reading the home folder's config: the clone's
# own config gets the identity git commits with here (git var), when there is one.
copy_identity() {
  local ident name email
  ident=$(git -C "$DEST" var GIT_COMMITTER_IDENT 2>/dev/null) || return 0
  name=${ident%% <*}
  email=${ident#*<}
  email=${email%%>*}
  git -C "$DEST" config user.name "$name"
  git -C "$DEST" config user.email "$email"
}

# The run's settings: the base's template filled in with absolute paths. {{CLONE}} is the clone's real path (in a
# permission rule, /{{CLONE}} is the //-prefixed absolute form), {{NPM_CACHE}} npm's cache beside it, {{TOOLCHAIN}}
# node's prefix when it is inside the home folder (its line is dropped otherwise). Under --permission-mode dontAsk a
# call its rules don't allow is denied, with no prompt; the sandbox holds Bash and every process it starts.
fill_settings() {
  local toolchain_line='/{{TOOLCHAIN}}/d'
  [ -z "$TOOLCHAIN" ] || toolchain_line="s#{{TOOLCHAIN}}#$TOOLCHAIN#g"
  sed -e "$toolchain_line" -e "s#{{CLONE}}#$DEST#g" -e "s#{{NPM_CACHE}}#$NPM_CACHE#g" "$DEST/$RUN_SETTINGS"
}

# The run's settings, kept out of git by .git/info/exclude, npm's cache folder, and the kit's skills linked in as
# Claude Code skills.
write_settings() {
  [ -f "$DEST/$RUN_SETTINGS" ] || refuse "$BASE has no $RUN_SETTINGS: the launcher needs a base that holds the run's settings."
  mkdir -p "$DEST/$SETTINGS_DIR" "$NPM_CACHE"
  fill_settings > "$DEST/$SETTINGS_DIR/settings.json"
  case "$(cat "$DEST/$SETTINGS_DIR/settings.json")" in *'{{'*) refuse "$RUN_SETTINGS has a placeholder the launcher does not fill." ;; esac
  [ ! -d "$DEST/skills" ] || ln -s ../skills "$DEST/$SETTINGS_DIR/skills"
  mkdir -p "$DEST/.git/info"
  printf '/%s/\n' "$SETTINGS_DIR" >> "$DEST/.git/info/exclude"
}

write_prompt() {
  [ -f "$DEST/$PROMPT_TEMPLATE" ] || refuse "$BASE has no $PROMPT_TEMPLATE: the launcher needs a base that holds the run's task."
  sed -e "s/{{ID}}/$ID/g" -e "s/{{SLUG}}/$SLUG/g" -e "s/{{BASE}}/$BASE/g" -e "s#{{BRANCH}}#proof/$ID-$SLUG#g" \
    "$DEST/$PROMPT_TEMPLATE" > "$DEST$PROMPT_SUFFIX"
  case "$(cat "$DEST$PROMPT_SUFFIX")" in *'{{'*) refuse "$PROMPT_TEMPLATE has a placeholder the launcher does not fill." ;; esac
}

# The run's command, as printed: the task on stdin, the clone's own settings only, no prompts (a call off the
# allow-list is denied), no saved session, the model pinned, npm's cache beside the clone and no npm user config, the
# stream-json transcript beside the clone.
run_command() {
  printf 'cd %q && CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 npm_config_cache=%q npm_config_userconfig=%q claude -p --model %q --output-format stream-json --verbose --setting-sources project --permission-mode dontAsk --no-session-persistence < %q > %q' \
    "$DEST" "$NPM_CACHE" "$NPM_USERCONFIG" "$MODEL" "$DEST$PROMPT_SUFFIX" "$DEST$TRANSCRIPT_SUFFIX"
}

# Adds the end time and claude's exit status to RUN.md: in its table row, or as a line when the run rewrote the row.
record_end() {
  local record="$DEST/proof/$ID/RUN.md" stamp
  stamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ') (claude exited $1)"
  sed -i.bak -e "s/^| Ended (UTC) | to fill |\$/| Ended (UTC) | $stamp |/" "$record" && rm -f "$record.bak"
  case "$(cat "$record")" in *"$stamp"*) ;; *) printf '\nEnded (UTC): %s, added by the launcher.\n' "$stamp" >> "$record" ;; esac
}

start_run() {
  command -v claude >/dev/null || refuse "claude is not on PATH: install Claude Code, or prepare with --dry-run."
  say "running; the transcript goes to $DEST$TRANSCRIPT_SUFFIX. This waits until the run stops."
  local status=0
  ( cd "$DEST" && CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 npm_config_cache="$NPM_CACHE" npm_config_userconfig="$NPM_USERCONFIG" \
      claude -p --model "$MODEL" --output-format stream-json --verbose \
      --setting-sources project --permission-mode dontAsk --no-session-persistence < "$DEST$PROMPT_SUFFIX" ) \
    > "$DEST$TRANSCRIPT_SUFFIX" || status=$?
  record_end "$status"
  say "the run stopped (claude exited $status). Next: audit it, then fill RUN.md (proof/README.md, After the run):"
  say "  node scripts/proof/audit.mjs $DEST$TRANSCRIPT_SUFFIX $DEST --deny <your deny file>"
}

main() {
  parse_args "$@"
  check_model
  check_names
  find_claude_home
  check_brief
  check_dest
  find_toolchain
  check_settings_path --dest "$DEST"
  check_settings_path "node's prefix" "$TOOLCHAIN"
  command -v git >/dev/null || refuse "git is not on PATH."
  clone_base
  remove_leaks
  write_proof_folder
  copy_identity
  write_settings
  write_prompt
  say "the run's command:"
  printf '%s\n' "$(run_command)"
  if [ "$DRY_RUN" = 1 ]; then say "dry run: nothing started."; return 0; fi
  start_run
}

main "$@"
