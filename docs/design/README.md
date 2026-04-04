# TechClip デザインファイル管理

## ディレクトリ構成

```
docs/design/
├── README.md              # このファイル
├── *.pen                  # Pencil デザインファイル（画面別）
└── *.png                  # エクスポートした PNG（レビュー・共有用）
```

## ファイル命名規則

| 種別 | 形式 | 例 |
|------|------|-----|
| Pencil ファイル | `<screen-name>.pen` | `article-detail.pen` |
| PNG エクスポート | `<screen-name>.png` | `article-detail.png` |

画面名は kebab-case で統一する。

## 既存 PNG ファイル

現在管理している画面モック:

| ファイル | 画面 |
|---------|------|
| `home-article-list.png` | ホーム - 記事一覧 |
| `home-article-card.png` | ホーム - 記事カード |
| `article-detail.png` | 記事詳細 |
| `article-summary.png` | 記事要約 |
| `article-translation.png` | 記事翻訳 |
| `auth-login.png` | ログイン |
| `auth-register.png` | 新規登録 |
| `search.png` | 検索 |
| `profile-own.png` | プロフィール（自分） |
| `profile-other.png` | プロフィール（他者） |
| `profile-edit.png` | プロフィール編集 |
| `settings.png` | 設定 |
| `notifications.png` | 通知 |
| `save-article.png` | 記事保存 |
| `premium-gate.png` | プレミアムゲート |

## Pencil MCP の使い方

### 新規デザイン作成

```
1. open_document('new') でブランクファイルを作成
2. get_guidelines(topic='mobile-app') でモバイルガイドラインを取得
3. get_style_guide_tags でスタイルガイドタグを確認
4. get_style_guide(tags, name) でスタイルガイドを取得
5. batch_design() でデザインを作成
6. PNG エクスポートして docs/design/ に保存
```

### 既存デザインの参照

```
1. open_document('docs/design/<screen>.pen') でファイルを開く
2. batch_get() でノードを取得・確認
3. 必要に応じて batch_design() で編集
```

## TechClip デザインシステム

### カラーパレット

| 用途 | 色名 | カラーコード |
|------|------|-------------|
| Primary（メイン） | Teal 500 | `#14b8a6` |
| Secondary（アクセント） | Orange 500 | `#f97316` |
| Background | Neutral 50 | `#fafaf9` |
| Surface | White | `#ffffff` |
| Text Primary | Neutral 900 | `#1c1917` |
| Text Secondary | Neutral 500 | `#78716c` |
| Border | Neutral 200 | `#e7e5e4` |
| Success | Green 500 | `#22c55e` |
| Error | Red 500 | `#ef4444` |
| Warning | Amber 500 | `#f59e0b` |

### タイポグラフィ

| 用途 | サイズ | Weight |
|------|--------|--------|
| 見出し H1 | 30px | 700 |
| 見出し H2 | 24px | 600 |
| 見出し H3 | 20px | 600 |
| 本文 | 16px | 400 |
| 補足テキスト | 14px | 400 |
| ラベル | 12px | 500 |

### スペーシング（4px ベース）

```
4px  → 極小の余白
8px  → アイテム間
12px → コンポーネント内パディング
16px → セクション間
24px → カード・コンポーネント間
32px → セクション間（大）
```

### デザイン原則

- グラデーション・ネオンカラー禁止（AI っぽさを排除）
- シンプルな単色ベース
- 控えめなシャドウ（shadow-sm / shadow-md）
- アイコンは Lucide Icons のみ
- モバイルファースト（iOS / Android 両対応）

## Git 管理方針

- `.pen` ファイルと `.png` ファイルの両方をコミットする
- `.pen` ファイルはバイナリのため差分表示不可（コミットメッセージで内容を明記する）
- PNG は PR レビュー・Issue コメントで画像プレビューとして活用する
