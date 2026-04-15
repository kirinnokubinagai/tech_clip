# メンテナンスガイド

## 定期クリーンアップ

### Worktree

SessionStart 時に `check-worktrees.sh` がマージ済み・クローズ済み worktree を自動削除する。
警告表示された worktree（stale/orphan/PR未作成）は以下のコマンドで手動整理できる。

```bash
bash scripts/cleanup-worktrees.sh --dry-run  # 削除候補確認（副作用なし）
bash scripts/cleanup-worktrees.sh            # 対話削除
bash scripts/cleanup-worktrees.sh --yes      # 一括削除
bash scripts/cleanup-worktrees.sh --no-size  # サイズ計算なし（高速化）
```

個別に削除する場合:

```bash
git worktree remove ../issue-<N>
```

### pnpm store

pnpm は global store 経由で hardlink を使用するため、worktree ごとの node_modules は思ったより軽量。
ただし store 自体が肥大化した場合は以下で削減できる:

```bash
pnpm store prune
```

### ビルドキャッシュ

真の肥大化要因はビルド成果物（`.expo`, `.wrangler`, Metro キャッシュ）。
worktree ごとに以下で削除できる:

```bash
cd <worktree>
rm -rf apps/mobile/.expo apps/api/.wrangler node_modules/.cache
```

### /tmp spec ファイル

SessionStart 時に `cleanup-tmp-files.sh` が 24 時間以上前の `/tmp/issue-*-*.md` を自動削除する。
手動で削除したい場合:

```bash
find /tmp -maxdepth 1 -name 'issue-*-*.md' -mmin +1440 -delete
```

## worktree 管理フロー

| 状態 | 処理 |
|---|---|
| マージ済み・未コミット変更なし | SessionStart で自動削除 |
| PR クローズ済み・未コミット変更なし | SessionStart で自動削除 |
| PR クローズ済み・未コミット変更あり | 警告表示 → 手動確認後に削除 |
| PR 未作成・クリーン | 警告表示 → `cleanup-worktrees.sh` で削除 |
| 14 日以上コミットなし | 警告表示 → `cleanup-worktrees.sh` で削除 |
