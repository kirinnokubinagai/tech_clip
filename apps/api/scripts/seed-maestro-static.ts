declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  exit: (code: number) => never;
};

import { createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import {
  accounts,
  articles,
  articleTags,
  follows,
  notifications,
  summaries,
  tags,
  translations,
  users,
} from "../src/db/schema/index.ts";

/** Turso dev サーバーの接続先 URL */
const SEED_DATABASE_URL = process.env.TURSO_DATABASE_URL ?? "";

/** ローカル DB URL かどうかを判定する */
const IS_LOCAL_SEED_URL =
  SEED_DATABASE_URL.startsWith("http://127.0.0.1") ||
  SEED_DATABASE_URL.startsWith("http://localhost") ||
  SEED_DATABASE_URL.startsWith("file:") ||
  SEED_DATABASE_URL === "";

if (!IS_LOCAL_SEED_URL) {
  process.stderr.write(
    "[seed-maestro-static] FATAL: seed-maestro-static は local DB 専用です。本番DBへの実行を中断します\n",
  );
  process.exit(1);
}

/** CI 環境判定フラグ */
const IS_CI_ENV = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

if (IS_CI_ENV && !process.env.MAESTRO_TEST_PASSWORD) {
  process.stderr.write(
    "[seed-maestro] FATAL: CI 環境では MAESTRO_TEST_PASSWORD の設定が必要です\n",
  );
  process.exit(1);
}

/** Maestro 静的 seed ユーザーのパスワード（ローカルフォールバック付き） */
const MAESTRO_STATIC_PASSWORD = process.env.MAESTRO_TEST_PASSWORD ?? "TestPassword123!";

/** FOLLOWEE ユーザー（自分がフォロー・記事 5 件所有） */
const FOLLOWEE_SPEC = {
  email: "followee+maestro@techclip.app",
  username: "followee_maestro",
  name: "Followee Maestro",
};

/** FOLLOWER ユーザー（自分をフォローしてくる人） */
const FOLLOWER_SPEC = {
  email: "follower+maestro@techclip.app",
  username: "follower_maestro",
  name: "Follower Maestro",
};

/** SECONDARY ユーザー（通知送信源） */
const SECONDARY_SPEC = {
  email: "secondary+maestro@techclip.app",
  username: "secondary_maestro",
  name: "Secondary Maestro",
};

/** PREMIUM ユーザー（有料アカウントのテスト用） */
const PREMIUM_SPEC = {
  email: "premium+maestro@techclip.app",
  username: "premium_maestro",
  name: "Premium Maestro",
};

/** CHANGEPASS ユーザー（パスワード変更 E2E 専用） */
const CHANGEPASS_SPEC = {
  email: "changepass+maestro@techclip.app",
  username: "changepass_maestro",
  name: "ChangePass Maestro",
};

/** Maestro タグ名 */
const MAESTRO_TAG_NAME = "maestro";

/**
 * 実在する技術記事の seed データ
 * アプリがサポートする全ソース (zenn/qiita/note/hatena/devto/medium/github/
 * hackernews/hashnode/stackoverflow/reddit/freecodecamp/logrocket/css-tricks/
 * smashing/twitter/youtube/speakerdeck/other) を最低 1 件ずつ含むように構成
 * Maestro e2e テストや開発時のフィード確認、パーサー動作確認に使用
 */
const SEED_ARTICLES: Array<{
  url: string;
  title: string;
  source: string;
  content: string;
  excerpt: string;
  author: string;
  publishedAt: string;
}> = [
  // ユーザー指定記事
  {
    url: "https://qiita.com/miruky/items/fde2d0747358cd7870d7",
    title: "Claude Code のサブエージェント機能を使ってみた",
    source: "qiita",
    content:
      "# Claude Code のサブエージェント機能を使ってみた\n\n技術の進化は早く、最新動向をキャッチアップすることが重要です。\n\n## 背景\n\nソフトウェア開発において、選択する技術スタックは慎重に検討する必要があります。\n\n## 考察\n\n以下の観点で評価します:\n\n- パフォーマンス\n- メンテナンス性\n- コミュニティ活動度\n- ドキュメントの充実度\n\n## 具体例\n\n```javascript\nfunction calculate(x, y) {\n  return x + y;\n}\n```\n\n## おわりに\n\n継続的な学習が成功の鍵です。",
    excerpt:
      "Claude Code のサブエージェント機能を使ってみた について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://qiita.com/masa_ClaudeCodeLab/items/8c22966fbd3c125c53dc",
    title: "Claude Code Lab: カスタムワークフロー構築",
    source: "qiita",
    content:
      "# Claude Code Lab: カスタムワークフロー構築\n\n技術の進化は早く、最新動向をキャッチアップすることが重要です。\n\n## 背景\n\nソフトウェア開発において、選択する技術スタックは慎重に検討する必要があります。\n\n## 考察\n\n以下の観点で評価します:\n\n- パフォーマンス\n- メンテナンス性\n- コミュニティ活動度\n- ドキュメントの充実度\n\n## 具体例\n\n```javascript\nfunction calculate(x, y) {\n  return x + y;\n}\n```\n\n## おわりに\n\n継続的な学習が成功の鍵です。",
    excerpt:
      "Claude Code Lab: カスタムワークフロー構築 について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://ja.stackoverflow.com/questions/89408/",
    title: "JavaScriptで移動直前に移動先URLにパラメータを追加したい",
    source: "stackoverflow",
    content:
      "# JavaScriptで移動直前に移動先URLにパラメータを追加したい\n\n## はじめに\n\nこの記事を読むことで、新しい技術の活用方法が理解できます。\n\n## 前提条件\n\n- Node.js 20 以上\n- TypeScript 5.x\n- 基本的な React の知識\n\n## ステップバイステップ\n\n### Step 1: セットアップ\n\n```bash\nnpm install package\n```\n\n### Step 2: 設定\n\n設定ファイルを編集します。\n\n### Step 3: 動作確認\n\n## 結論\n\nこの手法により開発効率が向上します。",
    excerpt:
      "JavaScriptで移動直前に移動先URLにパラメータを追加したい について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://zenn.dev/coji/articles/cloudflare-d1-fts5-japanese-search-api",
    title: "Cloudflare D1 + FTS5 で日本語全文検索 API を作る",
    source: "zenn",
    content:
      "# Cloudflare D1 + FTS5 で日本語全文検索 API を作る\n\n## はじめに\n\nこの記事を読むことで、新しい技術の活用方法が理解できます。\n\n## 前提条件\n\n- Node.js 20 以上\n- TypeScript 5.x\n- 基本的な React の知識\n\n## ステップバイステップ\n\n### Step 1: セットアップ\n\n```bash\nnpm install package\n```\n\n### Step 2: 設定\n\n設定ファイルを編集します。\n\n### Step 3: 動作確認\n\n## 結論\n\nこの手法により開発効率が向上します。",
    excerpt:
      "Cloudflare D1 + FTS5 で日本語全文検索 API を作る について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://zenn.dev/naru76/articles/e23911c373e1a0",
    title: "React Native + Expo で実現する技術記事アプリ",
    source: "zenn",
    content:
      "# React Native + Expo で実現する技術記事アプリ\n\n技術の進化は早く、最新動向をキャッチアップすることが重要です。\n\n## 背景\n\nソフトウェア開発において、選択する技術スタックは慎重に検討する必要があります。\n\n## 考察\n\n以下の観点で評価します:\n\n- パフォーマンス\n- メンテナンス性\n- コミュニティ活動度\n- ドキュメントの充実度\n\n## 具体例\n\n```javascript\nfunction calculate(x, y) {\n  return x + y;\n}\n```\n\n## おわりに\n\n継続的な学習が成功の鍵です。",
    excerpt:
      "React Native + Expo で実現する技術記事アプリ について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://github.com/FreeCAD/FreeCAD",
    title: "FreeCAD/FreeCAD — Official FreeCAD source code repository",
    source: "github",
    content:
      '# FreeCAD/FreeCAD — Official FreeCAD source code repository\n\n## 概要\n\n本記事では技術的な実装方法について解説します。\n\n## 実装手順\n\n1. 環境構築\n2. 基本設定\n3. コードの実装\n4. テスト\n\n```typescript\nconst example = () => {\n  console.log("Hello");\n  return 42;\n};\n```\n\n## まとめ\n\n以上が実装のポイントです。詳細は公式ドキュメントを参照してください。',
    excerpt:
      "FreeCAD/FreeCAD — Official FreeCAD source code repository について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://github.com/google/magika",
    title: "google/magika — Detect file content types with deep learning",
    source: "github",
    content:
      '# google/magika — Detect file content types with deep learning\n\n## 概要\n\n本記事では技術的な実装方法について解説します。\n\n## 実装手順\n\n1. 環境構築\n2. 基本設定\n3. コードの実装\n4. テスト\n\n```typescript\nconst example = () => {\n  console.log("Hello");\n  return 42;\n};\n```\n\n## まとめ\n\n以上が実装のポイントです。詳細は公式ドキュメントを参照してください。',
    excerpt:
      "google/magika — Detect file content types with deep learning について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  // 各ソースをカバーする補完記事
  {
    url: "https://note.com/kenshirasu/n/n1aef2a7bd4ab",
    title: "AI時代のエンジニアリングとキャリア設計",
    source: "note",
    content:
      "# AI時代のエンジニアリングとキャリア設計\n\n技術の進化は早く、最新動向をキャッチアップすることが重要です。\n\n## 背景\n\nソフトウェア開発において、選択する技術スタックは慎重に検討する必要があります。\n\n## 考察\n\n以下の観点で評価します:\n\n- パフォーマンス\n- メンテナンス性\n- コミュニティ活動度\n- ドキュメントの充実度\n\n## 具体例\n\n```javascript\nfunction calculate(x, y) {\n  return x + y;\n}\n```\n\n## おわりに\n\n継続的な学習が成功の鍵です。",
    excerpt:
      "AI時代のエンジニアリングとキャリア設計 について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://developer.hatenablog.com/entry/2025/01/15/120000",
    title: "はてなブログ開発チームが使う Go + Cloudflare Workers スタック",
    source: "hatena",
    content:
      "# はてなブログ開発チームが使う Go + Cloudflare Workers スタック\n\n## はじめに\n\nこの記事を読むことで、新しい技術の活用方法が理解できます。\n\n## 前提条件\n\n- Node.js 20 以上\n- TypeScript 5.x\n- 基本的な React の知識\n\n## ステップバイステップ\n\n### Step 1: セットアップ\n\n```bash\nnpm install package\n```\n\n### Step 2: 設定\n\n設定ファイルを編集します。\n\n### Step 3: 動作確認\n\n## 結論\n\nこの手法により開発効率が向上します。",
    excerpt:
      "はてなブログ開発チームが使う Go + Cloudflare Workers スタック について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://dev.to/ruppysuppy/7-killer-one-liners-in-javascript-33ar",
    title: "7 Killer One-Liners In JavaScript",
    source: "devto",
    content:
      '# 7 Killer One-Liners In JavaScript\n\n## 概要\n\n本記事では技術的な実装方法について解説します。\n\n## 実装手順\n\n1. 環境構築\n2. 基本設定\n3. コードの実装\n4. テスト\n\n```typescript\nconst example = () => {\n  console.log("Hello");\n  return 42;\n};\n```\n\n## まとめ\n\n以上が実装のポイントです。詳細は公式ドキュメントを参照してください。',
    excerpt:
      "7 Killer One-Liners In JavaScript について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://medium.com/better-programming/10-modern-css-techniques-for-older-css-problems-722e7141099e",
    title: "10 Modern CSS Techniques for Older CSS Problems",
    source: "medium",
    content:
      "# 10 Modern CSS Techniques for Older CSS Problems\n\n技術の進化は早く、最新動向をキャッチアップすることが重要です。\n\n## 背景\n\nソフトウェア開発において、選択する技術スタックは慎重に検討する必要があります。\n\n## 考察\n\n以下の観点で評価します:\n\n- パフォーマンス\n- メンテナンス性\n- コミュニティ活動度\n- ドキュメントの充実度\n\n## 具体例\n\n```javascript\nfunction calculate(x, y) {\n  return x + y;\n}\n```\n\n## おわりに\n\n継続的な学習が成功の鍵です。",
    excerpt:
      "10 Modern CSS Techniques for Older CSS Problems について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://news.ycombinator.com/item?id=42001234",
    title: "Hacker News discussion item",
    source: "hackernews",
    content:
      '# Hacker News discussion item\n\n## 概要\n\n本記事では技術的な実装方法について解説します。\n\n## 実装手順\n\n1. 環境構築\n2. 基本設定\n3. コードの実装\n4. テスト\n\n```typescript\nconst example = () => {\n  console.log("Hello");\n  return 42;\n};\n```\n\n## まとめ\n\n以上が実装のポイントです。詳細は公式ドキュメントを参照してください。',
    excerpt:
      "Hacker News discussion item について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://blog.graphqleditor.com/how-we-improved-graphql-schema-editor",
    title: "How we improved GraphQL Schema Editor",
    source: "other",
    content:
      "# How we improved GraphQL Schema Editor\n\n## はじめに\n\nこの記事を読むことで、新しい技術の活用方法が理解できます。\n\n## 前提条件\n\n- Node.js 20 以上\n- TypeScript 5.x\n- 基本的な React の知識\n\n## ステップバイステップ\n\n### Step 1: セットアップ\n\n```bash\nnpm install package\n```\n\n### Step 2: 設定\n\n設定ファイルを編集します。\n\n### Step 3: 動作確認\n\n## 結論\n\nこの手法により開発効率が向上します。",
    excerpt:
      "How we improved GraphQL Schema Editor について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://kentcdodds.hashnode.dev/what-is-useevent-and-why-should-you-care",
    title: "What is useEvent and why should you care",
    source: "hashnode",
    content:
      "# What is useEvent and why should you care\n\n## はじめに\n\nこの記事を読むことで、新しい技術の活用方法が理解できます。\n\n## 前提条件\n\n- Node.js 20 以上\n- TypeScript 5.x\n- 基本的な React の知識\n\n## ステップバイステップ\n\n### Step 1: セットアップ\n\n```bash\nnpm install package\n```\n\n### Step 2: 設定\n\n設定ファイルを編集します。\n\n### Step 3: 動作確認\n\n## 結論\n\nこの手法により開発効率が向上します。",
    excerpt:
      "What is useEvent and why should you care について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://www.reddit.com/r/programming/comments/1e91sgo/rust_is_now_part_of_the_linux_kernel/",
    title: "Rust is now part of the Linux kernel",
    source: "reddit",
    content:
      '# Rust is now part of the Linux kernel\n\n## 概要\n\n本記事では技術的な実装方法について解説します。\n\n## 実装手順\n\n1. 環境構築\n2. 基本設定\n3. コードの実装\n4. テスト\n\n```typescript\nconst example = () => {\n  console.log("Hello");\n  return 42;\n};\n```\n\n## まとめ\n\n以上が実装のポイントです。詳細は公式ドキュメントを参照してください。',
    excerpt:
      "Rust is now part of the Linux kernel について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://www.freecodecamp.org/news/how-javascript-works-in-browser-and-node/",
    title: "How JavaScript Works in Browser and Node",
    source: "freecodecamp",
    content:
      "# How JavaScript Works in Browser and Node\n\n## はじめに\n\nこの記事を読むことで、新しい技術の活用方法が理解できます。\n\n## 前提条件\n\n- Node.js 20 以上\n- TypeScript 5.x\n- 基本的な React の知識\n\n## ステップバイステップ\n\n### Step 1: セットアップ\n\n```bash\nnpm install package\n```\n\n### Step 2: 設定\n\n設定ファイルを編集します。\n\n### Step 3: 動作確認\n\n## 結論\n\nこの手法により開発効率が向上します。",
    excerpt:
      "How JavaScript Works in Browser and Node について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://blog.logrocket.com/react-server-components-a-comprehensive-guide/",
    title: "React Server Components: A Comprehensive Guide",
    source: "logrocket",
    content:
      "# React Server Components: A Comprehensive Guide\n\n## はじめに\n\nこの記事を読むことで、新しい技術の活用方法が理解できます。\n\n## 前提条件\n\n- Node.js 20 以上\n- TypeScript 5.x\n- 基本的な React の知識\n\n## ステップバイステップ\n\n### Step 1: セットアップ\n\n```bash\nnpm install package\n```\n\n### Step 2: 設定\n\n設定ファイルを編集します。\n\n### Step 3: 動作確認\n\n## 結論\n\nこの手法により開発効率が向上します。",
    excerpt:
      "React Server Components: A Comprehensive Guide について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://css-tricks.com/a-complete-guide-to-css-functions/",
    title: "A Complete Guide to CSS Functions",
    source: "css-tricks",
    content:
      '# A Complete Guide to CSS Functions\n\n## 概要\n\n本記事では技術的な実装方法について解説します。\n\n## 実装手順\n\n1. 環境構築\n2. 基本設定\n3. コードの実装\n4. テスト\n\n```typescript\nconst example = () => {\n  console.log("Hello");\n  return 42;\n};\n```\n\n## まとめ\n\n以上が実装のポイントです。詳細は公式ドキュメントを参照してください。',
    excerpt:
      "A Complete Guide to CSS Functions について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://www.smashingmagazine.com/2024/06/accessible-mobile-tab-navigation-on-ios/",
    title: "Accessible Mobile Tab Navigation on iOS",
    source: "smashing",
    content:
      '# Accessible Mobile Tab Navigation on iOS\n\n## 概要\n\n本記事では技術的な実装方法について解説します。\n\n## 実装手順\n\n1. 環境構築\n2. 基本設定\n3. コードの実装\n4. テスト\n\n```typescript\nconst example = () => {\n  console.log("Hello");\n  return 42;\n};\n```\n\n## まとめ\n\n以上が実装のポイントです。詳細は公式ドキュメントを参照してください。',
    excerpt:
      "Accessible Mobile Tab Navigation on iOS について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://x.com/dan_abramov/status/1850000000000000000",
    title: "Dan Abramov on React compiler internals",
    source: "twitter",
    content:
      '# Dan Abramov on React compiler internals\n\n## 概要\n\n本記事では技術的な実装方法について解説します。\n\n## 実装手順\n\n1. 環境構築\n2. 基本設定\n3. コードの実装\n4. テスト\n\n```typescript\nconst example = () => {\n  console.log("Hello");\n  return 42;\n};\n```\n\n## まとめ\n\n以上が実装のポイントです。詳細は公式ドキュメントを参照してください。',
    excerpt:
      "Dan Abramov on React compiler internals について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://www.youtube.com/watch?v=OqhouPQRYMc",
    title: "React Native Tutorial 2024",
    source: "youtube",
    content:
      "# React Native Tutorial 2024\n\n技術の進化は早く、最新動向をキャッチアップすることが重要です。\n\n## 背景\n\nソフトウェア開発において、選択する技術スタックは慎重に検討する必要があります。\n\n## 考察\n\n以下の観点で評価します:\n\n- パフォーマンス\n- メンテナンス性\n- コミュニティ活動度\n- ドキュメントの充実度\n\n## 具体例\n\n```javascript\nfunction calculate(x, y) {\n  return x + y;\n}\n```\n\n## おわりに\n\n継続的な学習が成功の鍵です。",
    excerpt:
      "React Native Tutorial 2024 について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://speakerdeck.com/line_developers/ui-kit-and-design-system",
    title: "UI Kit and Design System",
    source: "speakerdeck",
    content:
      '# UI Kit and Design System\n\n## 概要\n\n本記事では技術的な実装方法について解説します。\n\n## 実装手順\n\n1. 環境構築\n2. 基本設定\n3. コードの実装\n4. テスト\n\n```typescript\nconst example = () => {\n  console.log("Hello");\n  return 42;\n};\n```\n\n## まとめ\n\n以上が実装のポイントです。詳細は公式ドキュメントを参照してください。',
    excerpt:
      "UI Kit and Design System について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
  {
    url: "https://blog.cloudflare.com/workers-ai/",
    title: "Workers AI — the next evolution of Cloudflare Workers",
    source: "other",
    content:
      "# Workers AI — the next evolution of Cloudflare Workers\n\n技術の進化は早く、最新動向をキャッチアップすることが重要です。\n\n## 背景\n\nソフトウェア開発において、選択する技術スタックは慎重に検討する必要があります。\n\n## 考察\n\n以下の観点で評価します:\n\n- パフォーマンス\n- メンテナンス性\n- コミュニティ活動度\n- ドキュメントの充実度\n\n## 具体例\n\n```javascript\nfunction calculate(x, y) {\n  return x + y;\n}\n```\n\n## おわりに\n\n継続的な学習が成功の鍵です。",
    excerpt:
      "Workers AI — the next evolution of Cloudflare Workers について解説する記事。実装手順や具体例を含めて詳しく紹介します。",
    author: "maestro_author",
    publishedAt: "2026-04-15T10:00:00.000Z",
  },
];

/** 記事数 */
const ARTICLE_COUNT = SEED_ARTICLES.length;

/** TEST USER (test+maestro@techclip.app) のメールアドレス */
const TEST_USER_EMAIL = "test+maestro@techclip.app";

/**
 * TEST USER 専用の seed 記事
 * test 05 (article-detail) のソースフィルター確認と
 * test 08 (search) の "TypeScript" / "React" キーワード検索に対応する
 * 最初の記事には要約・翻訳を pre-seed して E2E で内容確認する
 */
const TEST_USER_ARTICLES: Array<{
  url: string;
  title: string;
  source: string;
  content: string;
  excerpt: string;
  author: string;
  publishedAt: string;
}> = [
  {
    url: "https://zenn.dev/mizchi/articles/understanding-typescript-type-system",
    title: "TypeScript の型システムを深く理解する",
    source: "zenn",
    content:
      "# TypeScript の型システムを深く理解する\n\nTypeScript は JavaScript に型安全性を追加するプログラミング言語です。\n\n## 基本的な型\n\n- string: 文字列型\n- number: 数値型\n- boolean: 真偽値型\n\n## 型推論\n\nTypeScript は変数の型を自動推論します。\n\n```typescript\nconst greeting: string = 'Hello';\nconst count: number = 42;\n```\n\n## ジェネリクス\n\nジェネリクスを使うと再利用可能なコードを書けます。\n\n```typescript\nfunction identity<T>(arg: T): T {\n  return arg;\n}\n```\n\n## まとめ\n\nTypeScript の型システムを理解することで、バグを早期に発見し、コード品質を向上させることができます。",
    excerpt: "TypeScriptの型システムについて、基本的な型から高度なジェネリクスまで解説します。",
    author: "test_user",
    publishedAt: "2026-04-10T10:00:00.000Z",
  },
  {
    url: "https://qiita.com/test_author/items/react-hooks-complete-guide",
    title: "React Hooks 完全ガイド：useState から useEffect まで",
    source: "qiita",
    content:
      "# React Hooks 完全ガイド：useState から useEffect まで\n\nReact Hooks は関数コンポーネントで状態管理や副作用を扱うための仕組みです。\n\n## useState\n\n```javascript\nconst [count, setCount] = useState(0);\n```\n\n## useEffect\n\n副作用の処理に使います。\n\n```javascript\nuseEffect(() => {\n  document.title = count.toString();\n}, [count]);\n```\n\n## useCallback\n\nコールバック関数をメモ化します。\n\n## useMemo\n\n計算結果をメモ化します。\n\n## まとめ\n\nHooks を使いこなすことで React アプリの品質が向上します。",
    excerpt: "React Hooksの使い方を useState/useEffect/useCallback/useMemo を中心に解説します。",
    author: "test_user",
    publishedAt: "2026-04-08T10:00:00.000Z",
  },
  {
    url: "https://developer.hatenablog.com/entry/2026/01/10/typescript-react-best-practices",
    title: "TypeScript × React のベストプラクティス 2026",
    source: "hatena",
    content:
      "# TypeScript × React のベストプラクティス 2026\n\n## はじめに\n\nTypeScript と React を組み合わせた開発のベストプラクティスを紹介します。\n\n## Props の型定義\n\n```typescript\ntype ButtonProps = {\n  label: string;\n  onClick: () => void;\n  disabled?: boolean;\n};\n\nconst Button: React.FC<ButtonProps> = ({ label, onClick, disabled }) => (\n  <button onClick={onClick} disabled={disabled}>\n    {label}\n  </button>\n);\n```\n\n## カスタム Hooks\n\n```typescript\nfunction useCounter(initialValue: number) {\n  const [count, setCount] = useState(initialValue);\n  const increment = () => setCount((c) => c + 1);\n  return { count, increment };\n}\n```\n\n## まとめ\n\n型安全な React コンポーネントを書くことで保守性が向上します。",
    excerpt: "TypeScriptとReactを組み合わせた開発のベストプラクティスをコード例付きで解説します。",
    author: "test_user",
    publishedAt: "2026-04-05T10:00:00.000Z",
  },
  {
    url: "https://dev.to/test_author/react-native-expo-2026-guide",
    title: "React Native + Expo でモバイルアプリ開発入門 2026",
    source: "devto",
    content:
      "# React Native + Expo でモバイルアプリ開発入門 2026\n\nReact Native と Expo を使うと JavaScript/TypeScript でネイティブモバイルアプリを作れます。\n\n## セットアップ\n\n```bash\nnpx create-expo-app my-app\ncd my-app\nnpx expo start\n```\n\n## 基本コンポーネント\n\n- View: レイアウト用コンテナ\n- Text: テキスト表示\n- Pressable: タッチイベント\n\n## まとめ\n\nExpo を使うとモバイルアプリ開発のハードルが大幅に下がります。",
    excerpt: "React NativeとExpoを使ったモバイルアプリ開発の始め方を初心者向けに解説します。",
    author: "test_user",
    publishedAt: "2026-04-02T10:00:00.000Z",
  },
  {
    url: "https://github.com/microsoft/TypeScript",
    title: "microsoft/TypeScript — TypeScript is a superset of JavaScript",
    source: "github",
    content:
      "# microsoft/TypeScript\n\nTypeScript is a language for application-scale JavaScript.\n\n## TypeScript adds optional types\n\nTypeScript adds optional types, classes, and modules to JavaScript.\n\n## Compile to plain JavaScript\n\nTypeScript compiles to plain, idiomatic JavaScript that runs in any browser, in Node.js, or in any JavaScript engine.\n\n## Key Features\n\n- Optional static typing\n- Type inference\n- Generics\n- Decorators\n- Async/await support",
    excerpt: "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.",
    author: "test_user",
    publishedAt: "2026-03-28T10:00:00.000Z",
  },
];

/** TEST USER 記事に pre-seed する日本語要約 */
const TEST_SUMMARY_JA =
  "TypeScript は JavaScript に型安全性を追加するプログラミング言語です。型推論やジェネリクスを活用することで、コンパイル時にバグを早期に発見でき、大規模プロジェクトの保守性が向上します。";

/** TEST USER 記事に pre-seed する英語翻訳タイトル */
const TEST_TRANSLATION_TITLE = "Deep Understanding of TypeScript Type System";

/** TEST USER 記事に pre-seed する英語翻訳本文 */
const TEST_TRANSLATION_CONTENT =
  "TypeScript is a programming language that adds type safety to JavaScript. By leveraging type inference and generics, you can catch bugs at compile time and improve the maintainability of large-scale projects. Understanding the TypeScript type system is essential for writing high-quality JavaScript applications.";
/**
 * scrypt でパスワードをハッシュ化する（Better Auth 互換）
 *
 * @param password - 平文パスワード
 * @returns salt:hash 形式のハッシュ文字列
 */
async function hashPasswordForBetterAuth(password: string): Promise<string> {
  const { scryptAsync } = await import("@noble/hashes/scrypt.js");
  const { hex } = await import("@better-auth/utils/hex");

  const N = 16384;
  const r = 16;
  const p = 1;
  const dkLen = 64;

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = hex.encode(saltBytes);
  const key = await scryptAsync(password.normalize("NFKC"), salt, {
    N,
    p,
    r,
    dkLen,
    maxmem: 128 * N * r * 2,
  });
  return `${salt}:${hex.encode(key)}`;
}

/**
 * ユーザーを upsert する（存在すれば update、無ければ insert）
 *
 * @param db - Drizzle DB インスタンス
 * @param spec - ユーザー情報
 * @returns ユーザー ID
 */
async function upsertUser(
  db: ReturnType<typeof drizzle>,
  spec: { email: string; username: string; name: string },
): Promise<string> {
  const existing = await db.select().from(users).where(eq(users.email, spec.email)).limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        name: spec.name,
        username: spec.username,
        emailVerified: true,
        isProfilePublic: true,
        preferredLanguage: "ja",
        isPremium: false,
        freeAiUsesRemaining: 5,
        isTestAccount: true,
      })
      .where(eq(users.id, existing[0].id));
    return existing[0].id;
  }

  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email: spec.email,
    name: spec.name,
    username: spec.username,
    emailVerified: true,
    isProfilePublic: true,
    preferredLanguage: "ja",
    isPremium: false,
    freeAiUsesRemaining: 5,
    isTestAccount: true,
  });
  return id;
}

/**
 * credential account を upsert する（存在すれば password を update）
 *
 * @param db - Drizzle DB インスタンス
 * @param userId - ユーザー ID
 * @param plainPassword - 平文パスワード
 */
async function upsertAccount(
  db: ReturnType<typeof drizzle>,
  userId: string,
  plainPassword: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);

  const hashed = await hashPasswordForBetterAuth(plainPassword);

  if (existing.length > 0) {
    await db.update(accounts).set({ password: hashed }).where(eq(accounts.id, existing[0].id));
    return;
  }

  await db.insert(accounts).values({
    id: crypto.randomUUID(),
    userId,
    accountId: userId,
    providerId: "credential",
    password: hashed,
  });
}

/**
 * 記事を upsert する（userId + url の unique 制約を利用）
 *
 * @param db - Drizzle DB インスタンス
 * @param userId - ユーザー ID
 * @param url - 記事 URL
 * @param data - 記事データ
 * @param createdAt - 作成日時
 * @returns 記事 ID
 */
async function upsertArticle(
  db: ReturnType<typeof drizzle>,
  userId: string,
  url: string,
  data: {
    title: string;
    source: string;
    content?: string | null;
    excerpt?: string | null;
    author?: string | null;
    thumbnailUrl?: string | null;
    publishedAt?: string | null;
    readingTimeMinutes?: number | null;
    isPublic?: boolean;
  },
  createdAt: Date,
): Promise<string> {
  const existing = await db
    .select()
    .from(articles)
    .where(and(eq(articles.userId, userId), eq(articles.url, url)))
    .limit(1);

  const now = new Date();

  if (existing.length > 0) {
    await db
      .update(articles)
      .set({
        title: data.title,
        source: data.source,
        content: data.content ?? null,
        excerpt: data.excerpt ?? null,
        author: data.author ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        readingTimeMinutes: data.readingTimeMinutes ?? null,
        isPublic: data.isPublic ?? false,
        updatedAt: now,
      })
      .where(eq(articles.id, existing[0].id));
    return existing[0].id;
  }

  const id = crypto.randomUUID();
  await db.insert(articles).values({
    id,
    userId,
    url,
    source: data.source,
    title: data.title,
    content: data.content ?? null,
    excerpt: data.excerpt ?? null,
    author: data.author ?? null,
    thumbnailUrl: data.thumbnailUrl ?? null,
    publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    readingTimeMinutes: data.readingTimeMinutes ?? null,
    isPublic: data.isPublic ?? false,
    createdAt,
    updatedAt: now,
  });
  return id;
}

/**
 * タグを upsert する（userId + name の unique 制約を利用）
 *
 * @param db - Drizzle DB インスタンス
 * @param userId - ユーザー ID
 * @param name - タグ名
 * @returns タグ ID
 */
async function upsertTag(
  db: ReturnType<typeof drizzle>,
  userId: string,
  name: string,
): Promise<string> {
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), eq(tags.name, name)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const id = crypto.randomUUID();
  await db.insert(tags).values({
    id,
    userId,
    name,
    createdAt: new Date(),
  });
  return id;
}

/**
 * フォロー関係を upsert する（存在すれば skip）
 *
 * @param db - Drizzle DB インスタンス
 * @param followerId - フォロワー ID
 * @param followingId - フォロイー ID
 */
async function upsertFollow(
  db: ReturnType<typeof drizzle>,
  followerId: string,
  followingId: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  await db.insert(follows).values({ followerId, followingId });
}

/** 通知の型名（モバイル NotificationType と一致させる） */
type NotificationType = "follow" | "like" | "system";

/** 通知シードデータの定義 */
const SEED_NOTIFICATIONS: Array<{ type: NotificationType; title: string; body: string }> = [
  {
    type: "follow",
    title: "新しいフォロワーがいます",
    body: "followeeユーザーがあなたをフォローしました。",
  },
  {
    type: "system",
    title: "システムのお知らせ",
    body: "TechClipがアップデートされました。新機能をお試しください。",
  },
  {
    type: "follow",
    title: "新しいフォロワーがいます",
    body: "secondaryユーザーがあなたをフォローしました。",
  },
  {
    type: "like",
    title: "記事にいいねが付きました",
    body: "あなたのクリップした記事に followeeユーザー がいいねしました。",
  },
  {
    type: "like",
    title: "記事にいいねが付きました",
    body: "あなたのクリップした記事に secondaryユーザー がいいねしました。",
  },
  {
    type: "system",
    title: "新機能のお知らせ：通知機能が強化されました",
    body: "フォロワーの最新活動やいいね通知をリアルタイムで受け取れるようになりました。",
  },
  {
    type: "follow",
    title: "新しいフォロワーがいます",
    body: "premiumユーザーがあなたをフォローしました。",
  },
  {
    type: "like",
    title: "記事にいいねが付きました",
    body: "あなたのクリップした記事に 3人 がいいねしました。",
  },
  {
    type: "system",
    title: "メンテナンスのお知らせ",
    body: "定期メンテナンスを実施します。一部機能が一時的に利用できない場合があります。",
  },
  {
    type: "follow",
    title: "新しいフォロワーがいます",
    body: "changepassユーザーがあなたをフォローしました。",
  },
];

/**
 * 通知を upsert する（id の onConflictDoNothing で冪等）
 *
 * @param db - Drizzle DB インスタンス
 * @param userId - 通知先ユーザー ID
 * @param id - 通知 ID（固定値で冪等性を保証）
 * @param type - 通知タイプ
 * @param title - 通知タイトル
 * @param body - 通知本文
 */
async function upsertNotification(
  db: ReturnType<typeof drizzle>,
  userId: string,
  id: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  await db
    .insert(notifications)
    .values({ id, userId, type, title, body, isRead: false })
    .onConflictDoNothing();
}

/**
 * 要約を upsert する（articleId + language の unique 制約を利用）
 *
 * @param db - Drizzle DB インスタンス
 * @param articleId - 記事 ID
 * @param language - 言語コード（例: "ja"）
 * @param summaryText - 要約テキスト
 */
async function upsertSummary(
  db: ReturnType<typeof drizzle>,
  articleId: string,
  language: string,
  summaryText: string,
): Promise<void> {
  await db
    .insert(summaries)
    .values({
      id: crypto.randomUUID(),
      articleId,
      language,
      summary: summaryText,
      model: "seed-mock",
      createdAt: new Date(),
    })
    .onConflictDoNothing();
}

/**
 * 翻訳を upsert する（articleId + targetLanguage の unique 制約を利用）
 *
 * @param db - Drizzle DB インスタンス
 * @param articleId - 記事 ID
 * @param targetLanguage - 翻訳先言語コード（例: "en"）
 * @param translatedTitle - 翻訳済みタイトル
 * @param translatedContent - 翻訳済み本文
 */
async function upsertTranslation(
  db: ReturnType<typeof drizzle>,
  articleId: string,
  targetLanguage: string,
  translatedTitle: string,
  translatedContent: string,
): Promise<void> {
  await db
    .insert(translations)
    .values({
      id: crypto.randomUUID(),
      articleId,
      targetLanguage,
      translatedTitle,
      translatedContent,
      model: "seed-mock",
      createdAt: new Date(),
    })
    .onConflictDoNothing();
}

/**
 * Maestro e2e 用静的 seed を実行する（冪等 upsert）
 *
 * 3 ユーザー（FOLLOWEE / FOLLOWER / SECONDARY）と FOLLOWEE の記事 5 件を seed する。
 * TURSO_DATABASE_URL 環境変数が必要。TURSO_AUTH_TOKEN は省略可（ローカル turso dev 用）。
 */
async function seedMaestroStatic(): Promise<void> {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl) {
    throw new Error("環境変数 TURSO_DATABASE_URL が設定されていません");
  }

  const client = createClient({
    url: databaseUrl,
    authToken: authToken ?? "",
  });
  const db = drizzle(client);

  process.stdout.write("Maestro 静的 seed を開始します...\n");

  const followeeId = await upsertUser(db, FOLLOWEE_SPEC);
  process.stdout.write(`FOLLOWEE upsert 完了: ${followeeId}\n`);

  const followerId = await upsertUser(db, FOLLOWER_SPEC);
  process.stdout.write(`FOLLOWER upsert 完了: ${followerId}\n`);

  const secondaryId = await upsertUser(db, SECONDARY_SPEC);
  process.stdout.write(`SECONDARY upsert 完了: ${secondaryId}\n`);

  const premiumId = await upsertUser(db, PREMIUM_SPEC);
  await db
    .update(users)
    .set({ isPremium: true, premiumExpiresAt: "2099-12-31T23:59:59.000Z" })
    .where(eq(users.id, premiumId));
  process.stdout.write(`PREMIUM upsert 完了（isPremium=true）: ${premiumId}\n`);

  const changepassId = await upsertUser(db, CHANGEPASS_SPEC);
  process.stdout.write(`CHANGEPASS upsert 完了: ${changepassId}\n`);

  await upsertAccount(db, followeeId, MAESTRO_STATIC_PASSWORD);
  await upsertAccount(db, followerId, MAESTRO_STATIC_PASSWORD);
  await upsertAccount(db, secondaryId, MAESTRO_STATIC_PASSWORD);
  await upsertAccount(db, premiumId, MAESTRO_STATIC_PASSWORD);
  await upsertAccount(db, changepassId, MAESTRO_STATIC_PASSWORD);
  process.stdout.write("accounts upsert 完了\n");

  const articleIds: string[] = [];
  for (let i = 0; i < SEED_ARTICLES.length; i++) {
    const spec = SEED_ARTICLES[i];
    const createdAt = new Date(Date.now() - (SEED_ARTICLES.length - i) * 60 * 1000);
    const articleId = await upsertArticle(
      db,
      followeeId,
      spec.url,
      {
        title: spec.title,
        source: spec.source,
        content: spec.content,
        excerpt: spec.excerpt,
        author: spec.author,
        thumbnailUrl: null,
        publishedAt: spec.publishedAt,
        readingTimeMinutes: Math.ceil((spec.content?.length ?? 0) / 500),
        isPublic: true,
      },
      createdAt,
    );
    articleIds.push(articleId);
  }
  process.stdout.write(`記事 ${ARTICLE_COUNT} 件 upsert 完了\n`);

  const tagId = await upsertTag(db, followeeId, MAESTRO_TAG_NAME);
  process.stdout.write(`タグ "${MAESTRO_TAG_NAME}" upsert 完了: ${tagId}\n`);

  for (const articleId of articleIds) {
    await db.insert(articleTags).values({ articleId, tagId }).onConflictDoNothing();
  }
  process.stdout.write("articleTags upsert 完了\n");

  // FOLLOWEE は paywall テスト用のため freeAiUsesRemaining=0 かつ freeAiResetAt を遠い未来に設定
  // freeAiResetAt が null または過去だと ai-limit ミドルウェアが自動リセットしてしまい、
  // ペイウォール (402) が発火しないため、十分先の日付で reset を抑制する
  await db
    .update(users)
    .set({ freeAiUsesRemaining: 0, freeAiResetAt: "2099-12-31T23:59:59.000Z" })
    .where(eq(users.id, followeeId));
  process.stdout.write("FOLLOWEE freeAiUsesRemaining=0, freeAiResetAt=2099-12-31 に設定\n");

  await upsertFollow(db, followerId, followeeId);
  process.stdout.write("FOLLOWER → FOLLOWEE フォロー upsert 完了\n");

  for (let i = 0; i < SEED_NOTIFICATIONS.length; i++) {
    const n = SEED_NOTIFICATIONS[i];
    await upsertNotification(
      db,
      followerId,
      `maestro-notification-follower-${i}`,
      n.type,
      n.title,
      n.body,
    );
  }
  process.stdout.write(`FOLLOWER 通知 ${SEED_NOTIFICATIONS.length} 件 upsert 完了\n`);

  // TEST USER (test+maestro@techclip.app) の補完 seed
  // main seed.ts が作成した TEST USER にメールアドレスで検索してIDを取得し、
  // 記事・要約・翻訳・フォロー・通知を追加する
  const testUserRows = await db
    .select()
    .from(users)
    .where(eq(users.email, TEST_USER_EMAIL))
    .limit(1);

  if (testUserRows.length > 0) {
    const testUserId = testUserRows[0].id;

    await db
      .update(users)
      .set({ isTestAccount: true, freeAiUsesRemaining: 5 })
      .where(eq(users.id, testUserId));

    const testArticleIds: string[] = [];
    for (let i = 0; i < TEST_USER_ARTICLES.length; i++) {
      const spec = TEST_USER_ARTICLES[i];
      // 最新記事が先頭に来るよう作成日時を設定（index 0 が最新）
      const createdAt = new Date(Date.now() - i * 3 * 60 * 1000);
      const articleId = await upsertArticle(
        db,
        testUserId,
        spec.url,
        {
          title: spec.title,
          source: spec.source,
          content: spec.content,
          excerpt: spec.excerpt,
          author: spec.author,
          thumbnailUrl: null,
          publishedAt: spec.publishedAt,
          readingTimeMinutes: Math.ceil((spec.content?.length ?? 0) / 500),
        },
        createdAt,
      );
      testArticleIds.push(articleId);
    }
    process.stdout.write(`TEST USER 記事 ${TEST_USER_ARTICLES.length} 件 upsert 完了\n`);

    // 最初の記事（ホーム画面先頭）に要約と翻訳を pre-seed
    if (testArticleIds.length > 0) {
      await upsertSummary(db, testArticleIds[0], "ja", TEST_SUMMARY_JA);
      await upsertTranslation(
        db,
        testArticleIds[0],
        "en",
        TEST_TRANSLATION_TITLE,
        TEST_TRANSLATION_CONTENT,
      );
      process.stdout.write("TEST USER 記事[0] の要約・翻訳 pre-seed 完了\n");
    }

    // TEST USER が FOLLOWEE をフォロー
    await upsertFollow(db, testUserId, followeeId);
    process.stdout.write("TEST USER → FOLLOWEE フォロー upsert 完了\n");

    // TEST USER の通知を seed
    const testUserNotifications: Array<{
      type: NotificationType;
      title: string;
      body: string;
    }> = [
      {
        type: "follow",
        title: "新しいフォロワーがいます",
        body: "followerユーザーがあなたをフォローしました。",
      },
      {
        type: "like",
        title: "記事にいいねが付きました",
        body: "あなたのクリップした記事に followeeユーザー がいいねしました。",
      },
      {
        type: "system",
        title: "システムのお知らせ",
        body: "TechClipがアップデートされました。新機能をお試しください。",
      },
      {
        type: "follow",
        title: "新しいフォロワーがいます",
        body: "secondaryユーザーがあなたをフォローしました。",
      },
      {
        type: "like",
        title: "記事にいいねが付きました",
        body: "あなたのクリップした記事に 5人 がいいねしました。",
      },
    ];

    for (let i = 0; i < testUserNotifications.length; i++) {
      const n = testUserNotifications[i];
      await upsertNotification(
        db,
        testUserId,
        `maestro-notification-test-${i}`,
        n.type,
        n.title,
        n.body,
      );
    }
    process.stdout.write(`TEST USER 通知 ${testUserNotifications.length} 件 upsert 完了\n`);
  } else {
    process.stdout.write(
      `WARN: TEST USER (${TEST_USER_EMAIL}) が見つかりません。db:seed を先に実行してください。\n`,
    );
  }

  client.close();
  process.stdout.write("Maestro 静的 seed 完了\n");
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("seed-maestro-static.ts") ||
    process.argv[1].endsWith("seed-maestro-static.js"));

if (isMain) {
  seedMaestroStatic().catch((e) => {
    process.stderr.write(`seed-maestro-static エラー: ${String(e)}\n`);
    process.exit(1);
  });
}

export { seedMaestroStatic };
