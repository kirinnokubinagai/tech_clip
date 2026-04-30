import TurndownService from "turndown";

import { safeFetch } from "../../lib/safe-fetch";
import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, htmlFragmentToMarkdown, TECHCLIP_USER_AGENT } from "./_shared";

/** Zenn記事APIのベースURL */
const ZENN_API_BASE_URL = "https://zenn.dev/api/articles";

/** Zennのホスト名 */
const ZENN_HOSTNAME = "zenn.dev";

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
  const response = await safeFetch(apiUrl, {
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
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
  const markdown = htmlFragmentToMarkdown(article.body_html, turndown);

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
