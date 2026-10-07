#!/usr/bin/env bash
# install-to-workbuddy.sh · POSIX 薄壳入口（CI / 命令行用）
# 真源是同目录的 install-to-workbuddy.mjs —— 这里只负责「找 node → 转参数」。

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pick_node() {
  if command -v node >/dev/null 2>&1; then command -v node; return; fi
  for c in \
    "/Users/lv/.workbuddy/binaries/node/versions/22.22.2-3/bin/node" \
    "/opt/homebrew/bin/node" \
    "/usr/local/bin/node"; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  echo ""
}

NODE="$(pick_node)"
if [ -z "$NODE" ]; then
  echo "没找到可用的 node（需要 Node 18+）。" >&2
  exit 1
fi

exec "$NODE" "$HERE/install-to-workbuddy.mjs" "$@"
