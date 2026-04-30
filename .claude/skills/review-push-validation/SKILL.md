---
name: review-push-validation
description: impl-ready 受信時の push 状態検証。impl-ready hash と local HEAD の一致確認、uncommitted 変更チェック、PUSH_REQUIRED フラグ設定。reviewer/infra-reviewer/ui-reviewer 共通。
triggers:
  - "review-push-validation"

  - "review-push-validation"
  - "push状態検証"
---

# push 状態検証スキル

`impl-ready:` を受信した場合のみ実行する（`CONFLICT_RESOLVED:` 受信時はスキップ）。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{impl_agent_name}`: 実装エージェント名（例: `coder-1056`）
- `{issue_number}`: Issue 番号
- `{IMPL_READY_HASH}`: impl-ready メッセージで受け取った commit hash

## 手順

```sh
WORKTREE={worktree} \
ISSUE_NUMBER={issue_number} \
IMPL_AGENT_NAME={impl_agent_name} \
IMPL_READY_HASH={IMPL_READY_HASH} \
bash scripts/skills/push-validation.sh
```

### 出力に応じた処理

- `ERROR:hash_mismatch:impl=...:local=...` → SendMessage で `{impl_agent_name}` に以下を送信してフェーズ 0 に戻る:
  ```
  ERROR: impl-ready hash ({IMPL_READY_HASH}) が local HEAD と一致しません。正しい commit hash を送信してください。
  ```

- `ERROR:uncommitted_changes` → SendMessage で `{impl_agent_name}` に以下を送信してフェーズ 0 に戻る:
  ```
  ERROR: uncommitted changes が存在します。すべての変更を commit してから impl-ready を送信してください。
  ```

- 終了コード `1`（`PUSH_REQUIRED:pr=...:local=...:remote=...`）→ `PUSH_REQUIRED=true` として後続フェーズへ進む（フェーズ 5 で push 後に remote HEAD を再検証する）

- 終了コード `0`（`OK:hash=...`）→ `PUSH_REQUIRED=false` として後続フェーズへ進む
