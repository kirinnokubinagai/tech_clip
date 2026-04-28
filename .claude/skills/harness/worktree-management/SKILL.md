---
name: harness-worktree-management
description: worktree の自動 sync、自動削除、手動 cleanup の運用。SessionStart hook が origin/main の取り込みとマージ済 worktree の削除を自動実行する。reviewer が APPROVED 後に worktree を削除する手順は agent-cleanup を参照。
triggers:
  - "harness/worktree-management"
  - "worktree"
  - "ワークツリー"
  - "cleanup-worktrees"
---

# Worktree の自動管理

## 自動 sync（SessionStart hook）

`auto-sync-main.sh`（SessionStart hook）が SessionStart 時に以下を自動実行する:

- **main worktree**: `origin/main` を fetch して FF merge（uncommitted 変更がある場合はスキップ）
- **issue/* branch の worktree**: `origin/main` が進んでいれば 3-way merge を試みる。conflict 発生時は `merge --abort` して元の状態に戻す（安全側）
- **uncommitted 変更がある worktree**: merge をスキップ（誤操作防止）

この仕組みにより、並列 Issue 開発中に `origin/main` が進んでも各 worktree の engineer に手動指示を送る必要がない。

## 自動削除（SessionStart hook）

`check-worktrees.sh`（SessionStart hook）が以下を自動処理する:

| 状態 | 処理 |
|---|---|
| マージ済み worktree | 自動削除 |
| PR がクローズ済み（マージなし）で未コミット変更なし | 自動削除 |
| PR がクローズ済みで未コミット変更あり | 警告表示（手動削除が必要） |
| PR が存在しないブランチで未コミット変更なし | 警告表示 |
| 14 日以上コミットなし | 警告表示 |
| `/tmp/issue-*` ファイルが 24 時間以上前 | 自動削除 |

## 手動クリーンアップ

古い worktree をインタラクティブに削除したい場合:

```bash
bash scripts/cleanup-worktrees.sh
```

クローズされた（マージなし）Issue の worktree を個別に削除する場合:

```bash
git worktree remove ../issue-<N>
```

## バックグラウンドサブエージェントの制約

`worktree-isolation-guard.sh` により以下の制限がある（main ブランチの orchestrator から兄弟 worktree への Edit/Write/Read/Grep/Glob がブロックされる。worktree 内で動作するバックグラウンドサブエージェントは影響を受けない）:

| ツール | 制約 |
|---|---|
| Edit / Write | mainブランチから兄弟 worktree へのアクセスはブロックされる |
| Read / Grep / Glob | mainブランチから兄弟 worktree へのアクセスはブロックされる |
| Bash（`cat`, `touch` 等） | worktree-isolation-guard の対象外（ただし他 hook による制約は受ける） |

**main ブランチ上での Edit/Write は全ファイルに対して禁止**（`.claude-user/` と `.omc/` を除く gitignore 済みファイルのみ許可）。`.claude/**` や `scripts/` であっても必ず worktree 経由で変更すること。

なお `.omc/state/**` は worktree 上でも Edit/Write がブロックされる（is_blocked_file による）。

## マーカーファイルの保護

`.claude/.review-passed` および `.claude/.e2e-passed` の内容は **HEAD SHA を 1 行だけ書く**（40 文字 + 末尾改行）。これ以外の形式は不正としてブロックされる。マーカーは必ず `scripts/gate/create-review-marker.sh` / `scripts/gate/create-e2e-marker.sh`（または `run-maestro-and-create-marker.sh`）経由で作成すること。

**手動の `echo "<SHA>" > .claude/.review-passed` や Write ツールでの直接作成は禁止**（誤った SHA や空ファイルを生成する事故が起きるため）。

`.claude/.review-passed` の作成権限は **reviewer 系サブエージェントのみ**。`.claude/.e2e-passed` の作成権限は **`e2e-reviewer` のみ**。coder 系サブエージェントおよび orchestrator はこれらを作成してはならない。

## 関連 skill

- マーカー: `harness/gate-markers`
- APPROVED 後の worktree 削除: `harness/agent-cleanup`
- worktree 作成: `bash scripts/create-worktree.sh <N> <desc>`
