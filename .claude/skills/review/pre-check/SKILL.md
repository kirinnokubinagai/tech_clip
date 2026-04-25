---
name: pre-check
description: レビュー前の事前チェック（lint/typecheck/test）。失敗時は CHANGES_REQUESTED を実装エージェントに送信してフェーズ 0 に戻る。reviewer / infra-reviewer / ui-reviewer が共通で呼び出す。
triggers:
  - "review/pre-check"
  - "事前チェック"
---

# レビュー事前チェックスキル

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{impl_agent_name}`: 実装エージェント名（例: `issue-1056-coder`, `issue-1074-infra-engineer`）
- `{issue_number}`: Issue 番号

## 手順

### 1. lint

```bash
LINT_OUTPUT=$(cd {worktree} && direnv exec {worktree} pnpm lint 2>&1 || true)
```

`error` または `✘` が出力に含まれる場合 → **手順 4: CHANGES_REQUESTED 送信** へ。

### 2. typecheck

```bash
TC_OUTPUT=$(cd {worktree} && direnv exec {worktree} pnpm typecheck 2>&1 || true)
```

エラーが含まれる場合 → **手順 4** へ。

### 3. テスト

```bash
TEST_OUTPUT=$(cd {worktree} && direnv exec {worktree} pnpm test 2>&1 || true)
```

失敗がある場合 → **手順 4** へ。

### 4. CHANGES_REQUESTED 送信（失敗時のみ）

```
SendMessage(to: "{impl_agent_name}",
  "CHANGES_REQUESTED: 事前チェックが失敗しました。以下を修正してください:\n\n<失敗した項目と出力>")
```

送信後、フェーズ 0 に戻り次の `impl-ready` を待つ。

### 5. 全件 PASS

すべて成功した場合、呼び出し元の次フェーズ（コードレビュー）へ進む。

---

## STUCK vs CHANGES_REQUESTED（必読）

| 状況 | 正しい対応 |
|---|---|
| pnpm lint / typecheck / test が失敗 | `CHANGES_REQUESTED` を `{impl_agent_name}` に送信してフェーズ 0 へ |
| コードレビューで指摘あり（CRITICAL/HIGH/MEDIUM/LOW） | `CHANGES_REQUESTED` を `{impl_agent_name}` に送信してフェーズ 0 へ |
| PR E2E が失敗 | `CHANGES_REQUESTED` を `{impl_agent_name}` に送信してフェーズ 0 へ |
| conflict が発生 | `CONFLICT_INVESTIGATE` を analyst に送信 |
| push が infrastructure 理由でブロック | `STUCK` を orchestrator に送信 |
| CI システム障害・spec の根本的な矛盾など人間判断が必要 | `STUCK` を orchestrator に送信 |

**lint/test の失敗を「pre-existing failures」と判断して STUCK にすることは禁止。**
コードに問題があれば常に `{impl_agent_name}` に返す。
