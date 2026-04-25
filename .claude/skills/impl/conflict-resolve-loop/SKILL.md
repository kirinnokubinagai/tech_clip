---
name: conflict-resolve-loop
description: CONFLICT_RESOLVE 受信時の conflict 解消フロー。spec に従って origin/main をマージし CONFLICT_RESOLVED を reviewer に通知する。coder/infra-engineer/ui-designer 共通。
triggers:
  - "impl/conflict-resolve-loop"
  - "conflict解消"
---

# conflict 解消スキル

reviewer から `CONFLICT_RESOLVE: spec=<path>` を受信した後に実行する。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{reviewer_agent_name}`: レビュワーエージェント名
- `{CONFLICT_SPEC_PATH}`: analyst が作成した解消 spec のパス

## 手順

### 1. spec を読む

`{CONFLICT_SPEC_PATH}` を Read ツールで読み込み、両立解消方針を確認する。

### 2. origin/main をマージ

```
WORKTREE={worktree} bash scripts/skills/conflict-resolve.sh
```

### 出力に応じた処理

- `OK:merged` / `OK:already_uptodate` → ステップ 3 へ進む
- `CONFLICT:files=<list>` → spec の方針に従って conflict を手動解消する:
  1. 各 conflict ファイルを Edit ツールで修正（spec の両立方針に従う）
  2. `git -C {worktree} add <files>`
  3. `git -C {worktree} commit --no-edit`
  4. ステップ 3 へ進む

### 3. reviewer に CONFLICT_RESOLVED 通知

```
SendMessage(to: "{reviewer_agent_name}", "CONFLICT_RESOLVED: <commit-hash>")
```

commit-hash は `git -C {worktree} rev-parse HEAD` で取得する。

その後、reviewer からの次の指示（再レビュー結果）を待機する。
