---
name: new-feature
description: 新機能開発開始 — Issue取得→Worktree作成→TDD実装の一連フロー
triggers:
  - 新機能
  - feature
  - "issue #"
  - 実装開始
---

# 新機能開発ワークフロー

TechClipの必須ワークフローに従い、新機能開発を開始する。

## 手順

1. **Issue確認**: `gh issue view <番号>` でissueの詳細を取得
2. **Worktree作成**: `scripts/create-worktree.sh <N> <短い説明>`
   - 内部で `git fetch origin main` を実行
   - `git worktree add` の直後に `direnv allow` を実行
   - 続けて `cd <worktree> && direnv exec <worktree> pnpm install --frozen-lockfile` まで実行
3. **TDD実装**:
   - RED: テストを先に書く（失敗確認）
   - GREEN: テストを通す最小限のコード
   - REFACTOR: テスト維持しつつ改善
4. **カバレッジ確認**: 80%以上を目標
5. **Biome lint**: `pnpm biome check` でエラー解消
6. **ローカルレビューループ**（コミット前に必須）:
   - `code-reviewer` エージェントを呼び出してレビューを受ける
   - 指摘が1件でもある場合は**すべて修正**し、`pnpm turbo check` で lint を再確認してから再レビューを依頼する
   - CRITICAL / HIGH / MEDIUM / LOW 全件0件になるまでループを繰り返す
   - 全件PASSになったらレビューマーカー（`.claude/.review-passed`）が作成されたことを確認する
7. **コミット**: Conventional Commits形式 + Issue番号
8. **プッシュ & PR作成**: `Closes #<N>` を含める

## ルール

- Issueなしの作業開始は禁止
- mainブランチで直接変更は禁止
- テストを書かずに実装コードを書くことは禁止
- Biomeでlint/format（ESLint/Prettier禁止）
- `drizzle-kit push` 禁止（`drizzle-kit migrate` のみ）
- Git操作は `cd <worktree>` または `git -C <worktree-path> ...` を使う
- `pnpm` / `node` / `biome` / `turbo` は原則 `cd <worktree> && direnv exec <worktree-path> ...` で実行する
- `git --git-dir=...`、`GIT_DIR`、`GIT_WORK_TREE` の使用は禁止

## テスト種別

| 種別 | 対象 | ツール |
|------|------|--------|
| Unit | 関数・クラス | Vitest |
| Integration | API・DB連携 | Vitest + Hono testclient |
| E2E | ユーザー操作 | Maestro |

## TDD対象外

- デザインモックアップ
- ドキュメント更新のみ
- 環境設定・インフラのみ
