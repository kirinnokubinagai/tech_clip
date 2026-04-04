import type { ParsedArticleContent } from "../article-parser";

/** Twitter/X oEmbed APIエンドポイント */
const OEMBED_ENDPOINT = "https://publish.twitter.com/oembed";

/** Twitter/X URLパターン */
const TWITTER_URL_PATTERN = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/;

/** 読了速度（文字/分） */
const READING_SPEED_CHARS_PER_MIN = 500;

/** 最小読了時間（分） */
const MIN_READING_TIME_MINUTES = 1;

/**
 * oEmbed APIレスポンスの型
 */
type OEmbedResponse = {
  html: string;
  author_name: string;
  author_url: string;
  url: string;
};

/**
 * oEmbed HTMLからツイート本文を抽出する
 *
 * @param html - oEmbedが返すHTML文字列
 * @returns 抽出されたテキスト
 */
function extractTextFromOEmbed(html: string): string {
  const withoutTags = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  return withoutTags;
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
 * Twitter/X URLが有効か検証する
 *
 * @param url - 検証対象のURL
 * @returns 有効な Twitter/X URL かどうか
 */
export function isTwitterUrl(url: string): boolean {
  return TWITTER_URL_PATTERN.test(url);
}

/**
 * Twitter/Xの投稿をoEmbed APIでパースする
 *
 * @param url - Twitter/X投稿のURL
 * @returns パース済みコンテンツ
 * @throws Error - URL不正またはoEmbed API失敗時
 */
export async function parseTwitter(url: string): Promise<ParsedArticleContent> {
  if (!isTwitterUrl(url)) {
    throw new Error("Twitter/XのURLではありません");
  }

  const oembedUrl = `${OEMBED_ENDPOINT}?url=${encodeURIComponent(url)}&omit_script=true`;
  const response = await fetch(oembedUrl);

  if (!response.ok) {
    throw new Error(`ツイートの取得に失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as OEmbedResponse;
  const text = extractTextFromOEmbed(data.html);

  return {
    title: `${data.author_name}のポスト`,
    content: text,
    excerpt: text.length > 200 ? `${text.slice(0, 200)}...` : text,
    author: data.author_name,
    thumbnailUrl: null,
    publishedAt: null,
    readingTimeMinutes: calculateReadingTime(text),
  };
}
