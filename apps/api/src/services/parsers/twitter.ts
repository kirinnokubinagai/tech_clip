import { z } from "zod";

import type { ParsedArticleContent } from "../article-parser";
import { calculateReadingTime, EXCERPT_MAX_LENGTH, TECHCLIP_USER_AGENT } from "./_shared";

/** Twitter/X oEmbed APIエンドポイント */
const OEMBED_ENDPOINT = "https://publish.twitter.com/oembed";

/** Twitter/X URLパターン */
const TWITTER_URL_PATTERN = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/;

/** fetchタイムアウト（ミリ秒） */
const FETCH_TIMEOUT_MS = 10000;

/**
 * 既知のHTMLnamed entityマップ
 */
const NAMED_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  laquo: "\u00ab",
  raquo: "\u00bb",
  ldquo: "\u201c",
  rdquo: "\u201d",
  lsquo: "\u2018",
  rsquo: "\u2019",
  copy: "\u00a9",
  reg: "\u00ae",
  trade: "\u2122",
  euro: "\u20ac",
  pound: "\u00a3",
  yen: "\u00a5",
  cent: "\u00a2",
  times: "\u00d7",
  divide: "\u00f7",
};

/**
 * oEmbed APIレスポンスのZodスキーマ
 */
const OEmbedResponseSchema = z.object({
  html: z.string(),
  author_name: z.string(),
  author_url: z.string(),
  url: z.string(),
});

/** oEmbed APIレスポンスの型 */
type OEmbedResponse = z.infer<typeof OEmbedResponseSchema>;

/**
 * oEmbed HTMLからツイート本文を抽出する
 *
 * @param html - oEmbedが返すHTML文字列
 * @returns 抽出されたテキスト
 */
function extractTextFromOEmbed(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([\da-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITY_MAP[name] ?? match)
    .trim();
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
  const response = await fetch(oembedUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent": TECHCLIP_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`ツイートの取得に失敗しました（ステータス: ${response.status}）`);
  }

  const raw = await response.json();
  const parseResult = OEmbedResponseSchema.safeParse(raw);
  if (!parseResult.success) {
    throw new Error("oEmbed APIレスポンスの形式が不正です");
  }
  const data: OEmbedResponse = parseResult.data;
  const text = extractTextFromOEmbed(data.html);

  return {
    title: `${data.author_name}のポスト`,
    content: text,
    excerpt: text.length > EXCERPT_MAX_LENGTH ? `${text.slice(0, EXCERPT_MAX_LENGTH)}...` : text,
    author: data.author_name,
    thumbnailUrl: null,
    publishedAt: null,
    readingTimeMinutes: calculateReadingTime(text),
  };
}
