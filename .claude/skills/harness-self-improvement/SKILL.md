---
name: harness-self-improvement
description: ハーネス（CLAUDE.md / .claude/ 配下の skill / hook / agent 定義 / rules）の改善が必要と判断したとき、orchestrator が main で直接編集する代わりに Issue を立てて worktree + spawn-flow 経由で PR を作成する手順。memory ファイル (`.claude-user/**`) のみ例外として直接編集可能。
triggers:
  - "harness-self-improvement"
  - "ハーネス改善"
  - "skill 修正"
  - "CLAUDE.md 修正"
  - "hook 修正"
  - "ルール修正"
  - "self improvement"
---

# ハーネス自己改善ループ

orchestrator またはサブエージェントの挙動について指摘・改善要請を受けた場合、または orchestrator 自身がハーネスの抜け漏れを検知した場合、**main で直接編集することは禁止**（hook で物理ブロック）。必ずこの skill を呼んで Issue + PR 経由で修正する。

## 適用範囲

| 対象 | 直接編集 | この skill 経由 |
|---|---|---|
| `CLAUDE.md` | ❌ 禁止 | ✅ 必須 |
| `.claude/skills/**` | ❌ 禁止 | ✅ 必須 |
| `.claude/hooks/**` | ❌ 禁止 | ✅ 必須 |
| `.claude/agents/**` | ❌ 禁止 | ✅ 必須 |
| `.claude/rules/**` | ❌ 禁止 | ✅ 必須 |
| `.claude/settings.json` | ❌ 禁止 | ✅ 必須 |
| `.claude-user/**` (memory) | ✅ 許可 | – |
| `.omc/**` (gitignore済み) | ✅ 許可 | – |

## 実行手順

### Step 1: 改善内容の整理

以下を整理する (orchestrator は memory ファイルや内部メモで一時保管してよい):

- **何が起きたか** (具体的な逸脱・誤判断・抜け漏れの説明)
- **影響範囲** (どのフェーズ / どのエージェント / どのファイル)
- **根本原因** (skill の文言が曖昧 / hook が未実装 / ルール未定義 など)
- **対策案** (どのファイルをどう変更すれば再発防止できるか)

### Step 2: Issue 作成

`create-issue` skill を呼び出して GitHub Issue を作成する。

タイトル形式:
```
fix(harness): <短い改善概要>
chore(harness): <短い改善概要>  # 規約整理など fix 性が薄い場合
```

本文には以下を含める:

- 背景 (何が起きたか)
- 修正対象ファイル一覧
- 受け入れ条件 (どうなれば再発防止と言えるか)
- テスト追加方針 (hook 修正なら bats、skill 修正は文書のみで可)

### Step 3: spawn-flow で着手

`harness-spawn-flow` skill を呼んで通常通り 4 体セット spawn する。

- impl_role: 通常 `coder` (hook / skill / 規約変更は coder スコープ)
- reviewer_role: 通常 `reviewer`

### Step 4: 自動 review → merge

通常フロー (analyst → coder → e2e-reviewer → reviewer → push → CI → merge) に乗せる。
orchestrator は `APPROVED: issue-N` を受け取って完了。

## 例外: 緊急修正の扱い

ハーネスがフロー全体を停止させるレベルのバグ (例: spawn-flow が全 Issue で fail) でも、main 直接編集は禁止。
緊急時は次の優先順位で対応する:

1. **memory ファイルへの一時的な workaround** (`.claude-user/**` の指示を更新して動作を変える) — 直接編集可
2. **新規 Issue を最高優先度で立てる** (`harness-self-improvement` 経由)
3. **fast-track spawn-flow** (Issue 化を 1 minute で済ませてすぐに 4 体 spawn)

## 禁止事項

- ❌ 「軽微だから直接編集」: hook が物理ブロック、また `.claude-user/**` 例外を悪用しない
- ❌ Issue を立てずに worktree だけ作る: トレーサビリティ喪失
- ❌ ハーネス改善 PR を main へ直接 push: 通常 PR フロー必須
- ❌ ハーネス改善 PR で機能変更も同梱: 関係ない変更を巻き込まない (1 PR 1 関心事)

## 関連 skill

- `harness-orchestrator-self-audit` — 逸脱例リスト
- `harness-spawn-flow` — Issue 着手の必須 spawn フロー
- `create-issue` — Issue 作成テンプレート
