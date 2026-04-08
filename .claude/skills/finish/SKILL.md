---
name: finish
description: 作業完了 — コミット・プッシュ・PR作成・Worktreeクリーンアップ
triggers:
  - 完了
  - finish
  - PR作成
  - マージ
---

# 作業完了ワークフロー

現在のworktreeでの作業を完了し、PRを作成する。

## 手順

1. **テスト実行**: `pnpm turbo test` でテスト全pass確認
2. **カバレッジ確認**: 80%以上であること
3. **lint確認**: `pnpm turbo check` でBiomeチェック
4. **未コミット確認**: `git status` で全変更がステージングされているか
5. **コードレビュー**: `/review/code-review` スキルで品質・セキュリティ・パフォーマンスを評価
6. **PRレビュー**: `/review/pr-review` スキルで変更範囲・テスト・マージ可否を評価
7. **レビュー通過確認**: 重大な問題（🔴）が0件であること。問題があれば修正してから次へ
8. **コミット**: Conventional Commits形式
   ```
   feat: 機能説明 #<issue番号>
   fix: バグ修正内容 #<issue番号>
   docs: ドキュメント変更 #<issue番号>
   test: テスト追加 #<issue番号>
   chore: 設定変更 #<issue番号>
   ```
9. **プッシュ**: `git push -u origin <ブランチ名>`
10. **PR作成**: `gh pr create` で以下を含める
   - Summary（変更内容）
   - Test plan（テスト項目）
   - `Closes #<issue番号>`
11. **ユーザーに報告**: PRのURLを提示してレビューを依頼

## マージ後

- CI が自動で Approve → マージ（Claude は何もしない）
- マージ完了後: `REPO_ROOT=$(cd "$(git rev-parse --git-common-dir)/.." && pwd) && git worktree remove "$(dirname "$REPO_ROOT")/issue-<N>"`
- mainブランチで `git pull`
