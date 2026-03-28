# Gemini Image Generation API リファレンス

## 📚 目次

1. [モデル一覧](#モデル一覧)
2. [API設定](#api設定)
3. [生成モード](#生成モード)
4. [パラメータ詳細](#パラメータ詳細)
5. [レスポンス構造](#レスポンス構造)
6. [エラーハンドリング](#エラーハンドリング)
7. [ベストプラクティス](#ベストプラクティス)

---

## モデル一覧

### gemini-2.5-flash-image (Nano Banana)

**特徴:**
- 高速生成（平均3-5秒）
- 低コスト（$0.039/画像）
- 標準品質
- 1K解像度

**推奨用途:**
- プロトタイピング
- SNS投稿用画像
- アイコン・バナー
- 大量生成が必要な場合

**制限事項:**
- 解像度は1Kのみ
- 細かいディテールは制限あり

```python
model = genai.GenerativeModel("gemini-2.5-flash-image")
```

### gemini-3-pro-image-preview (Nano Banana Pro)

**特徴:**
- 高品質生成
- 4K解像度対応
- "Thinking"モード（推論過程を段階的に生成）
- 高精度テキストレンダリング

**推奨用途:**
- 商用利用
- プロフェッショナルデザイン
- 高解像度が必要な場合
- ロゴ・ポスター制作

**制限事項:**
- 生成時間が長い（10-20秒）
- コストが高い

```python
model = genai.GenerativeModel("gemini-3-pro-image-preview")
```

---

## API設定

### 基本セットアップ

```python
import google.generativeai as genai
import os

# APIキー設定
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# モデル初期化
model = genai.GenerativeModel("gemini-2.5-flash-image")
```

### 生成設定オブジェクト

```python
from google.generativeai import types

config = types.GenerateContentConfig(
    # 出力モダリティ（画像のみ、またはテキスト+画像）
    response_modalities=["IMAGE"],  # ["TEXT", "IMAGE"] も可

    # アスペクト比
    aspect_ratio="16:9",

    # 解像度（Gemini 3 Proのみ）
    # resolution="4K",

    # 思考プロセスの可視化（Gemini 3 Proのみ）
    # thinking_mode="enabled",
)
```

---

## 生成モード

### 1. テキストから画像生成

```python
prompt = "A futuristic cityscape at night with neon lights"

response = model.generate_content(
    prompt,
    generation_config={"response_modalities": ["IMAGE"]}
)
```

### 2. テキスト + 画像編集

```python
from PIL import Image

# 既存画像を読み込み
original_image = Image.open("input.png")

# 編集指示
prompt = "Add a rainbow in the sky"

response = model.generate_content(
    [original_image, prompt],
    generation_config={"response_modalities": ["IMAGE"]}
)
```

### 3. 複数画像の組み合わせ

```python
style_ref = Image.open("style.png")
subject = Image.open("subject.png")

prompt = "Apply the artistic style from the first image to the subject in the second image"

response = model.generate_content(
    [style_ref, subject, prompt]
)
```

**制限:**
- 最大14画像
- 人物: 最大6枚
- オブジェクト: 最大8枚

### 4. マルチターン会話

```python
chat = model.start_chat()

# 最初の生成
response1 = chat.send_message("Generate a logo for a tech startup")

# 反復改善
response2 = chat.send_message("Make the colors more vibrant")
response3 = chat.send_message("Add the company name 'TechFlow'")
```

---

## パラメータ詳細

### アスペクト比一覧

| 比率 | 用途 | 解像度例（1K基準） |
|------|------|--------------------|
| `"1:1"` | Instagram投稿、プロフィール画像 | 1024×1024 |
| `"2:3"` | ポートレート写真 | 683×1024 |
| `"3:2"` | 風景写真 | 1024×683 |
| `"3:4"` | クラシックポートレート | 768×1024 |
| `"4:3"` | 古典的横長 | 1024×768 |
| `"4:5"` | Instagram縦投稿 | 819×1024 |
| `"5:4"` | 横長投稿 | 1024×819 |
| `"9:16"` | スマホ壁紙、Instagramストーリー | 576×1024 |
| `"16:9"` | YouTube、プレゼン | 1024×576 |
| `"21:9"` | ウルトラワイドモニター | 1024×439 |

### 解像度オプション（Gemini 3 Proのみ）

```python
# 1K（デフォルト）
config = {"resolution": "1K"}  # ~1024px

# 2K
config = {"resolution": "2K"}  # ~2048px

# 4K
config = {"resolution": "4K"}  # ~4096px
```

**注意:** 解像度は `"1K"`, `"2K"`, `"4K"` のように大文字のKを使用。

### セーフティ設定

```python
safety_settings = {
    "HARM_CATEGORY_HARASSMENT": "BLOCK_MEDIUM_AND_ABOVE",
    "HARM_CATEGORY_HATE_SPEECH": "BLOCK_MEDIUM_AND_ABOVE",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT": "BLOCK_MEDIUM_AND_ABOVE",
    "HARM_CATEGORY_DANGEROUS_CONTENT": "BLOCK_MEDIUM_AND_ABOVE",
}

response = model.generate_content(
    prompt,
    safety_settings=safety_settings
)
```

**レベル:**
- `BLOCK_NONE`: ブロックしない
- `BLOCK_LOW_AND_ABOVE`: 低レベル以上をブロック
- `BLOCK_MEDIUM_AND_ABOVE`: 中レベル以上をブロック（デフォルト）
- `BLOCK_ONLY_HIGH`: 高レベルのみブロック

---

## レスポンス構造

### 基本構造

```python
response = model.generate_content(prompt)

# テキスト部分
if response.text:
    print(f"説明: {response.text}")

# 画像部分
for part in response.parts:
    if hasattr(part, 'inline_data'):
        mime_type = part.inline_data.mime_type  # "image/png" or "image/jpeg"
        image_data = part.inline_data.data      # Base64エンコード済み
```

### 画像の保存

```python
import base64
from PIL import Image
from io import BytesIO

for i, part in enumerate(response.parts):
    if hasattr(part, 'inline_data'):
        # Base64デコード
        decoded = base64.b64decode(part.inline_data.data)

        # PIL Imageに変換
        image = Image.open(BytesIO(decoded))

        # 保存
        image.save(f"output_{i}.png")

        # または直接ファイルに書き込み
        with open(f"output_{i}.png", "wb") as f:
            f.write(decoded)
```

### メタデータの取得

```python
# プロンプトフィードバック
print(response.prompt_feedback)

# 使用統計
print(response.usage_metadata)
# 出力例: total_tokens=1290, prompt_tokens=50, candidates_tokens=1240
```

---

## エラーハンドリング

### 一般的なエラー

#### 1. APIキーエラー

```python
try:
    response = model.generate_content(prompt)
except Exception as e:
    if "API key" in str(e):
        print("APIキーが無効です。GEMINI_API_KEYを確認してください。")
```

#### 2. セーフティフィルタ

```python
try:
    response = model.generate_content(prompt)
    if not response.parts:
        print("セーフティフィルタによりブロックされました。")
        print(response.prompt_feedback)
except Exception as e:
    print(f"エラー: {e}")
```

#### 3. レート制限

```python
import time

def generate_with_retry(model, prompt, max_retries=3):
    for attempt in range(max_retries):
        try:
            return model.generate_content(prompt)
        except Exception as e:
            if "quota" in str(e).lower() or "rate" in str(e).lower():
                wait_time = 2 ** attempt  # 指数バックオフ
                print(f"レート制限。{wait_time}秒待機...")
                time.sleep(wait_time)
            else:
                raise
    raise Exception("最大リトライ回数に達しました")
```

#### 4. 不正なパラメータ

```python
valid_aspect_ratios = [
    "1:1", "2:3", "3:2", "3:4", "4:3",
    "4:5", "5:4", "9:16", "16:9", "21:9"
]

def validate_aspect_ratio(ratio):
    if ratio not in valid_aspect_ratios:
        raise ValueError(f"無効なアスペクト比: {ratio}")
```

---

## ベストプラクティス

### 1. プロンプト最適化

**悪い例:**
```python
prompt = "猫"
```

**良い例:**
```python
prompt = """A photorealistic portrait of a fluffy orange tabby cat
with bright green eyes, sitting on a wooden windowsill,
natural lighting from the side, shallow depth of field,
bokeh background, professional photography"""
```

**ポイント:**
- 具体的なスタイル指定
- 詳細な説明
- 照明・構図の指定
- 英語で記述（より高精度）

### 2. バッチ処理

```python
prompts = [
    "A sunset over mountains",
    "A futuristic robot",
    "A tropical beach"
]

images = []
for prompt in prompts:
    response = model.generate_content(prompt)
    images.append(response.parts[0].inline_data.data)
    time.sleep(1)  # レート制限対策
```

### 3. キャッシング戦略

```python
import hashlib
import json
import os

def generate_with_cache(model, prompt, cache_dir="./cache"):
    os.makedirs(cache_dir, exist_ok=True)

    # プロンプトのハッシュを生成
    prompt_hash = hashlib.md5(prompt.encode()).hexdigest()
    cache_path = f"{cache_dir}/{prompt_hash}.png"

    # キャッシュ確認
    if os.path.exists(cache_path):
        print(f"キャッシュから読み込み: {cache_path}")
        return cache_path

    # 新規生成
    response = model.generate_content(prompt)

    # 保存
    for part in response.parts:
        if hasattr(part, 'inline_data'):
            image_data = base64.b64decode(part.inline_data.data)
            with open(cache_path, "wb") as f:
                f.write(image_data)

    return cache_path
```

### 4. 品質チェック

```python
from PIL import Image

def validate_generated_image(image_path, min_size=(512, 512)):
    """生成画像の品質を検証"""
    img = Image.open(image_path)

    # サイズチェック
    if img.size[0] < min_size[0] or img.size[1] < min_size[1]:
        raise ValueError(f"画像が小さすぎます: {img.size}")

    # 形式チェック
    if img.format not in ["PNG", "JPEG"]:
        raise ValueError(f"サポートされていない形式: {img.format}")

    return True
```

### 5. コスト最適化

```python
def choose_model(quality_required="standard"):
    """用途に応じてモデルを選択"""
    if quality_required == "high":
        return genai.GenerativeModel("gemini-3-pro-image-preview")
    else:
        return genai.GenerativeModel("gemini-2.5-flash-image")

# 使用例
model = choose_model("standard")  # $0.039/画像
# model = choose_model("high")    # より高コスト
```

---

## 📊 コスト計算

### Gemini 2.5 Flash Image

- **価格**: $30.00 / 100万出力トークン
- **1画像**: 1290トークン
- **1画像あたり**: $0.039

**例:**
```python
# 100枚生成
cost = 100 * 0.039  # $3.90
```

### Gemini 3 Pro Image（予想）

- より高価（正確な価格は未公開）
- 4K生成でさらにコスト増加

---

## 🔗 関連リソース

- [公式ドキュメント](https://ai.google.dev/gemini-api/docs/image-generation)
- [Google AI Studio](https://aistudio.google.com/)
- [サンプルコード集](https://github.com/google/generative-ai-python)
- [Gemini API Cookbook](https://github.com/google-gemini/cookbook)

---

**最終更新**: 2025-12-24
**APIバージョン**: v1
