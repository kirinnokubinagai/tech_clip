---
name: gemini-image-gen
description: Gemini APIで画像生成
triggers:
  - 画像生成
  - Gemini
  - image generation
  - アイコン作成
---

# Gemini Image Generation Skill

Gemini API で画像を生成・編集するスキル。curl + jq のみ使用（Python不要）。

## 必須ワークフロー

### Step 1: モデル一覧を確認する

```bash
source ~/.zshrc 2>/dev/null && \
bash ~/.claude/skills/gemini-image-gen/examples/generate_image.sh --list-models
```

最新のimageモデルを選択する。ユーザーが指定しない限り、一覧から最新のものを使う。

### Step 2: 画像を生成する

```bash
source ~/.zshrc 2>/dev/null && \
bash ~/.claude/skills/gemini-image-gen/examples/generate_image.sh \
  "<英語の詳細プロンプト>" \
  --model <Step1で選んだモデル> \
  --output-dir <プロジェクトディレクトリ>/output
```

### Step 3: 結果を表示する

Read ツールで生成された画像を表示し、ファイルパスをユーザーに伝える。

## 画像編集

```bash
source ~/.zshrc 2>/dev/null && \
bash ~/.claude/skills/gemini-image-gen/examples/edit_image.sh \
  <入力画像パス> "<編集指示（英語）>" \
  --model <モデル名> \
  --output <出力パス>
```

## プロンプト最適化

ユーザーの日本語リクエストを英語の詳細プロンプトに変換する:
- 具体的なスタイル（photorealistic, watercolor, minimalist 等）
- 色指定（warm tones, pastel colors 等）
- 構図（centered, rule of thirds 等）
- ライティング（golden hour, studio lighting 等）

## 前提条件

- `GEMINI_API_KEY` が `~/.zshrc` に設定済み
- `jq` がインストール済み（`brew install jq`）
- `curl` が利用可能（macOS標準）

## 注意事項

- すべての生成画像に SynthID 透かしが自動挿入される
- 生成された画像は `output/gemini_YYYYMMDD_HHMMSS.png` に保存される
