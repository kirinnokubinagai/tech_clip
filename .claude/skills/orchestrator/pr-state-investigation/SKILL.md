---
name: pr-state-investigation
description: PR のマージ可否・レビュー完了を判断する 5 ステップ調査。orchestrator が PR 状態を正確に把握するために使用する。
triggers:
  - "orchestrator/pr-state-investigation"
  - "PR状態調査"
---

# PR 状態調査スキル

PR のマージ可否を判断する際は必ずこのスキルを使用する。1 つでもステップを省略すると誤判定する可能性がある。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{PR_NUMBER}`: PR 番号
- `{REPO}`: （任意）`owner/repo` 形式のリポジトリ名

## 手順

スクリプトを実行する:

```
PR_NUMBER={PR_NUMBER} REPO={REPO} bash scripts/skills/pr-state-check.sh
```

スクリプトの出力（Step 1〜5）を読み、以下の判定基準に従う。

## 判定基準

すべてを満たす場合のみ「マージ可能」と判定する:

- Step 1: `mergeStateStatus == CLEAN`
- Step 2: PR コメントに claude-review bot からの「Request Changes」「❌」「要修正」がない
- Step 3: required check がすべて `SUCCESS`（`SKIPPED` は未通過扱い）
- Step 4: Ruleset で必須とされた check がすべて通過している

## 禁止事項

- `SKIPPED` を「問題なし」と判断する
- bot コメントを読まずに通過と判断する
- `mergeStateStatus` 以外の指標だけで判断する
- 「軽微な指摘だから無視」と自己判断する
