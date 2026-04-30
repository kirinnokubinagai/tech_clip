---
name: review-pre-check
description: レビュー前の事前チェック（lint/typecheck/test）。失敗時は CHANGES_REQUESTED を実装エージェントに送信してフェーズ 0 に戻る。reviewer / infra-reviewer / ui-reviewer が共通で呼び出す。
triggers:
  - "review-pre-check"

  - "review-pre-check"
  - "事前チェック"
---

# レビュー事前チェックスキル

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{impl_agent_name}`: 実装エージェント名
- `{issue_number}`: Issue 番号

## 手順

スクリプトを実行する:

```
WORKTREE={worktree} bash scripts/skills/pre-check.sh
```

スクリプトは lint → typecheck → test の順に実行し、最初に失敗した段階で終了する。

### 出力に応じた処理

- `FAIL:lint` / `FAIL:typecheck` / `FAIL:test` → 失敗内容を読み取り、以下を送信してフェーズ 0 に戻る:
  ```
  SendMessage(to: "{impl_agent_name}",
    "CHANGES_REQUESTED: 事前チェックが失敗しました。以下を修正してください:\n\n<失敗した項目と出力>")
  ```

- `OK:all_passed` → 呼び出し元の次フェーズ（コードレビュー）へ進む

## STUCK vs CHANGES_REQUESTED（必読）

| 状況 | 正しい対応 |
|---|---|
| pnpm lint / typecheck / test が失敗 | `CHANGES_REQUESTED` を `{impl_agent_name}` に送信してフェーズ 0 へ |
| コードレビューで指摘あり | `CHANGES_REQUESTED` を `{impl_agent_name}` に送信してフェーズ 0 へ |
| PR E2E が失敗 | `CHANGES_REQUESTED` を `{impl_agent_name}` に送信してフェーズ 0 へ |
| conflict が発生 | `CONFLICT_INVESTIGATE` を analyst に送信 |
| push が infrastructure 理由でブロック | `STUCK` を orchestrator に送信 |
| CI システム障害・人間判断が必要な問題 | `STUCK` を orchestrator に送信 |

**lint/test の失敗を「pre-existing failures」と判断して STUCK にすることは禁止。**
