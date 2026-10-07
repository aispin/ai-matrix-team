#!/bin/bash
# install-to-workbuddy.command · macOS 双击入口（薄壳）
# 真源是同目录的 install-to-workbuddy.mjs —— 这里只负责「找 node → 转参数」，不翻译第二份逻辑。
# 双击后会在新开的终端里跑；跑完不自动关窗，方便你看结果。

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
  echo "没找到可用的 node。请先安装 Node 18+，或手动指定后重跑：" >&2
  echo "  /path/to/node \"$HERE/install-to-workbuddy.mjs\"" >&2
  read -r -p "按回车键关闭…" _
  exit 1
fi

echo "使用 node：$NODE"
"$NODE" "$HERE/install-to-workbuddy.mjs" "$@"

echo ""
read -r -p "跑完了，按回车键关闭本窗口…" _
