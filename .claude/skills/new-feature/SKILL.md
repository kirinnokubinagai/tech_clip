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
2. **Worktree作成**: `REPO_ROOT=$(cd "$(git rev-parse --git-common-dir)/.." && pwd) && git worktree add "$(dirname "$REPO_ROOT")/issue-<N>" -b issue/<N>/<短い説明>`
3. **TDD実装**:
   - RED: テストを先に書く（失敗確認）
   - GREEN: テストを通す最小限のコード
   - REFACTOR: テスト維持しつつ改善
4. **カバレッジ確認**: 80%以上を目標
5. **コミット**: Conventional Commits形式 + Issue番号
6. **プッシュ & PR作成**: `Closes #<N>` を含める

## ルール

- Issueなしの作業開始は禁止
- mainブランチで直接変更は禁止
- テストを書かずに実装コードを書くことは禁止
- Biomeでlint/format（ESLint/Prettier禁止）
- `drizzle-kit push` 禁止（`drizzle-kit migrate` のみ）

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
