#!/bin/bash
# The proof launcher (PRD-261 B-06a; the protocol is proof/README.md). It prepares a clean clone of the kit at a base
# tag, outside this repository, for one proof run, then starts the run: a fresh `claude -p` session, its model pinned,
# that builds the theme a brief describes with the kit alone.
#
#   scripts/proof/launch.sh --id b06 --slug harbour --brief <file> --model <model id> --dest <folder> \
#     [--base kit-b06-base] [--design <folder>] [--dry-run]
#
# It refuses, before it reads or writes anything else: no --model (an exact model id, never an alias), a bad id, slug
# or base, a brief that is not a readable file, and a --dest that exists or lies inside this repository, inside the
# folder it runs from, inside the home folder's Claude Code folder or inside the home folder (the run's rules deny the
# home folder); a --design that does not exist, lies inside the home folder's Claude Code folder, or holds a file
# over 5 MB. Then it clones the base tag (one commit deep, that tag only), makes the branch proof/<id>-<slug>,
# deletes every path proof/leak-paths.txt lists and commits the deletion, commits proof/<id>/{BRIEF.md,RUN.md,GAPS.md,
# BASE} and, with --design, proof/<id>/design/ (a copy of the design handoff folder, preserving names, skipping any
# `*.js` file as a design tool's own runtime rather than the design, both listed in RUN.md), gives the clone the git
# identity this machine commits with, writes the clone's Claude Code settings (the base's proof/run-settings.json,
# filled in with the clone's paths: the run's permission rules and its sandbox, kept out of git) and the run's task
# (proof/PROMPT.md, filled in) to <dest>.prompt.md, and prints the run's command.
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
readonly GIT_CONFIG_SNAPSHOT_SUFFIX='.git-config.snapshot'
# A design handoff folder (--design): the largest file it may hold, and the files it never copies (a design tool's
# own runtime, never the design itself).
readonly DESIGN_MAX_BYTES=$((5 * 1024 * 1024))
readonly DESIGN_SKIP_GLOB='*.js'
# The version-manager layouts under $HOME whose node install prefix the sandbox may read (relative to $HOME, the
# version a wildcard). A prefix that is $HOME itself, a direct child of it, or anything else not on this list gets no
# allowRead at all: narrower than the prefix itself, which would otherwise hand the sandbox the home folder back.
readonly TOOLCHAIN_PREFIX_PATTERNS=(
  '^[.]nvm/versions/node/[^/]+$'
  '^[.]volta/tools/image/node/[^/]+$'
  '^[.]local/share/fnm/node-versions/[^/]+/installation$'
  '^[.]asdf/installs/nodejs/[^/]+$'
)

ID='' SLUG='' BRIEF='' MODEL='' BASE="$DEFAULT_BASE" DEST='' DESIGN='' DRY_RUN=0 CLAUDE_HOME='' BASE_COMMIT=''
NPM_CACHE='' TOOLCHAIN_BIN='' TOOLCHAIN_NPM=''
# The design folder's copied and skipped files, one `- <path>` line each (copy_design); written into RUN.md.
DESIGN_COPIED='' DESIGN_SKIPPED=''

say() { printf '[proof] %s\n' "$*"; }
refuse() { printf '[proof] REFUSED: %s\n' "$*" >&2; exit 1; }
usage() {
  printf '%s\n' 'usage: scripts/proof/launch.sh --id <id> --slug <slug> --brief <file> --model <model id> --dest <folder>' \
    '                                [--base <tag>] [--design <folder>] [--dry-run]'
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
      --design) value_of "$@"; DESIGN=$2; shift 2 ;;
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

# --design is optional. Sets DESIGN to its real path once it exists, lies outside the home folder's Claude Code
# folder and holds no file over DESIGN_MAX_BYTES; a path with spaces is fine (real_dir resolves it with cd, not glob).
check_design() {
  [ -n "$DESIGN" ] || return 0
  local design_dir big
  design_dir=$(real_dir "$DESIGN")
  [ -n "$design_dir" ] || refuse "--design $DESIGN is not a folder."
  ! is_within "$design_dir" "$CLAUDE_HOME" || refuse "--design $DESIGN is inside the home folder's Claude Code folder; the launcher never reads there."
  big=$(find "$design_dir" -type f -size "+${DESIGN_MAX_BYTES}c" -print 2>/dev/null | head -1)
  [ -z "$big" ] || refuse "--design $DESIGN holds a file over 5 MB ($big): keep a design handoff small."
  DESIGN="$design_dir"
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

# Sets TOOLCHAIN_BIN and TOOLCHAIN_NPM: the node binary's own real folder and <prefix>/lib/node_modules/npm, when
# node's install prefix (two folders up from its real binary) lies inside the home folder at a layout
# TOOLCHAIN_PREFIX_PATTERNS knows; both empty otherwise, with a warning when the prefix is under the home folder but
# not one of those layouts (a made-up node under ~/bin, say, whose prefix is the home folder itself). Only these two
# narrow paths go in the sandbox's allowRead, carving them out of denyRead, which is the sandbox's documented rule
# but unproven here until the first real launch; failIfUnavailable stops the run if the sandbox can't start at all.
find_toolchain() {
  local node real_node prefix home relative pattern
  node=$(command -v node || true)
  case "$node" in /*) ;; *) return 0 ;; esac
  real_node=$(real_file "$node")
  prefix=$(dirname "$(dirname "$real_node")")
  home=$(real_dir "$HOME")
  [ -n "$home" ] && is_within "$prefix" "$home" || return 0
  if [ "$prefix" = "$home" ]; then
    say "warning: node's install prefix is the home folder itself ($prefix); the sandbox will not read it, so npm or node may fail to start."
    return 0
  fi
  relative=${prefix#"$home"/}
  for pattern in "${TOOLCHAIN_PREFIX_PATTERNS[@]}"; do
    if [[ "$relative" =~ $pattern ]]; then
      TOOLCHAIN_BIN=$(dirname "$real_node")
      TOOLCHAIN_NPM="$prefix/lib/node_modules/npm"
      return 0
    fi
  done
  say "warning: node's install prefix ($prefix) is under the home folder but not a known version-manager layout (nvm, volta, fnm or asdf); the sandbox will not read it, so npm or node may fail to start."
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

# A design handoff folder (--design): copied into proof/<id>/design/, preserving names, before the proof-folder
# commit. A design tool's own runtime, never the design itself, is skipped (support.js, and any other *.js file);
# DESIGN_COPIED and DESIGN_SKIPPED hold what happened, one `- <path>` line each, for RUN.md.
copy_design() {
  [ -n "$DESIGN" ] || return 0
  local dest_dir="$DEST/proof/$ID/design" file rel
  mkdir -p "$dest_dir"
  while IFS= read -r -d '' file; do
    rel=${file#"$DESIGN"/}
    case "$rel" in
      $DESIGN_SKIP_GLOB) DESIGN_SKIPPED="${DESIGN_SKIPPED}- $rel"$'\n' ;;
      *)
        mkdir -p "$dest_dir/$(dirname "$rel")"
        cp -- "$file" "$dest_dir/$rel"
        DESIGN_COPIED="${DESIGN_COPIED}- $rel"$'\n'
        ;;
    esac
  done < <(find "$DESIGN" -type f -print0 | sort -z)
  say "design: copied $(printf '%s' "$DESIGN_COPIED" | grep -c '^-' || true) file(s) from $DESIGN into proof/$ID/design/, skipped $(printf '%s' "$DESIGN_SKIPPED" | grep -c '^-' || true)"
}

# The run's "What the run did" section, with a "Design handoff" list when --design copied or skipped anything.
design_section() {
  [ -n "$DESIGN_COPIED$DESIGN_SKIPPED" ] || return 0
  printf '\n## Design handoff\n\n%s, copied into proof/%s/design/, preserving names. %s files (a design tool runtime, never the design itself) are skipped.\n\nCopied:\n\n%s\nSkipped:\n\n%s' \
    "--design $DESIGN" "$ID" "$DESIGN_SKIP_GLOB" "${DESIGN_COPIED:-(none)$'\n'}" "${DESIGN_SKIPPED:-(none)$'\n'}"
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
$(design_section)
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
  copy_design
  write_run_record
  write_gaps
  if [ -n "$DESIGN" ]; then
    git -C "$DEST" add -- "proof/$ID/BRIEF.md" "proof/$ID/RUN.md" "proof/$ID/GAPS.md" "proof/$ID/BASE" "proof/$ID/design"
  else
    git -C "$DEST" add -- "proof/$ID/BRIEF.md" "proof/$ID/RUN.md" "proof/$ID/GAPS.md" "proof/$ID/BASE"
  fi
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

# .git/config once it holds the run's commit identity, so it can be checked and restored after the run; the run's
# own commits still write .git/index and .git/objects, which this never touches.
snapshot_git_config() {
  cp "$DEST/.git/config" "$DEST$GIT_CONFIG_SNAPSHOT_SUFFIX"
}

# The non-sample files .git/hooks holds: a hook written despite the sandbox's and the permission rules' denyWrite,
# which could run on this machine the next time one of these hooks fires.
hook_files() {
  find "$DEST/.git/hooks" -type f ! -name '*.sample'
}

# Checks .git/hooks and .git/config right after the run, before any git command touches the clone again, and resets
# whichever changed, saying so: a hook or a config value a later git command on this machine could run or be
# redirected by otherwise.
check_git_integrity() {
  local hooks hook
  hooks=$(hook_files)
  if [ -n "$hooks" ]; then
    say "the run left non-sample files in .git/hooks; removing them before any git command touches the clone again:"
    while IFS= read -r hook; do say "  $hook"; rm -f "$hook"; done <<< "$hooks"
  fi
  if ! cmp -s "$DEST/.git/config" "$DEST$GIT_CONFIG_SNAPSHOT_SUFFIX"; then
    say "the run changed .git/config; resetting it to its snapshot before any git command touches the clone again."
    cp "$DEST$GIT_CONFIG_SNAPSHOT_SUFFIX" "$DEST/.git/config"
  fi
  rm -f "$DEST$GIT_CONFIG_SNAPSHOT_SUFFIX"
}

# The run's settings: the base's template filled in with absolute paths. {{CLONE}} is the clone's real path (in a
# permission rule, /{{CLONE}} is the //-prefixed absolute form), {{NPM_CACHE}} npm's cache beside it,
# {{TOOLCHAIN_BIN}}/{{TOOLCHAIN_NPM}} node's own folder and its npm's when node's prefix is a known layout inside the
# home folder (their line is dropped otherwise). Under --permission-mode dontAsk a call its rules don't allow is
# denied, with no prompt; the sandbox holds Bash and every process it starts.
fill_settings() {
  local toolchain_line='/{{TOOLCHAIN_BIN}}/d'
  [ -z "$TOOLCHAIN_BIN" ] || toolchain_line="s#{{TOOLCHAIN_BIN}}#$TOOLCHAIN_BIN#g; s#{{TOOLCHAIN_NPM}}#$TOOLCHAIN_NPM#g"
  sed -e "$toolchain_line" -e "s#{{CLONE}}#$DEST#g" -e "s#{{NPM_CACHE}}#$NPM_CACHE#g" "$DEST/$RUN_SETTINGS"
}

# The run's settings, kept out of git by .git/info/exclude, npm's cache folder, and the kit's skills linked in as
# Claude Code skills. settings.json is made unwritable (chmod a-w) once it is filled in, so even a write neither the
# sandbox nor the permission rules catch fails at the filesystem.
write_settings() {
  [ -f "$DEST/$RUN_SETTINGS" ] || refuse "$BASE has no $RUN_SETTINGS: the launcher needs a base that holds the run's settings."
  mkdir -p "$DEST/$SETTINGS_DIR" "$NPM_CACHE"
  fill_settings > "$DEST/$SETTINGS_DIR/settings.json"
  case "$(cat "$DEST/$SETTINGS_DIR/settings.json")" in *'{{'*) refuse "$RUN_SETTINGS has a placeholder the launcher does not fill." ;; esac
  chmod a-w "$DEST/$SETTINGS_DIR/settings.json"
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
  snapshot_git_config
  say "running; the transcript goes to $DEST$TRANSCRIPT_SUFFIX. This waits until the run stops."
  local status=0
  ( cd "$DEST" && CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 npm_config_cache="$NPM_CACHE" npm_config_userconfig="$NPM_USERCONFIG" \
      claude -p --model "$MODEL" --output-format stream-json --verbose \
      --setting-sources project --permission-mode dontAsk --no-session-persistence < "$DEST$PROMPT_SUFFIX" ) \
    > "$DEST$TRANSCRIPT_SUFFIX" || status=$?
  check_git_integrity
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
  check_design
  check_dest
  find_toolchain
  check_settings_path --dest "$DEST"
  check_settings_path "node's prefix (bin)" "$TOOLCHAIN_BIN"
  check_settings_path "node's prefix (npm)" "$TOOLCHAIN_NPM"
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
