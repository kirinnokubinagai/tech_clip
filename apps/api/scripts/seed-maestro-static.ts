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

import { accounts, articles, articleTags, follows, tags, users } from "../src/db/schema";

/** Maestro 静的 seed ユーザーのパスワード */
const MAESTRO_STATIC_PASSWORD = "TestPassword123!";

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

/** FOLLOWEE が所有する記事の URL プレフィックス */
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
}> = [
  // ユーザー指定記事
  {
    url: "https://qiita.com/miruky/items/fde2d0747358cd7870d7",
    title: "Claude Code のサブエージェント機能を使ってみた",
    source: "qiita.com",
  },
  {
    url: "https://qiita.com/masa_ClaudeCodeLab/items/8c22966fbd3c125c53dc",
    title: "Claude Code Lab: カスタムワークフロー構築",
    source: "qiita.com",
  },
  {
    url: "https://ja.stackoverflow.com/questions/89408/",
    title: "JavaScriptで移動直前に移動先URLにパラメータを追加したい",
    source: "ja.stackoverflow.com",
  },
  {
    url: "https://zenn.dev/coji/articles/cloudflare-d1-fts5-japanese-search-api",
    title: "Cloudflare D1 + FTS5 で日本語全文検索 API を作る",
    source: "zenn.dev",
  },
  {
    url: "https://zenn.dev/naru76/articles/e23911c373e1a0",
    title: "React Native + Expo で実現する技術記事アプリ",
    source: "zenn.dev",
  },
  {
    url: "https://github.com/FreeCAD/FreeCAD",
    title: "FreeCAD/FreeCAD — Official FreeCAD source code repository",
    source: "github.com",
  },
  {
    url: "https://github.com/google/magika",
    title: "google/magika — Detect file content types with deep learning",
    source: "github.com",
  },
  // 各ソースをカバーする補完記事
  {
    url: "https://note.com/kenshirasu/n/n1aef2a7bd4ab",
    title: "AI時代のエンジニアリングとキャリア設計",
    source: "note.com",
  },
  {
    url: "https://developer.hatenablog.com/entry/2025/01/15/120000",
    title: "はてなブログ開発チームが使う Go + Cloudflare Workers スタック",
    source: "hatenablog.com",
  },
  {
    url: "https://dev.to/codewithshahan/top-10-vscode-extensions-for-2026-4kml",
    title: "Top 10 VS Code Extensions for 2026",
    source: "dev.to",
  },
  {
    url: "https://medium.com/swlh/building-scalable-microservices-with-kubernetes-2026-guide-9f8a3c1e5b2d",
    title: "Building Scalable Microservices with Kubernetes — 2026 Guide",
    source: "medium.com",
  },
  {
    url: "https://news.ycombinator.com/item?id=41234567",
    title: "Show HN: A new approach to distributed consensus",
    source: "news.ycombinator.com",
  },
  {
    url: "https://hashnode.com/post/why-typescript-5-8-changes-everything-clxyz012abc3d4e5",
    title: "Why TypeScript 5.8 Changes Everything",
    source: "hashnode.com",
  },
  {
    url: "https://www.reddit.com/r/programming/comments/1abc2de/how_rust_is_eating_the_systems_programming_world/",
    title: "How Rust is eating the systems programming world",
    source: "reddit.com",
  },
  {
    url: "https://www.freecodecamp.org/news/modern-javascript-concepts-2026/",
    title: "Modern JavaScript Concepts Every Developer Should Know (2026)",
    source: "freecodecamp.org",
  },
  {
    url: "https://blog.logrocket.com/react-server-components-deep-dive-2026/",
    title: "React Server Components Deep Dive (2026)",
    source: "blog.logrocket.com",
  },
  {
    url: "https://css-tricks.com/container-queries-in-production/",
    title: "Container Queries in Production",
    source: "css-tricks.com",
  },
  {
    url: "https://www.smashingmagazine.com/2026/02/accessibility-testing-automation/",
    title: "Automating Accessibility Testing in Modern Web Apps",
    source: "smashingmagazine.com",
  },
  {
    url: "https://x.com/dan_abramov/status/1850000000000000000",
    title: "Dan Abramov on React compiler internals",
    source: "x.com",
  },
  {
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "技術カンファレンス基調講演ダイジェスト",
    source: "youtube.com",
  },
  {
    url: "https://speakerdeck.com/example-org/modern-frontend-architecture-2026",
    title: "Modern Frontend Architecture 2026 — SpeakerDeck Presentation",
    source: "speakerdeck.com",
  },
  {
    url: "https://engineering.example.com/blog/post/2026/03/building-resilient-systems",
    title: "Building Resilient Distributed Systems — Engineering Blog",
    source: "engineering.example.com",
  },
];

/** 記事数 */
const ARTICLE_COUNT = SEED_ARTICLES.length;

/** 後方互換: 動的生成されたダミー URL (上書き対象) */
const LEGACY_FOLLOWEE_ARTICLE_URL_PREFIX = "https://seed.techclip.app/followee-maestro/article-";

/** 記事ソース（LEGACY URL 用） */
const LEGACY_SEED_SOURCE = "seed.techclip.app";

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
  data: { title: string; source: string },
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
      .set({ ...data, updatedAt: now })
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

  await upsertAccount(db, followeeId, MAESTRO_STATIC_PASSWORD);
  await upsertAccount(db, followerId, MAESTRO_STATIC_PASSWORD);
  await upsertAccount(db, secondaryId, MAESTRO_STATIC_PASSWORD);
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

  await upsertFollow(db, followeeId, followerId);
  process.stdout.write("FOLLOWEE → FOLLOWER フォロー upsert 完了\n");

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
