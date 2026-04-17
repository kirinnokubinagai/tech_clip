# エージェントハーネス

このリポジトリの開発ルールは [`CLAUDE.md`](./CLAUDE.md) を正とする。
必ず [`CLAUDE.md`](./CLAUDE.md) を読み、`.claude/` 配下のルールに従うこと。

## 主要な変更点（Issue #1052）

- orchestrator 主導 polling（`scripts/polling-watcher.sh` + CronCreate）
- 3 条件 AND 判定（`scripts/lib/evaluate-verdict.sh`）
- フロー逸脱物理ブロック（`.claude/hooks/orchestrator-flow-guard.sh`）
- APPROVED 受信後の次 Issue 自動 spawn（`scripts/next-issue-auto-spawn.sh`）
- 設定外出し（`.claude/config.json`）

詳細は `CLAUDE.md` の「polling-watcher と CronCreate 登録規約」セクションを参照。
