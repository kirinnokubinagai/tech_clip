---
name: pencil-design
description: Pencil MCP でデザインモックを作成・更新する
triggers:
  - デザイン
  - design mock
  - モック作成
  - pencil
---
# Pencil デザインモックワークフロー

Pencil MCP を使ってデザインモックアップを作成・更新するスキル。

## 概要

TechClip のモバイル画面を `.pen` ファイルとして設計・管理する。
実装前にデザインモックを作成し、UI/UX を固めてから実装 Issue に進む。

## ワークフロー

### 新規デザイン作成

```
1. open_document("new") でブランクファイルを作成
2. get_guidelines(topic="mobile-app") でモバイルガイドラインを取得
3. get_style_guide_tags() でスタイルガイドタグを確認
4. get_style_guide(tags, name) でスタイルガイドを取得
5. batch_design(...) でデザインを作成
6. docs/design/<screen-name>.pen として保存
7. PNG エクスポートして docs/design/<screen-name>.png に保存
```

### 既存デザインの参照・更新

```
1. open_document("docs/design/<screen>.pen") でファイルを開く
   ※ エディタが既に開いている場合は get_editor_state() で状態確認
2. batch_get(patterns, nodeIds) でノードを取得・確認
3. 必要に応じて batch_design(...) で編集
4. PNG エクスポートして docs/design/ に保存
```

### コミット

```bash
git add docs/design/
git commit -m "design: add <screen-name> mockup #<issue番号>"
```

## デザイン規約

- カラーシステム: `.claude/rules/frontend-design.md` に準拠
- アイコン: Lucide Icons を使用（絵文字禁止）
- AIっぽいデザイン要素（グラデーション、ネオン、blob）は禁止
- シンプルで落ち着いたトーンを維持する

既存 PNG ファイルの一覧・Git 管理方針・実装時の注意事項は `docs/design/README.md` を参照。

## ファイル配置

```
docs/design/
├── README.md
├── home-article-list.pen
├── article-detail.pen
├── home-article-list.png
├── article-detail.png
└── ...
```
