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

### Step 3: Codex CLI で画像を生成する

```bash
codex "次の画像を生成して <output-path> に保存してください。
<英語の詳細プロンプト>
組み込みのimage_genツールを直接使って生成してください。"
```

**重要**: `組み込みのimage_genツールを直接使って` を必ず末尾に含める。
省略すると Codex がコードを書こうとする。

### Step 4: 生成結果を確認する

Read ツールで生成された画像を表示し、ユーザーに確認する。

## 前提条件

- `codex` CLI インストール済み: `npm install -g @openai/codex`
- ChatGPT サブスクリプションで OAuth 認証済み（`codex` 初回起動時に認証）
