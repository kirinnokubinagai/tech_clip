---
name: e2e-visual-review
description: フェーズ 6.5: PR E2E (Android) の run 取得 → artifact DL → スクリーンショット視覚レビュー → JUnit 確認。reviewer/infra-reviewer 共通。
triggers:
  - "review/e2e-visual-review"
  - "E2E視覚レビュー"
---

# PR E2E 視覚レビュースキル

フェーズ 6 で `AI Review: PASS` ラベルを確認した後に実行する。**省略禁止。**

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{issue_number}`: Issue 番号
- `{impl_agent_name}`: 実装エージェント名
- `{PR_NUMBER}`: PR 番号

## 手順

スクリプトを実行して E2E artifact を取得する:

```
WORKTREE={worktree} PR_NUMBER={PR_NUMBER} bash scripts/skills/e2e-visual-review.sh
```

### 出力に応じた処理

- `SKIP:no_e2e_run` / `SKIP:pr_not_found` → E2E run が存在しない。このフェーズをスキップしてフェーズ 7 へ進む

- `FAIL:e2e_failed:...` → 失敗詳細を読み取り、以下を送信してフェーズ 0 に戻る:
  ```
  SendMessage(to: "{impl_agent_name}",
    "CHANGES_REQUESTED: PR E2E (Android) が失敗しました: <details>")
  ```

- `TIMEOUT:e2e_run_still_running` → orchestrator に `STUCK` を送信:
  ```
  SendMessage(to: "orchestrator", "STUCK: issue-{issue_number} E2E run が 45 分以内に完了しませんでした")
  ```

- `ARTIFACTS_READY:dir=<path>` → スクリプト出力に続いてスクリーンショットパスが列挙される。
  各 `.png` ファイルを Read ツールで読み込み、以下を視覚確認する:
  - 画面が意図通り表示されているか
  - エラーメッセージや赤文字が出ていないか
  - UI が崩れていないか（要素が重なる、はみ出す等）
  - 日本語文字化けがないか

  `<path>/junit/junit.xml` も Read ツールで読み、pass/fail 件数と失敗ステップを確認する。

  **視覚問題あり** → 以下を送信してフェーズ 0 に戻る:
  ```
  SendMessage(to: "{impl_agent_name}",
    "CHANGES_REQUESTED: PR E2E 視覚レビューで以下を検出: <具体的な指摘>")
  ```

  **問題なし** → `{worktree}/.claude/tmp/` を削除してフェーズ 7 へ進む:
  ```
  rm -rf {worktree}/.claude/tmp/
  ```
