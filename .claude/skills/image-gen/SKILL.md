---
name: image-gen
description: Codex CLI の image_gen ツール（gpt-image-2）で画像を生成し、用途に応じた正しいパスに保存する
triggers:
  - 画像生成
  - image generation
  - アイコン作成
  - app icon
  - スプラッシュ
  - splash
  - モックアップ
  - mockup
  - デザイン画像
---

# image-gen スキル

Codex CLI の組み込み `image_gen` ツールを使い、gpt-image-2 で画像を生成して
プロジェクト内の適切なパスに保存する。ChatGPT サブスクリプション内で完結（API キー不要）。

## 保存先マッピング

コンテキストから用途を判定し、以下のパスとサイズを自動適用する:

| 用途 | キーワード例 | 保存先 | サイズ |
|---|---|---|---|
| アプリアイコン | "app icon", "アプリアイコン", "icon.png" | `apps/mobile/assets/images/icon.png` | 1024×1024 |
| Adaptive icon | "adaptive icon", "Android icon" | `apps/mobile/assets/images/adaptive-icon.png` | 1024×1024 |
| スプラッシュ | "splash", "起動画面" | `apps/mobile/assets/images/splash-icon.png` | 1284×2778 |
| Favicon | "favicon", "ブラウザアイコン" | `apps/mobile/assets/images/favicon.png` | 48×48 |
| UIアイコン | "UIアイコン", "ボタン用", "ナビアイコン" | `apps/mobile/assets/icons/<name>.png` | 48×48 |
| 画面モックアップ | "モックアップ", "デザイン", "画面名" | `docs/design/<screen-name>.png` | 1284×2778 |

- 既存ファイルが同パスにある場合は上書き（バックアップなし）
- `docs/design/` の screen-name は kebab-case（例: `home-article-list`, `auth-login`）
- モックアップ生成時は `docs/mobile-theme.md` のカラー・フォント規約をプロンプトに含める

## 必須ワークフロー

### Step 1: 用途とパスを決定する

上記マッピングテーブルに従い、保存先パスとサイズを決定する。

### Step 2: プロンプトを構築する

日本語のリクエストを英語の詳細プロンプトに変換する:
- 具体的なスタイル（flat design, minimalist, material design 等）
- 色指定（このプロジェクトのプライマリカラー: teal #14b8a6）
- 用途に合ったサイズと形状

モックアップの場合は `docs/mobile-theme.md` を Read して色・フォント規約を確認してからプロンプトに反映する。

### Step 3: Codex CLI で画像を生成し、すぐに開く

```bash
codex "次の画像を生成して <output-path> に保存してください。
<英語の詳細プロンプト>
組み込みのimage_genツールを直接使って生成してください。"
```

**重要**: `組み込みのimage_genツールを直接使って` を必ず末尾に含める。
省略すると Codex がコードを書こうとする。

生成完了後、すぐに開く:

```bash
open <output-path>
```

---

## モックアップ生成時の追加ワークフロー

**以下の Step 4-6 は用途が「画面モックアップ」（`docs/design/` への出力）の場合のみ実行する。**
アイコン・スプラッシュ等の単体生成では Step 7 へスキップする。

### Step 4: HTML/CSS で表現できないアセットを識別する

モックアッププロンプトの内容を解析し、以下の基準で抽出対象をリストアップする（Codex 呼び出しなし、Claude が判断）。

**抽出する（画像ファイルが必要なもの）:**
- アイコン — ボタン・ナビゲーション・ラベルに付く小アイコン
- アプリロゴ・ブランドマーク — ロゴ・マスコット・ブランド画像
- イラスト — 空状態・オンボーディング用画像
- サムネイルプレースホルダー — 記事・ユーザー画像の枠
- 背景テクスチャ/パターン — CSS グラデーション以外の背景素材

**抽出しない（HTML/CSS で表現可能なもの）:**
- 色・グラデーション・シャドウ
- ボーダー・角丸
- テキスト・フォント
- レイアウト・余白

識別結果をリストとして整理し、各アセットの保存先パスとサイズを決定する:

**命名規則:**
- アイコン: `<名詞>.png`（例: `bookmark.png`, `share.png`, `arrow-right.png`）
- イラスト: `<用途-説明>.png`（例: `empty-state-article.png`, `onboarding-welcome.png`）
- プレースホルダー: `placeholder-<種別>.png`（例: `placeholder-article.png`, `placeholder-avatar.png`）

**保存先:**
- アイコン → `docs/design/assets/icons/<name>.png`（48×48）
- イラスト・プレースホルダー・ブランドマーク → `docs/design/assets/images/<name>.png`（表示サイズ基準）

### Step 5: 各アセットを個別生成する

まずディレクトリを作成する:

```bash
mkdir -p docs/design/assets/icons docs/design/assets/images
```

識別したアセットを順次 Codex で生成する。各アセットに対して以下のパターンを使う:

```bash
codex "次の画像を生成して docs/design/assets/icons/<name>.png に保存してください。
Flat design icon, teal #14b8a6, <説明>, transparent background,
matching the minimalist style of the mockup just generated.
<サイズ>px の正確なサイズで生成してください。
組み込みのimage_genツールを直接使って生成してください。"

# 生成完了後すぐに開く
open docs/design/assets/icons/<name>.png
```

**重要**: モックアップと同じスタイル・カラー（teal #14b8a6）をプロンプトに含め、一貫性を保つ。

### Step 6: 採用手順をユーザーに伝える

全アセット生成後、以下の形式で結果を報告する:

```
生成完了:
📱 モックアップ
  - docs/design/<screen-name>.png

🎨 抽出素材（docs/design/assets/）
  - docs/design/assets/icons/bookmark.png（48×48）
  - docs/design/assets/icons/share.png（48×48）
  - docs/design/assets/images/placeholder-article.png（375×200）

採用する素材があれば「<name>.png を使う」と指示してください。
  icons/  → apps/mobile/assets/icons/
  images/ → apps/mobile/assets/images/
に移動します。
```

---

### Step 7: 生成結果をすべて確認する

全生成ファイルをまとめて開き、Read ツールでインライン表示してユーザーに確認する。

```bash
# モックアップのみの場合
open <output-path>

# モックアップ + アセットがある場合（全ファイルを一括で開く）
open docs/design/<screen-name>.png docs/design/assets/icons/*.png docs/design/assets/images/*.png
```

その後 Read ツールで各画像をインライン表示する。

## 前提条件

- `codex` CLI: `flake.nix` の `devShells.default` に組み込み済み（`direnv reload` で自動取得）
- ChatGPT サブスクリプションで OAuth 認証済み（`codex` 初回起動時に認証）
