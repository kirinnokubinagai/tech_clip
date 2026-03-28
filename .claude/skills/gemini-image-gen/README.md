# 🎨 Gemini Image Generation Skill

Google Gemini APIを使用して、AIで画像を生成・編集するClaude Codeスキル。

## ✨ 機能

- **テキストから画像生成**: プロンプトから高品質な画像を作成
- **画像編集**: 既存の画像をAIで修正・変更
- **複数画像の合成**: 最大14枚の画像を組み合わせ
- **多様なアスペクト比**: 1:1から21:9まで10種類以上
- **高解像度対応**: 最大4K解像度（Proモデル）
- **SynthID透かし**: 自動的に透かしを埋め込み

## 📦 セットアップ

### 1. 依存関係のインストール

```bash
pip install google-generativeai pillow
```

### 2. APIキーの有効化

環境変数はすでに設定済みです。新しいターミナルで有効にするには：

```bash
source ~/.zshrc
```

確認：

```bash
echo $GEMINI_API_KEY
# 出力: AIzaSy...
```

## 🚀 クイックスタート

### Claude Codeで使用

Claude Codeに以下のように指示するだけで、このスキルが自動起動します：

```
「富士山の夕焼けの画像を生成して」
```

```
「このロゴを青色に変更して」
```

### コマンドラインで使用

#### 画像生成

```bash
# 基本的な使い方
cd ~/.claude/skills/gemini-image-gen/examples
python generate_image.py "A beautiful sunset over mountains"

# アスペクト比を指定
python generate_image.py "A cat portrait" --aspect-ratio 1:1

# 高品質モード（Proモデル + 4K）
python generate_image.py "A professional logo design" --model pro --resolution 4K

# カスタム出力先
python generate_image.py "A futuristic city" --output-dir ~/Pictures/ai_art
```

#### 画像編集

```bash
# 画像を編集
python edit_image.py input.png "Change the sky to sunset colors"

# 出力ファイル名を指定
python edit_image.py photo.jpg "Add a rainbow" --output rainbow.png
```

## 📖 ドキュメント

| ファイル | 内容 |
|---------|------|
| [SKILL.md](./SKILL.md) | スキルの詳細ガイド、使用方法、例 |
| [API_REFERENCE.md](./API_REFERENCE.md) | 技術仕様、パラメータ、エラーハンドリング |
| [examples/](./examples/) | 実行可能なサンプルコード |

## 🎯 使用例

### 1. SNS用画像

```bash
python generate_image.py \
  "A vibrant illustration of a coffee cup with latte art" \
  --aspect-ratio 1:1 \
  --output-dir ~/instagram
```

### 2. YouTube サムネイル

```bash
python generate_image.py \
  "Bold text 'AMAZING TUTORIAL' with dynamic background" \
  --aspect-ratio 16:9 \
  --model pro
```

### 3. スマホ壁紙

```bash
python generate_image.py \
  "Minimalist mountain landscape at dawn" \
  --aspect-ratio 9:16
```

### 4. 画像の背景変更

```bash
python edit_image.py \
  product.png \
  "Change background to a clean white studio setting"
```

## 🎨 プロンプトのコツ

### ❌ 悪い例
```
"犬"
```

### ✅ 良い例
```
"A golden retriever puppy playing in a field of sunflowers,
natural lighting, shallow depth of field, professional photography,
vibrant colors, joyful atmosphere"
```

**ポイント:**
- 具体的な描写（色、質感、照明）
- スタイルの指定（写実的、イラスト、ミニマル等）
- 雰囲気・感情の表現
- 英語で記述すると精度が向上

## 📊 モデル比較

| 特徴 | Flash | Pro |
|------|-------|-----|
| 速度 | ⚡ 高速（3-5秒） | 🐢 中速（10-20秒） |
| 品質 | 📷 標準 | 💎 最高 |
| 解像度 | 📏 1K | 📐 最大4K |
| コスト | 💵 $0.039/枚 | 💰 より高額 |
| 用途 | プロトタイプ、SNS | 商用、プロ用途 |

## 📐 アスペクト比ガイド

```
1:1   →  Instagram投稿、プロフィール画像
9:16  →  スマホ壁紙、Instagramストーリー
16:9  →  YouTube、プレゼン、デスクトップ壁紙
4:5   →  Instagram縦投稿
21:9  →  ウルトラワイドモニター
```

## ⚠️ 注意事項

- すべての画像にSynthID透かしが埋め込まれます
- セーフティフィルタが自動適用されます
- APIには使用制限があります（詳細は[API_REFERENCE.md](./API_REFERENCE.md)参照）
- 生成画像の著作権についてはGoogleの利用規約を確認してください

## 🔗 リンク

- [Gemini API 公式ドキュメント](https://ai.google.dev/gemini-api/docs/image-generation)
- [Google AI Studio](https://aistudio.google.com/)
- [価格情報](https://ai.google.dev/pricing)

## 📝 ライセンス

このスキルはMITライセンスの下で公開されています。
Gemini APIの使用はGoogleの利用規約に従います。

---

**作成日**: 2025-12-24
**バージョン**: 1.0.0
**対応モデル**: gemini-2.5-flash-image, gemini-3-pro-image-preview
