import TurndownService from "turndown";

import type { ParsedArticle } from "../../types/article";

/** Zenn記事APIのベースURL */
const ZENN_API_BASE_URL = "https://zenn.dev/api/articles";

/** Zennのホスト名 */
const ZENN_HOSTNAME = "zenn.dev";

/** fetch時のUser-Agent */
const USER_AGENT = "Mozilla/5.0 (compatible; TechClipBot/1.0; +https://techclip.app)";

/** 読了速度（文字/分） */
const READING_SPEED_CHARS_PER_MIN = 500;

/** 最小読了時間（分） */
const MIN_READING_TIME_MINUTES = 1;

/** URLパス内のarticlesセグメントのインデックス */
const ARTICLES_SEGMENT_INDEX = 2;

/** slugセグメントのインデックス */
const SLUG_SEGMENT_INDEX = 3;

/**
 * Zenn APIレスポンスのユーザー情報
 */
type ZennUser = {
  username: string;
  name: string;
};

/**
 * Zenn APIレスポンスの記事情報
 */
type ZennArticle = {
  title: string;
  slug: string;
  published_at: string;
  body_html: string;
  emoji: string;
  article_type: string;
  user: ZennUser;
  og_image_url: string | null;
};

/**
 * Zenn APIレスポンス
 */
type ZennApiResponse = {
  article: ZennArticle;
};

/**
 * Zenn記事URLからslugを抽出する
 *
 * @param url - Zenn記事のURL（例: https://zenn.dev/user/articles/slug）
 * @returns 記事のslug
 * @throws Error - URLがZenn記事URLでない場合
 */
function extractSlug(url: string): string {
  const parsed = new URL(url);

  if (parsed.hostname !== ZENN_HOSTNAME) {
    throw new Error("ZennのURLではありません");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments[ARTICLES_SEGMENT_INDEX - 1] !== "articles") {
    throw new Error("Zenn記事のslugを抽出できません");
  }

  const slug = segments[SLUG_SEGMENT_INDEX - 1];

  if (!slug) {
    throw new Error("Zenn記事のslugを抽出できません");
  }

  return slug;
}

/**
 * 文字数から読了時間を計算する
 *
 * @param text - 本文テキスト
 * @returns 推定読了時間（分、最小1分）
 */
function calculateReadingTime(text: string): number {
  const charCount = text.length;
  const minutes = Math.ceil(charCount / READING_SPEED_CHARS_PER_MIN);
  return Math.max(minutes, MIN_READING_TIME_MINUTES);
}

/**
 * HTMLタグを除去してプレーンテキストを取得する
 *
 * @param html - HTMLコンテンツ
 * @returns タグを除去したテキスト
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Zenn記事URLからZenn APIでコンテンツを取得してParsedArticleに変換する
 *
 * @param url - Zenn記事のURL（例: https://zenn.dev/user/articles/slug）
 * @returns パースされた記事情報
 * @throws Error - URLの解析、API取得、またはパースに失敗した場合
 */
export async function parseZenn(url: string): Promise<ParsedArticle> {
  const slug = extractSlug(url);

  const apiUrl = `${ZENN_API_BASE_URL}/${slug}`;
  const response = await fetch(apiUrl, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Zenn記事の取得に失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as ZennApiResponse;
  const article = data.article;

  if (!article.body_html) {
    throw new Error("Zenn記事の本文が空です");
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const markdown = turndown.turndown(article.body_html);

  const plainText = stripHtmlTags(article.body_html);

  return {
    title: article.title,
    author: article.user.username,
    content: markdown,
    excerpt: null,
    thumbnailUrl: article.og_image_url ?? null,
    readingTimeMinutes: calculateReadingTime(plainText),
    publishedAt: article.published_at,
    source: ZENN_HOSTNAME,
  };
}
