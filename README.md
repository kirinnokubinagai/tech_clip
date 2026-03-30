# TechClip

TechClip は、複数の技術系ニュースソースから記事を収集し、AI による要約・翻訳機能を提供するモバイルアプリケーションです。

## Tech Stack

| カテゴリ | 技術 |
|---------|------|
| パッケージマネージャー | pnpm |
| モノレポ管理 | Turborepo |
| モバイル | React Native + Expo (Expo Router) |
| スタイリング | NativeWind v4 |
| 状態管理 | Zustand + TanStack Query |
| API | Cloudflare Workers + Hono |
| データベース | Turso + Drizzle ORM |
| 認証 | Better Auth |
| AI 要約・翻訳 | RunPod + Qwen3.5 9B |
| Lint / Format | Biome |
| 開発環境 | Nix (flake.nix) |

## プロジェクト構成

```
tech_clip/
├── apps/
│   ├── mobile/          # React Native + Expo アプリ
│   └── api/             # Cloudflare Workers + Hono API
├── packages/
│   └── types/           # 共有型定義パッケージ
├── turbo.json           # Turborepo 設定
├── pnpm-workspace.yaml  # pnpm ワークスペース定義
├── biome.json           # Biome (lint + format) 設定
└── flake.nix            # Nix 開発環境定義
```

## セットアップ

### 前提条件

- Node.js 22+
- pnpm 10+
- Docker（OWASP ZAPローカルセキュリティスキャンに必要。pre-push時に自動実行。未インストールの場合はスキップされる）

Nix を使用する場合は `nix develop` で全ツールが揃います（Docker除く。Dockerは別途インストールが必要）。

### インストール

```bash
pnpm install
```

### 開発サーバー起動

```bash
# モバイルアプリ（Expo）
pnpm dev:mobile

# API サーバー（Cloudflare Workers）
pnpm dev:api
```

### その他のコマンド

```bash
# 型チェック
pnpm typecheck

# テスト実行
pnpm test

# Lint チェック
pnpm lint

# Lint 自動修正
pnpm lint:fix

# ビルド
pnpm build
```

## アーキテクチャ概要

### モバイル (`apps/mobile`)

Expo Router によるファイルベースルーティングを採用。Zustand でクライアント状態を管理し、TanStack Query でサーバー状態を管理します。NativeWind v4 によるダークテーマ UI を提供します。

### API (`apps/api`)

Cloudflare Workers 上で動作する Hono ベースの REST API。Drizzle ORM で Turso (SQLite) に接続し、Better Auth で認証を処理します。

### 共有型定義 (`packages/types`)

モバイルと API 間で共有する TypeScript 型定義パッケージ。記事、ユーザー、要約、タグなどの型を管理します。

## ライセンス

Private
