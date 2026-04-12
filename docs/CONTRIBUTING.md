# コントリビューションガイド

このドキュメントは TechClip プロジェクトへの貢献方法と、ドキュメント保守ルールを定義する。

---

## README / ROADMAP 実装同期ルール

### 基本方針

**実装状態とドキュメントは常に一致している必要がある。**
PR をマージする前に、変更内容に応じて以下の対応ドキュメントを同時に更新すること。

---

### 各ドキュメントの source-of-truth

| ドキュメント | source-of-truth | 更新タイミング |
|-------------|----------------|---------------|
| `README.md` の機能一覧 | 実装コード | 機能追加・削除時 |
| `README.md` の対応ソース表 | `apps/mobile/src/lib/sources.ts` | ソース追加・削除時 |
| `docs/ROADMAP.md` の状態 | GitHub Issue | Issue クローズ時 |
| `README.md` の Tech Stack | `package.json` / `flake.nix` | ライブラリバージョン変更時 |

---

### 新機能追加時のチェックリスト

PR に以下を含めること。対象外の項目はチェックして「N/A」と記載する。

- [ ] 実装コードが完成している（テスト含む）
- [ ] `README.md` の「主な機能」に追記または変更した（対象外: N/A）
- [ ] `README.md` の「対応ソース」表を更新した（対象外: N/A）
- [ ] `docs/ROADMAP.md` の該当 Issue の状態を `🔲` → `✅` に変更した
- [ ] 新しい環境変数を追加した場合、`README.md` の「環境変数」表と `.dev.vars.example` / `.env.example` を更新した

---

### 実装済み / 計画中 / 未対応の表記基準

README および ROADMAP では以下の表記を統一する。

| 表記 | 意味 | 使用場所 |
|------|------|---------|
| `対応済み` | 実装が完了し、PR がマージされている | README 対応ソース表 |
| `一部対応` | 実装が存在するが、機能が制限されている | README 対応ソース表 |
| `予定 (#N)` | 対応する GitHub Issue が存在し、未マージ | README 対応ソース表 |
| `✅` | Issue がクローズ（マージ済み）| ROADMAP 状態列 |
| `🔲` | Issue がオープン（未着手 or 作業中）| ROADMAP 状態列 |

**禁止パターン:**

- 実装が完了していないのに `対応済み` と書く
- Issue が存在しないのに `予定` と書く（先に Issue を作成すること）
- ROADMAP の状態を手動で推測で更新する（必ず Issue の実際の状態に従うこと）

---

### 対応ソース表の更新手順

`apps/mobile/src/lib/sources.ts` が対応ソースの **source-of-truth** である。
README の対応ソース表はこのファイルと常に一致させること。

```bash
# ソースを追加・変更した後、以下の点を確認する
# 1. apps/mobile/src/lib/sources.ts の定義が更新されている
# 2. README.md の「対応ソース」表が一致している
# 3. アプリ内オンボーディング画面の文言が一致している（apps/mobile/app/onboarding/）
```

---

### ROADMAP の更新手順

`docs/ROADMAP.md` は GitHub Issue の状態を反映したロードマップである。

```bash
# Issue をクローズするとき（PR マージ後）
# 1. docs/ROADMAP.md を開く
# 2. 該当 Issue の行を探す
# 3. 状態列を 🔲 → ✅ に変更する
# 4. 変更を同じ PR またはクローズコミットに含める
```

**ROADMAP に新しい Issue を追加するとき:**

- 既存の Phase に収まる場合は、適切な Phase のテーブルに追加する
- 新しい Phase が必要な場合は、Phase 番号を採番してテーブルごと追加する
- Issue 番号は必ず実際の GitHub Issue 番号を使う（架空の番号は禁止）

---

### Tech Stack 表の更新手順

`README.md` の「Tech Stack」表はパッケージのバージョンを記載している。
メジャーバージョンが変わった場合は更新すること。

```bash
# バージョン確認コマンド例
cat package.json | jq '.dependencies'
cat apps/api/package.json | jq '.dependencies'
cat apps/mobile/package.json | jq '.dependencies'
```

---

### 差分を発見したとき

実装とドキュメントの乖離を発見した場合は、以下のいずれかで対処する。

1. **自分で修正できる場合**: 修正 PR を作成する
2. **自分で修正できない場合**: GitHub Issue を作成し、`docs` ラベルを付ける

乖離を発見して何もしないことは禁止。必ず記録に残すこと。

---

## ブランチ戦略

| ブランチ | 用途 |
|---------|------|
| `main` | 本番相当の最新コード |
| `issue/<N>/<description>` | Issue ごとの作業ブランチ |

作業は必ず `scripts/create-worktree.sh` を使って worktree を作成してから始める。
`main` への直接コミットは禁止。

---

## コミットメッセージ規約

[Conventional Commits](https://www.conventionalcommits.org/) に従う。

```
<type>(<scope>): <description>

feat(mobile/home): 記事一覧にソースフィルターを追加する
fix(api/parser): YouTube URL のパース失敗を修正する #541
docs(repo): README の対応ソース表を更新する #826
refactor(mobile/i18n): onboarding のハードコード文言を翻訳キーへ移行する
test(api): パーサーの異常系テストを追加する
chore(deps): pnpm を 10.x に更新する
```

| type | 用途 |
|------|------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメントのみの変更 |
| `refactor` | リファクタリング（機能変更なし） |
| `test` | テストの追加・修正 |
| `chore` | ビルド・依存・設定の変更 |
| `perf` | パフォーマンス改善 |

---

## PR 作成のルール

- タイトルはコミットメッセージと同じ形式にする
- Issue 番号を本文に記載する（`Closes #N` で自動クローズ）
- セルフレビューチェックリストを本文に含める
- レビュー前に `pnpm lint` と `pnpm test` が通ることを確認する

---

## 関連ドキュメント

| ドキュメント | 内容 |
|------------|------|
| `docs/ROADMAP.md` | 開発ロードマップ・Phase 管理 |
| `docs/VERSIONING.md` | バージョニングポリシー |
| `docs/RELEASE_CHECKLIST.md` | リリース前チェックリスト |
| `CLAUDE.md` | エージェント向け開発ルール |
