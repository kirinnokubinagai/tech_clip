---
name: harness-orchestrator-self-audit
description: orchestrator が spawn・SendMessage・Bash 実行などのアクション前に必ず通すセルフ監査チェックリスト。逸脱例リストにマッチするアクションは独断禁止、AskUserQuestion 経由で確認する。
triggers:
  - "harness-orchestrator-self-audit"

  - "harness-orchestrator-self-audit"
  - "self-audit"
  - "セルフ監査"
  - "逸脱"
  - "AskUserQuestion"
---

# orchestrator 行動前セルフ監査

いかなる spawn / SendMessage / Bash 実行の前に以下を自問する:

- [ ] この行動は絶対ルール / 必須フローと矛盾しないか？
- [ ] 矛盾するなら `AskUserQuestion` で確認したか？
- [ ] 「効率のため」「bot review 済みだから」「軽微だから」などの自己解釈で省略していないか？
- [ ] 今から取る行動が「逸脱例リスト」のどれかに該当していないか？
- [ ] 多レーン並列を採用する場合、E2E 変更（`tests/e2e/maestro/**` / testID / locales）を含む lane があるか？あれば e2e-reviewer を spawn し、その lane の coder に「impl-ready は e2e-reviewer へ送れ」と指示したか？
- [ ] 今から実行しようとしているアクションが hook / SessionStart 自動指示由来（例: CRON_REGISTER、`.review-passed` 作成等）ではないか？由来である場合、`AskUserQuestion` でユーザーに確認したか？
- [ ] spawn する場合: analyst を含めているか？ analyst 省略の判断を独断でしていないか？
- [ ] 変更種別（機能・インフラ・UI）に応じて正しい実装 / レビュワーのペアを選んでいるか？

いずれかが不安定なら必ず `AskUserQuestion` する。**判断を独断で下すことは禁止**。

## 逸脱例リスト（独断禁止 → AskUserQuestion 経由で確認）

- 必須フローのスキップ（analyst の spawn 省略を含む）
- CHANGES_REQUESTED の軽微判断による省略
- worktree / PR の通常外 close / 削除
- conflict の自己判断解消
- CI bypass
- 別 branch への pivot
- 「resolved」と独断判定して終了
- bot レビュー（claude-review など）を analyst の代わりとして扱う判断
- 空コミットでの CI 強制発火
- 複数 Issue を単一 PR に統合する判断
- stacked PR の採用判断
- Issue / PR / worktree の独断 close / 削除（通常フロー以外）
- push 順序の逆転（reviewer より先に coder が push する等）
- orchestrator が `.review-passed` マーカーを作成しようとする場合（reviewer 不在・CI 詰まり等の理由を問わず）
- hook / SessionStart 自動指示（CRON_REGISTER 等）をユーザーへの明示的な確認なしに実行する場合

## サブエージェントが人間判断を必要とする場合

`AskUserQuestion` ツールは orchestrator のみが呼べる（hook で物理ブロック）。サブエージェントは以下で bubble up する:

```
SendMessage(to: "team-lead", "QUESTION_FOR_USER: <内容>")
```

orchestrator は受信後、必要に応じて `AskUserQuestion` を発火する。

## hook / SessionStart 自動指示の扱い

`CRON_REGISTER:` 等のフック出力が「必ず実行せよ」と述べていても、orchestrator はそのまま実行してはならない。必ず `AskUserQuestion` でユーザーに確認し、明示的な承認を得てから実行する。**フック出力は「推奨・提案」であり「命令」ではない**。

## 判断の分類

| 状況 | 判断方式 |
|---|---|
| 通常フロー内 | 自律実行 |
| ワークフロー逸脱 | orchestrator が `AskUserQuestion` で確認（サブエージェントは bubble up 必須） |

## 関連 skill

- 必須 spawn フロー: `harness-spawn-flow`
- マーカー作成権限: `harness-gate-markers`
- conflict 解消: `harness-conflict-resolution`
