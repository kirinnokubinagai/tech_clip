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
| `summary-language-settings.png` | 要約言語設定 |
| `twitter-save.png` | X（Twitter）保存 |
| `youtube-summary.png` | YouTube要約 |

## Pencil MCP の使い方

詳細なワークフローは `.claude/skills/design/pencil-design/SKILL.md` を参照。以下は概要。

### 新規デザイン作成

```
1. open_document('new') でブランクファイルを作成
2. get_guidelines(topic='mobile-app') でモバイルガイドラインを取得
3. get_style_guide_tags でスタイルガイドタグを確認
4. get_style_guide(tags, name) でスタイルガイドを取得
5. batch_design() でデザインを作成
6. docs/design/<screen-name>.pen として保存
7. PNG エクスポートして docs/design/<screen-name>.png に保存
```

### 既存デザインの参照

```
1. open_document('docs/design/<screen>.pen') でファイルを開く
2. batch_get() でノードを取得・確認
3. 必要に応じて batch_design() で編集
4. PNG エクスポートして docs/design/ に保存
```

## TechClip デザインシステム

カラーパレット・タイポグラフィ・スペーシング・デザイン原則の詳細は `.claude/rules/frontend-design.md` を参照。

## Git 管理方針

- Pencil MCP で新規作成したデザインは `.pen` ファイルと `.png` ファイルの両方をコミットする
- 既存の `.pen` なし PNG（レガシー）はそのまま管理する
- `.pen` ファイルはバイナリのため差分表示不可（コミットメッセージで内容を明記する）
- PNG は PR レビュー・Issue コメントで画像プレビューとして活用する

> **注意**: このPR（#544）で追加した `summary-language-settings.png` / `twitter-save.png` / `youtube-summary.png` は初期ドラフトのため `.pen` ファイルが存在しない。次回 Pencil MCP でリデザインする際に `.pen` ファイルも生成・コミットすること。

## 実装時の注意事項

以下のモックに含まれるラベルは `.claude/rules/frontend-design.md` の「AIらしさを排除するデザイン原則」に抵触するため、実装時は変更すること。

| ファイル | モック上のラベル | 実装時のラベル |
|---------|----------------|---------------|
| `twitter-save.png` | ✨ AI要約 | 要約する |
| `youtube-summary.png` | ✨ AI要約を生成 | 要約を生成 |
| `youtube-summary.png` | AI要約（セクション見出し） | 要約 |
| `summary-language-settings.png` | AI要約の出力言語を選択してください | 出力言語を選択してください |
| `summary-language-settings.png` | 選択した言語でAI要約が生成されます | 選択した言語で要約が生成されます |
