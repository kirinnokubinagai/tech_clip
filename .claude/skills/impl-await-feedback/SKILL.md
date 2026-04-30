---
name: impl-await-feedback
description: 実装系（coder/infra-engineer/ui-designer）が impl-ready 送信後に呼ぶ返答待機ループ。CHANGES_REQUESTED / CONFLICT_RESOLVE / APPROVED / shutdown_request の各メッセージに応じて分岐する。
triggers:
  - "impl-await-feedback"

  - "impl-await-feedback"
  - "返答待機"
  - "feedback待機"
---

# 返答待機ループ

`impl-ready: <hash>` を e2e-reviewer に送信した後、以下のメッセージを待機する。

| 受信メッセージ | アクション |
|---|---|
| `APPROVED` | 終了する |
| `shutdown_request` | `shutdown_response (approve: true)` を返してから終了 |
| `CHANGES_REQUESTED: <feedback>` | feedback を読んで修正 → `auto-fix.sh` 試行 → 失敗時手動修正 → `impl-lint-commit-notify` に戻る |
| `CONFLICT_RESOLVE: spec=<path>` | `impl-conflict-resolve-loop` skill へ進む |

## CHANGES_REQUESTED の処理

```bash
bash {worktree}/scripts/gate/auto-fix.sh
```

- exit 0: 自動修正成功 → その commit を使用 → `impl-lint-commit-notify` 再実行
- exit 1: 手動修正が必要 → feedback を読んで該当箇所を直す → `impl-lint-commit-notify` 再実行

## 出口条件

`APPROVED` または `shutdown_request` で agent 終了。それ以外は待機継続。

## 関連 skill

- `impl-lint-commit-notify` — 修正後の再通知
- `impl-conflict-resolve-loop` — conflict 解消
- `harness-standard-flow-discipline` — 「軽微だから無視」等の独断禁止
