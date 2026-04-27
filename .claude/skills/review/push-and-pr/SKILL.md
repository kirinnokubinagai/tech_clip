---
name: push-and-pr
description: フェーズ 5: .review-passed マーカー作成 → push-verified.sh → PR 作成（新規のみ）。reviewer/infra-reviewer/ui-reviewer 共通。
triggers:
  - "review/push-and-pr"
  - "push+PR作成"
---

# push + PR 作成スキル

レビュー PASS 後に `.review-passed` マーカーを作成し、push して PR を作成する。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{issue_number}`: Issue 番号
- `{PR_TITLE}`: PR タイトル（省略時は Issue タイトルを使用）

## 手順

**Step 1: orchestrator に push 開始を通知する（必須）**

push-verified.sh は lint + typecheck + test を実行するため 3〜5 分かかる。
開始前に必ず orchestrator へ通知し、無音タイムアウト誤判定を防ぐ:

```
SendMessage(to: "orchestrator", "PUSH_IN_PROGRESS: issue-{issue_number} push-verified.sh を開始します（lint + typecheck + test で 3〜5 分かかります）")
```

**Step 2: push + PR 作成スクリプトを実行する**

```sh
WORKTREE={worktree} \
ISSUE_NUMBER={issue_number} \
PR_TITLE="{PR_TITLE}" \
bash scripts/skills/push-and-pr.sh
```

### 出力に応じた処理

- `ERROR:push_failed` → orchestrator に以下を送信して終了:
  ```
  SendMessage(to: "orchestrator", "STUCK: issue-{issue_number} push が失敗しました")
  ```

- `ERROR:remote_hash_mismatch:local=...:remote=...` → orchestrator に以下を送信して終了:
  ```
  SendMessage(to: "orchestrator", "STUCK: issue-{issue_number} push が反映されていません (local != remote)")
  ```

- `OK:pr=<PR_NUMBER>` → `{PR_NUMBER}` を記録してフェーズ 6 へ進む

**注意**: `.review-passed` マーカーの作成は reviewer 系エージェントのみに許可。coder/infra-engineer/ui-designer は作成禁止。
