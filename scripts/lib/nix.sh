#!/usr/bin/env bash

ensure_nix_shell() {
  local repo_root="$1"
  shift

  if [ -n "${IN_NIX_SHELL:-}" ]; then
    return 0
  fi

  if [ -n "${TECHCLIP_NIX_BOOTSTRAPPED:-}" ]; then
    echo "ERROR: Nix shell への再入場に失敗しました" >&2
    exit 1
  fi

  if command -v direnv >/dev/null 2>&1; then
    exec env TECHCLIP_NIX_BOOTSTRAPPED=1 DIRENV_LOG_FORMAT= direnv exec "${repo_root}" bash "$0" "$@"
  fi

  if command -v nix >/dev/null 2>&1; then
    exec env TECHCLIP_NIX_BOOTSTRAPPED=1 nix develop "${repo_root}" --command bash "$0" "$@"
  fi

  cat >&2 <<'EOF'
ERROR: Nix / direnv が見つかりません
  1. Nix をインストール
  2. リポジトリで `direnv allow`
  3. もう一度コマンドを実行
EOF
  exit 1
}

sanitize_nix_tool_path() {
  local -a sanitized=()
  local dir
  local old_ifs="${IFS}"
  IFS=':'
  for dir in ${PATH}; do
    case "${dir}" in
      */node_modules/.bin) continue ;;
      /opt/homebrew/*) continue ;;
      /usr/local/*) continue ;;
      "${HOME}"/.asdf/*) continue ;;
    esac
    [ -n "${dir}" ] && sanitized+=("${dir}")
  done
  IFS=':'
  PATH="${sanitized[*]}"
  IFS="${old_ifs}"
  export PATH
}

resolve_preferred_command() {
  local cmd="$1"
  local candidate
  local fallback=""

  while IFS= read -r candidate; do
    [ -z "${candidate}" ] && continue
    case "${candidate}" in
      /nix/store/*)
        echo "${candidate}"
        return 0
        ;;
      */node_modules/.bin/*|/opt/homebrew/*|/usr/local/*|"${HOME}"/.asdf/*)
        continue
        ;;
      *)
        if [ -z "${fallback}" ]; then
          fallback="${candidate}"
        fi
        ;;
    esac
  done < <(type -ap "${cmd}" 2>/dev/null | awk '!seen[$0]++')

  if [ -n "${fallback}" ]; then
    echo "${fallback}"
    return 0
  fi

  return 1
}
