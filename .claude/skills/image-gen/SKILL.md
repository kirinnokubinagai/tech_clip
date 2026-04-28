---
name: image-gen
description: Codex CLI の image_gen ツール（gpt-image-2）で画像を生成し、用途に応じた正しいパスに保存する。複数画像生成は 1 回の codex セッションでまとめて実行し、デザイン統一性を担保する。
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

Codex CLI の組み込み `image_gen` ツール（gpt-image-2）で画像を生成して
プロジェクト内の適切なパスに保存する。ChatGPT サブスクリプション内で完結（API キー不要）。

## 重要原則: 1 セッション 1 codex 呼び出し

**複数画像を生成するときは必ず 1 回の codex 呼び出しでまとめて生成する**（モックアップ + 抽出アセット等）。

理由:
- 別 codex セッションだと毎回コンテキストが切れ、画風・色・線の太さ・角丸の半径などが揺れる
- 1 セッション内なら直前の生成をプロンプトで参照させ、統一性を維持できる
- API/CLI 呼び出しコストも削減

複数 codex 呼び出しに分けて良いのは「モックアップを 1 枚見てから判断する」ようなインタラクティブなフローでユーザーが明示的に追加生成を依頼した場合のみ。

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

### Step 1: 生成対象を全部洗い出す（事前計画）

ユーザーリクエストを解析し、**1 回の codex 呼び出しで生成する全画像を先にリストアップ** する。
モックアップ単体ならそれだけ、画面 + アイコン群ならそれら全部を 1 リストにする。

#### モックアップの場合の追加識別

モックアップを含む依頼の場合、HTML/CSS で表現できないアセットも同時に識別する:

**抽出する（画像ファイルが必要なもの）**:
- アイコン — ボタン・ナビゲーション・ラベルに付く小アイコン
- アプリロゴ・ブランドマーク — ロゴ・マスコット・ブランド画像
- イラスト — 空状態・オンボーディング用画像
- サムネイルプレースホルダー — 記事・ユーザー画像の枠
- 背景テクスチャ/パターン — CSS グラデーション以外の背景素材

**抽出しない（HTML/CSS で表現可能）**:
- 色・グラデーション・シャドウ
- ボーダー・角丸
- テキスト・フォント
- レイアウト・余白

#### 命名規則

- アイコン（UI / モックアップ抽出）: `<名詞>.png`（例: `bookmark.png`, `share.png`, `arrow-right.png`）
- イラスト: `<用途-説明>.png`（例: `empty-state-article.png`, `onboarding-welcome.png`）
- プレースホルダー: `placeholder-<種別>.png`（例: `placeholder-article.png`, `placeholder-avatar.png`）

#### 保存先（モックアップ抽出物の場合）

- アイコン → `docs/design/assets/icons/<name>.png`（48×48）
- イラスト・プレースホルダー・ブランドマーク → `docs/design/assets/images/<name>.png`（表示サイズ基準）

### Step 2: ディレクトリ作成 + テーマ確認

```bash
mkdir -p docs/design/assets/icons docs/design/assets/images
```

モックアップを含む場合は `docs/mobile-theme.md` を Read してカラー・フォント規約を確認し、次の Step 3 のプロンプトに反映する。

### Step 3: 統一プロンプトを構築する（1 セッションで全生成）

英語の詳細プロンプトを **1 つにまとめて** 構築する。具体的なフォーマット:

```
You will generate <N> images in this single session. Use the same design system
across all images for visual consistency.

## Design system (apply to ALL images below)
- Style: <e.g. flat design, minimalist, material design>
- Primary color: teal #14b8a6
- Secondary / accent: <if any>
- Stroke width / corner radius / shadow rules: <if any>
- Typography (mockup only): <font family, weights>

## Images to generate

1. <output-path-1> (<width>×<height>)
   <detailed description of image 1>

2. <output-path-2> (<width>×<height>)
   <detailed description of image 2>
   IMPORTANT: keep the same icon style and stroke width as image 1.

3. <output-path-3> (<width>×<height>)
   ...

## Constraints
- Generate each image with the EXACT pixel size specified.
- Use transparent background for all icons unless otherwise specified.
- Save each generated image to its specified path.
```

**統一感を担保するためのコツ**:
- 全画像で共通のスタイル指定（"matching the same flat icon style", "consistent stroke width" 等）を冒頭に書く
- アイコン群は「ボタン上に並べたとき揃って見える」ことを明記する
- モックアップ + アセット混在のときはモックアップを先に列挙し、後続アセットに「matching the mockup just rendered above」と付ける

### Step 4: Codex CLI を 1 回だけ呼ぶ

```bash
codex "<Step 3 で構築した統一プロンプト>

組み込みのimage_genツールを直接使って、上記の <N> 枚すべてをこのセッション内で生成・保存してください。
別々のコード実行ではなく、image_gen ツールを直接呼び出してください。"
```

**必須事項**:
- プロンプトの末尾に「組み込みのimage_genツールを直接使って…別々のコード実行ではなく」を必ず含める。省略すると Codex がコードを書こうとする
- 「すべてをこのセッション内で」を明記し、複数セッションに分けないよう指示する

### Step 5: 全画像をまとめて確認

```bash
# 全ファイルをまとめて open
open <output-path-1> <output-path-2> ...
# またはモックアップ + アセットがある場合
open docs/design/<screen-name>.png docs/design/assets/icons/*.png docs/design/assets/images/*.png
```

その後 Read ツールで各画像をインライン表示してユーザーに確認する。

### Step 6: 採用手順をユーザーに伝える（モックアップ抽出物がある場合）

```
生成完了 (1 セッションで <N> 枚を統一スタイル生成):
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

## やり直しが必要なときも 1 セッションで

ユーザーが「アイコン群だけスタイル変えて」等の修正依頼をした場合も、**変更対象をまとめて 1 回の codex 呼び出し** で再生成する。修正対象 + 影響を受ける関連画像を全部 Step 3 のプロンプトに入れる。

## 前提条件

- `codex` CLI: `flake.nix` の `devShells.default` に組み込み済み（`direnv reload` で自動取得）
- ChatGPT サブスクリプションで OAuth 認証済み（`codex` 初回起動時に認証）
