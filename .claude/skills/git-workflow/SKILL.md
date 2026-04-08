---
name: git-workflow
description: Git/GitHub の正しい操作ガイド。ブランチ操作、PR作成、コンフリクト対応時に参照する。
---

# Git / GitHub ワークフロー

## 基本原則

Claude はコードを書いてコミット・プッシュ・PR 作成まで行う。**マージは CI が行う。Claude はマージしない。**

## 許可されている操作

| 操作 | コマンド |
|------|---------|
| ブランチ作成 | `git worktree add "${WORKTREE_BASE}/issue-N" -b issue/N/desc origin/main` |
| ステージング | `git add <specific-files>` |
| コミット | `git commit -m "..."` |
| プッシュ | `git push -u origin <branch>` (作業ブランチのみ) |
| PR 作成 | `gh pr create --title "..." --body "..."` |
| 差分確認 | `git diff`, `git status`, `git log` |
| worktree 削除 | `git worktree remove "${WORKTREE_BASE}/issue-N"` |

## 禁止されている操作（settings.json で強制）

| 操作 | 理由 |
|------|------|
| `git merge`（main 上で） | main ブランチ上でのマージ禁止（push deny で防止） |
| `git rebase` | 履歴書き換え禁止。force push が必要になる |
| `git restore .` | 全ファイル復元で作業内容が消える |
| `git reset --hard` | 破壊的リセット |
| `git push --force` | リモート履歴の破壊 |
| `git checkout -- .` | 全ファイル復元 |
| `gh pr merge` | ローカルからのマージ |
| `git push origin main` | main への直接プッシュ |

## コンフリクト発生時

作業ブランチで `git merge origin/main` を実行してコンフリクトを解消する。main への push は deny で防止済みなので安全。

```bash
git fetch origin main
git merge origin/main
# コンフリクトマーカーを手動で解消
git add <解消したファイル>
git commit -m "merge: resolve conflict with main #<issue番号>"
git push
```

## PR 作成後のフロー

1. PR 作成完了を報告
2. code-reviewer エージェントでレビュー実行
3. 指摘があれば PR 内で修正 → 再プッシュ → 再レビュー
4. 全件 PASS を確認して報告
5. **CI が自動で Approve → マージ**（Claude は何もしない）

## worktree の使い方

```bash
# REPO_ROOT: mainブランチのリポジトリルート（worktree内部でも正しく解決）
REPO_ROOT=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
# WORKTREE_BASE: mainと兄弟のディレクトリ（REPO_ROOTの親）
WORKTREE_BASE=$(dirname "$REPO_ROOT")

# 作成（必ず origin/main から）
git worktree add "${WORKTREE_BASE}/issue-N" -b issue/N/short-desc origin/main

# 作業完了後のクリーンアップ（マージ済みの場合のみ）
git worktree remove "${WORKTREE_BASE}/issue-N"
git branch -d issue/N/short-desc
```

- worktree は main と同じ親ディレクトリに兄弟として作成
- ブランチ名は `issue/<番号>/<kebab-case説明>`
- main worktree から `git worktree add` する（worktree の中から作らない）

## やってはいけないパターン

| パターン | 問題 | 正しい対応 |
|---------|------|-----------|
| rebase → force push | deny で拒否される | `git merge origin/main` でコンフリクト解消 |
| worktree 内から worktree 作成 | パスがネストする | main worktree に戻って作成 |
| git restore . で状態リセット | 作業内容が全て消える | 個別ファイルのみ restore |
| main 上で merge | main を汚す | 作業ブランチで `git merge origin/main`（push deny で main 保護済み） |
| マージしますか？と聞く | CI が行うので不要 | レビュー結果を報告するだけ |
