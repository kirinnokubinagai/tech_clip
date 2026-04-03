declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  exit: (code: number) => never;
};

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  articles,
  articleTags,
  follows,
  notifications,
  summaries,
  tags,
  translations,
  users,
} from "./schema";

/** シードで作成するユーザー数 */
const SEED_USER_COUNT = 5;

/** ユーザーあたりの記事数（最小） */
const ARTICLES_PER_USER_MIN = 10;

/** ユーザーあたりの記事数（最大） */
const ARTICLES_PER_USER_MAX = 30;

/** ユーザーあたりのタグ数 */
const TAGS_PER_USER = 5;

/** AIモデル名（seedデータ用） */
const SEED_AI_MODEL = "qwen-3.5-9b";

/** 記事ソース一覧 */
const ARTICLE_SOURCES = [
  "zenn.dev",
  "qiita.com",
  "note.com",
  "medium.com",
  "dev.to",
  "github.com",
  "tech.example.com",
] as const;

/** タグ名一覧 */
const TAG_NAMES = [
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "Go",
  "Rust",
  "Docker",
  "Kubernetes",
  "AWS",
  "GCP",
  "機械学習",
  "デザイン",
  "セキュリティ",
  "パフォーマンス",
  "テスト",
] as const;

/** 通知タイプ一覧 */
const NOTIFICATION_TYPES = ["new_follower", "article_liked", "system_update"] as const;

/**
 * テスト用ユーザーデータを生成する
 *
 * @param index - ユーザーインデックス（0始まり）
 * @returns 挿入用ユーザーデータ
 */
export function buildUserData(index: number) {
  return {
    id: crypto.randomUUID(),
    email: `seed-user-${index}@example.com`,
    name: `シードユーザー${index}`,
    username: `seed_user_${index}`,
    bio: `これはシードデータのユーザー${index}です。`,
    emailVerified: true,
    isProfilePublic: true,
    preferredLanguage: "ja",
    isPremium: index === 0,
    freeAiUsesRemaining: 5,
  };
}

/**
 * テスト用記事データを生成する
 *
 * @param userId - 記事の所有者ユーザーID
 * @param index - 記事インデックス（0始まり）
 * @returns 挿入用記事データ
 */
export function buildArticleData(userId: string, index: number) {
  const source = ARTICLE_SOURCES[index % ARTICLE_SOURCES.length];
  const now = new Date();
  const createdAt = new Date(now.getTime() - index * 24 * 60 * 60 * 1000);

  return {
    id: crypto.randomUUID(),
    userId,
    url: `https://${source}/articles/seed-article-${userId.slice(0, 8)}-${index}`,
    source,
    title: `シード記事 ${index}: ${source}の技術記事`,
    author: `著者${index}`,
    excerpt: `これはシードデータの記事${index}の概要です。テスト用のデータです。`,
    content: `# シード記事 ${index}\n\nこれはシードデータの記事本文です。\n\n## セクション1\n\nコンテンツがここに入ります。`,
    readingTimeMinutes: (index % 15) + 3,
    isRead: index % 3 === 0,
    isFavorite: index % 5 === 0,
    isPublic: index % 2 === 0,
    publishedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * テスト用タグデータを生成する
 *
 * @param userId - タグの所有者ユーザーID
 * @param index - タグインデックス（0始まり）
 * @returns 挿入用タグデータ
 */
export function buildTagData(userId: string, index: number) {
  return {
    id: crypto.randomUUID(),
    userId,
    name: TAG_NAMES[index % TAG_NAMES.length],
    createdAt: new Date(),
  };
}

/**
 * テスト用サマリーデータを生成する
 *
 * @param articleId - 対象記事ID
 * @returns 挿入用サマリーデータ
 */
export function buildSummaryData(articleId: string) {
  return {
    id: crypto.randomUUID(),
    articleId,
    language: "ja",
    summary:
      "これはAIが生成したシードデータの要約です。記事の主要なポイントをまとめています。技術的な内容を分かりやすく説明しています。",
    model: SEED_AI_MODEL,
    createdAt: new Date(),
  };
}

/**
 * テスト用翻訳データを生成する
 *
 * @param articleId - 対象記事ID
 * @returns 挿入用翻訳データ
 */
export function buildTranslationData(articleId: string) {
  return {
    id: crypto.randomUUID(),
    articleId,
    targetLanguage: "en",
    translatedTitle: "Seed Article: Technical Content",
    translatedContent:
      "This is an AI-generated translation for seed data. The article covers technical topics in an easy-to-understand manner.",
    model: SEED_AI_MODEL,
    createdAt: new Date(),
  };
}

/**
 * テスト用フォローデータを生成する
 *
 * @param followerId - フォロワーのユーザーID
 * @param followingId - フォロー対象のユーザーID
 * @returns 挿入用フォローデータ
 */
export function buildFollowData(followerId: string, followingId: string) {
  return {
    followerId,
    followingId,
  };
}

/**
 * テスト用通知データを生成する
 *
 * @param userId - 通知先ユーザーID
 * @param index - 通知インデックス（0始まり）
 * @returns 挿入用通知データ
 */
export function buildNotificationData(userId: string, index: number) {
  const type = NOTIFICATION_TYPES[index % NOTIFICATION_TYPES.length];
  const titles: Record<string, string> = {
    new_follower: "新しいフォロワーがいます",
    article_liked: "記事にいいねがつきました",
    system_update: "システムのお知らせ",
  };
  const bodies: Record<string, string> = {
    new_follower: "シードユーザーがあなたをフォローしました。",
    article_liked: "あなたの記事が高評価を受けました。",
    system_update: "TechClipがアップデートされました。新機能をお試しください。",
  };

  return {
    id: crypto.randomUUID(),
    userId,
    type,
    title: titles[type],
    body: bodies[type],
    isRead: index % 2 === 0,
  };
}

/**
 * DBをシードデータで初期化する（冪等）
 *
 * 既存のシードユーザーが存在する場合はスキップする。
 * TURSO_DATABASE_URL と TURSO_AUTH_TOKEN 環境変数が必要。
 */
async function seed() {
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

  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) {
    process.stdout.write("シードユーザーが既に存在します。スキップします。\n");
    client.close();
    return;
  }

  process.stdout.write("シードデータの挿入を開始します...\n");

  const seedUsers = Array.from({ length: SEED_USER_COUNT }, (_, i) => buildUserData(i));
  await db.insert(users).values(seedUsers);
  process.stdout.write(`ユーザー ${SEED_USER_COUNT} 件を挿入しました\n`);

  for (const user of seedUsers) {
    const articleCount =
      ARTICLES_PER_USER_MIN +
      Math.floor(Math.random() * (ARTICLES_PER_USER_MAX - ARTICLES_PER_USER_MIN + 1));
    const seedArticles = Array.from({ length: articleCount }, (_, i) =>
      buildArticleData(user.id, i),
    );
    await db.insert(articles).values(seedArticles);

    const seedTags = Array.from({ length: TAGS_PER_USER }, (_, i) => buildTagData(user.id, i));
    await db.insert(tags).values(seedTags);

    for (const article of seedArticles) {
      await db.insert(summaries).values(buildSummaryData(article.id));
      await db.insert(translations).values(buildTranslationData(article.id));

      const tagForArticle = seedTags[0];
      await db.insert(articleTags).values({
        articleId: article.id,
        tagId: tagForArticle.id,
      });
    }

    const seedNotifications = Array.from({ length: 3 }, (_, i) =>
      buildNotificationData(user.id, i),
    );
    await db.insert(notifications).values(seedNotifications);

    process.stdout.write(`ユーザー ${user.username} のデータを挿入しました\n`);
  }

  for (let i = 0; i < seedUsers.length; i++) {
    for (let j = 0; j < seedUsers.length; j++) {
      if (i === j) continue;
      if (i === 0 || j === 0) {
        await db.insert(follows).values(buildFollowData(seedUsers[i].id, seedUsers[j].id));
      }
    }
  }
  process.stdout.write("フォロー関係を挿入しました\n");

  process.stdout.write("シードデータの挿入が完了しました\n");
  client.close();
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("seed.ts") || process.argv[1].endsWith("seed.js"));

if (isMain) {
  seed().catch((error: unknown) => {
    process.stderr.write(`シードエラー: ${String(error)}\n`);
    process.exit(1);
  });
}
