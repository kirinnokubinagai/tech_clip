---
name: harness-standard-flow-discipline
description: サブエージェントが標準ワークフローから外れる判断を独断で行わないための規律。「軽微だから無視」「scope 明確だから analyst 不要」等の自己解釈を禁止し、必要なら orchestrator に bubble up する。全 role 共通。
triggers:
  - "harness/standard-flow-discipline"
  - "標準フロー外"
  - "QUESTION_FOR_USER"
  - "AskUserQuestion"
---

# 標準フロー外判断の禁止

サブエージェントは標準ワークフローから外れる判断を **独断で行ってはならない**。判断が必要な場合は orchestrator に bubble up する。

## bubble up 方法

```
SendMessage(to: "team-lead", "QUESTION_FOR_USER: <内容>")
```

orchestrator が `AskUserQuestion` ツールでユーザーに確認する（`AskUserQuestion` はサブエージェントから直接呼べない、hook で物理ブロック）。

## 逸脱例（独断禁止）

以下は「ワークフロー逸脱」とみなし、独断で実行してはならない:

- CLAUDE.md / 必須フローのスキップ
- CHANGES_REQUESTED の軽微判断による省略
- worktree / PR / Issue の通常外 close / 削除
- conflict の自己判断解消
- CI bypass
- 別 branch / 別 PR への pivot
- 「resolved」「already fixed」と判定して作業を終了
- ruleset / branch protection の bypass
- 別 PR のコミットと自ブランチのコミットの混同
- bot レビュー（claude-review 等）を analyst の代替として扱う
- 空コミットでの CI 強制発火
- 複数 Issue を単一 PR に統合
- stacked PR の採用
- push 順序の逆転（reviewer より先に実装系が push する等）
- `.review-passed` / `.e2e-passed` マーカーの手動作成（reviewer/e2e-reviewer 以外）

## 禁止事項

- 上記を独断で実行する
- 「軽微だから」「文脈的に明らか」と決めつける
- `AskUserQuestion` を直接呼ぶ（hook で物理 block される）

## 例外（通常フロー内 = 自律実行可）

- 通常範囲内のコード修正・テスト・lint チェック・SendMessage
- CLAUDE.md に明記された自動化処理
