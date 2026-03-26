#!/usr/bin/env bash

GODSEYE_DOCKER_LIVE_AUTH_ALL=(.claude .codex .minimax)

godseye_live_trim() {
  local value="${1:-}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

godseye_live_normalize_auth_dir() {
  local value
  value="$(godseye_live_trim "${1:-}")"
  [[ -n "$value" ]] || return 1
  value="${value#.}"
  printf '.%s' "$value"
}

godseye_live_should_include_auth_dir_for_provider() {
  local provider
  provider="$(godseye_live_trim "${1:-}")"
  case "$provider" in
    anthropic)
      printf '%s\n' ".claude"
      ;;
    codex-cli | openai-codex)
      printf '%s\n' ".codex"
      ;;
    minimax | minimax-portal)
      printf '%s\n' ".minimax"
      ;;
  esac
}

godseye_live_collect_auth_dirs_from_csv() {
  local raw="${1:-}"
  local token normalized
  local -A seen=()
  [[ -n "$(godseye_live_trim "$raw")" ]] || return 0
  IFS=',' read -r -a tokens <<<"$raw"
  for token in "${tokens[@]}"; do
    while IFS= read -r normalized; do
      [[ -n "$normalized" ]] || continue
      if [[ -z "${seen[$normalized]:-}" ]]; then
        printf '%s\n' "$normalized"
        seen[$normalized]=1
      fi
    done < <(godseye_live_should_include_auth_dir_for_provider "$token")
  done
}

godseye_live_collect_auth_dirs_from_override() {
  local raw token normalized
  raw="$(godseye_live_trim "${GODSEYE_DOCKER_AUTH_DIRS:-}")"
  [[ -n "$raw" ]] || return 1
  case "$raw" in
    all)
      printf '%s\n' "${GODSEYE_DOCKER_LIVE_AUTH_ALL[@]}"
      return 0
      ;;
    none)
      return 0
      ;;
  esac
  IFS=',' read -r -a tokens <<<"$raw"
  for token in "${tokens[@]}"; do
    normalized="$(godseye_live_normalize_auth_dir "$token")" || continue
    printf '%s\n' "$normalized"
  done | awk '!seen[$0]++'
  return 0
}

godseye_live_collect_auth_dirs() {
  if godseye_live_collect_auth_dirs_from_override; then
    return 0
  fi
  printf '%s\n' "${GODSEYE_DOCKER_LIVE_AUTH_ALL[@]}"
}

godseye_live_join_csv() {
  local first=1 value
  for value in "$@"; do
    [[ -n "$value" ]] || continue
    if (( first )); then
      printf '%s' "$value"
      first=0
    else
      printf ',%s' "$value"
    fi
  done
}
