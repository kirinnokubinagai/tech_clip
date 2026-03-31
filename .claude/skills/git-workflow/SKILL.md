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
| ブランチ作成 | `git worktree add .worktrees/issue-N -b issue/N/desc origin/main` |
| ステージング | `git add <specific-files>` |
| コミット | `git commit -m "..."` |
| プッシュ | `git push -u origin <branch>` (作業ブランチのみ) |
| PR 作成 | `gh pr create --title "..." --body "..."` |
| 差分確認 | `git diff`, `git status`, `git log` |
| worktree 削除 | `git worktree remove .worktrees/issue-N` |
| 個別ファイル復元 | `git restore <specific-file>` |

## 禁止されている操作（settings.json で強制）

| 操作 | 理由 |
|------|------|
| `git merge` | ローカルでマージしない。CI のみ |
| `git rebase` | 履歴書き換え禁止。force push が必要になる |
| `git restore .` | 全ファイル復元で作業内容が消える |
| `git reset --hard` | 破壊的リセット |
| `git push --force` | リモート履歴の破壊 |
| `git checkout -- .` | 全ファイル復元 |
| `gh pr merge` | ローカルからのマージ |
| `git push origin main` | main への直接プッシュ |

## コンフリクト発生時

**Claude はコンフリクトを自分で解消しない。** ユーザーに報告する。

```
コンフリクトが発生しました。
対象ファイル: <ファイル名>
原因: main ブランチで <変更内容> が追加されたため

以下はユーザーが手動で実行する手順です（Claude は実行しません）:
1. `cd .worktrees/issue-N`
2. `git merge origin/main`
3. コンフリクトを解消して `git add <file>` → `git commit`
4. `git push`
```

## PR 作成後のフロー

1. PR 作成完了を報告
2. code-reviewer エージェントでレビュー実行
3. 指摘があれば PR 内で修正 → 再プッシュ → 再レビュー
4. 全件 PASS を確認して報告
5. **CI が自動で Approve → マージ**（Claude は何もしない）

## worktree の使い方

```bash
# 作成（必ず origin/main から）
git worktree add .worktrees/issue-N -b issue/N/short-desc origin/main

# 作業完了後のクリーンアップ（マージ済みの場合のみ）
git worktree remove .worktrees/issue-N
git branch -d issue/N/short-desc
```

- worktree は `.worktrees/` ディレクトリに作成
- ブランチ名は `issue/<番号>/<kebab-case説明>`
- main worktree から `git worktree add` する（worktree の中から作らない）

## やってはいけないパターン

| パターン | 問題 | 正しい対応 |
|---------|------|-----------|
| rebase → force push | deny で拒否される | merge コミットを作る（ユーザーに依頼） |
| worktree 内から worktree 作成 | パスがネストする | main worktree に戻って作成 |
| git restore . で状態リセット | 作業内容が全て消える | 個別ファイルのみ restore |
| ローカルで merge して push | 不要な merge コミットが入る | CI に任せる |
| マージしますか？と聞く | CI が行うので不要 | レビュー結果を報告するだけ |
