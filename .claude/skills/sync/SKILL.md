---
name: sync
description: mainの最新を取り込む — fetch・pull・worktree同期
triggers:
  - sync
  - 同期
  - pull
  - 最新
---

# mainブランチ同期ワークフロー

リモートの最新mainを取得し、必要に応じてworktreeも同期する。

## 手順

1. **現在のブランチ確認**: `git branch --show-current`
2. **状態確認**: `git status` で未コミットの変更をチェック

### mainブランチの場合
3. `git pull --rebase origin main`

### featureブランチの場合
3. mainの最新を取得: `git fetch origin main`
4. リベース: `git rebase origin/main`
5. コンフリクトがあれば解決

### Worktreeの場合
3. メインリポジトリでmainを更新: `cd /Users/kirinnokubinagaiyo/tech_clip && git pull`
4. worktreeに戻ってリベース: `git rebase main`

## 注意
- 未コミットの変更がある場合は先にcommitまたはstash
- コンフリクトが発生したら手動解決が必要 → ユーザーに報告
- `--force` pushは禁止（askで確認が入る）
