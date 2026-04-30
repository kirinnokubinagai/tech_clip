---
name: review-conflict-audit
description: CONFLICT_RESOLVED 受信時の解消結果監査。片側採用になっていないか・ロジックバグ混入がないかを確認し、問題あれば CHANGES_REQUESTED を返す。reviewer/infra-reviewer/ui-reviewer 共通。
triggers:
  - "review-conflict-audit"

  - "review-conflict-audit"
  - "解消結果監査"
---

# 解消結果監査スキル

`CONFLICT_RESOLVED: <commit-hash>` を受信した場合に実行する。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{impl_agent_name}`: 実装エージェント名
- `{issue_number}`: Issue 番号
- `{CONFLICT_RESOLVED_HASH}`: CONFLICT_RESOLVED で受け取った commit hash

## 手順

スクリプトを実行して解消 commit の変更内容を取得する:

```
WORKTREE={worktree} HASH={CONFLICT_RESOLVED_HASH} bash scripts/skills/conflict-audit.sh
```

出力（stat + diff）を読み、以下の監査チェックリストを確認する:

- [ ] **片側採用になっていないか**: Issue の意図と main の変更のどちらかが完全に消えていない
- [ ] **新しいロジックバグの混入がないか**: マージ後のコードに矛盾する処理がない
- [ ] **片方の import / 型定義が落ちていないか**: import 文の欠落、型エラーが生じていない

### 判定

**問題あり** → `{impl_agent_name}` に送信してフェーズ 0 に戻る:
```
SendMessage(to: "{impl_agent_name}",
  "CHANGES_REQUESTED: 解消結果に問題があります: <具体的な指摘>")
```

**問題なし** → 通常レビューフェーズへ進む（lint/test/観点チェック → push → polling まで）。
