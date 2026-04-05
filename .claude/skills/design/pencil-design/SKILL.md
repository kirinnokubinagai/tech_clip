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

### 1. エディタ状態の確認

```
get_editor_state()
```

### 2. ガイドラインの取得

```
get_guidelines(topic="mobile-app")
```

### 3. スタイルガイドの選択

```
get_style_guide_tags()
get_style_guide(tags, name)
```

### 4. モックアップの作成・更新

```
batch_get(patterns, nodeIds)
batch_design(...)
```

### 5. コミット

```bash
git add docs/design/
git commit -m "design: add <screen-name> mockup #<issue番号>"
```

## デザイン規約

- カラーシステム: `.claude/rules/frontend-design.md` に準拠
- アイコン: Lucide Icons を使用（絵文字禁止）
- AIっぽいデザイン要素（グラデーション、ネオン、blob）は禁止
- シンプルで落ち着いたトーンを維持する

## ファイル配置

```
docs/design/
├── README.md
├── home.pen
├── article-detail.pen
├── home.png
├── article-detail.png
└── ...
```
