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
5. **変更範囲確認**: `git diff main...HEAD` で変更ファイルを確認し、Issue のスコープ外の変更が含まれていないか確認する
6. **コードレビュー**: `code-reviewer` エージェントを呼び出してレビューを受ける
7. **レビューループ**: CRITICAL / HIGH / MEDIUM / LOW **全件0件**になるまで修正→再レビューを繰り返す
8. **全件PASS確認**: 全件PASSになったら code-reviewer がマーカーを作成する。マーカーなしはpush不可
9. **コミット**: Conventional Commits形式（1コミット=1つの論理的変更。テストと実装は同一コミット可。大きな変更は分割）
   ```
   feat:     新機能 #<issue番号>
   fix:      バグ修正 #<issue番号>
   docs:     ドキュメントのみ #<issue番号>
   test:     テスト追加・修正 #<issue番号>
   refactor: リファクタリング #<issue番号>
   chore:    ビルド・ツール・設定 #<issue番号>
   perf:     パフォーマンス改善 #<issue番号>
   style:    フォーマットのみ #<issue番号>
   ci:       CI変更 #<issue番号>
   ```
10. **Conflictチェック・解消**: `conflict-resolver` スキルを呼び出してorigin/mainとのconflictを確認・解消する
    - conflictなし → そのまま続行
    - conflictあり → conflict-resolverが解消してマージコミットを作成 → テストPASS確認後に続行
11. **プッシュ**: `git push -u origin <ブランチ名>`
12. **PR作成**: `gh pr create` で以下を含める
    - Summary（変更内容）
    - Test plan（テスト項目）
    - `Closes #<issue番号>`
13. **ユーザーに報告**: PRのURLを提示してレビューを依頼

## マージ後

- CI が自動で Approve → マージ（Claude は何もしない）
- マージ完了後: `REPO_ROOT=$(cd "$(git rev-parse --git-common-dir)/.." && pwd) && git worktree remove "$(dirname "$REPO_ROOT")/issue-<N>"`
- mainブランチで `git pull`
