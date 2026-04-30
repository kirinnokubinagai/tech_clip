import TurndownService from "turndown";

import { safeFetch } from "../../lib/safe-fetch";
import type { ParsedArticle } from "../../types/article";
import {
  calculateReadingTime,
  htmlFragmentToMarkdown,
  MIN_READING_TIME_MINUTES,
  TECHCLIP_USER_AGENT,
} from "./_shared";
import { parseGeneric } from "./generic";

/** Hacker News Firebase APIのベースURL */
const HN_API_BASE_URL = "https://hacker-news.firebaseio.com/v0/item";

/** Hacker Newsのホスト名 */
const HN_HOSTNAME = "news.ycombinator.com";

/** ミリ秒変換係数 */
const UNIX_TO_MS_MULTIPLIER = 1000;

/**
 * Hacker News APIレスポンスの型定義
 */
type HackerNewsItem = {
  id: number;
  type: string;
  by?: string;
  time: number;
  title: string;
  url?: string;
  text?: string;
  score: number;
  descendants?: number;
};

/**
 * Hacker News URLからitem_idを抽出する
 *
 * @param url - Hacker NewsのURL（例: https://news.ycombinator.com/item?id=12345）
 * @returns item_id（文字列）
 * @throws Error - URLがHacker News形式でない、またはitem_idが抽出できない場合
 */
function extractItemId(url: string): string {
  const parsed = new URL(url);

  if (parsed.hostname !== HN_HOSTNAME) {
    throw new Error("Hacker NewsのURLではありません");
  }

  const itemId = parsed.searchParams.get("id");

  if (!itemId || !/^\d+$/.test(itemId)) {
    throw new Error("Hacker NewsのURLからitem_idを抽出できません");
  }

  return itemId;
}

/**
 * UNIXタイムスタンプをISO 8601文字列に変換する
 *
 * @param unixTime - UNIXタイムスタンプ（秒）
 * @returns ISO 8601形式の日時文字列
 */
function unixToIso(unixTime: number): string {
  return new Date(unixTime * UNIX_TO_MS_MULTIPLIER).toISOString();
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
 * Hacker News URLからHN API経由でアイテム情報を取得してParsedArticleに変換する
 *
 * 外部URL記事の場合はgenericパーサーにフォールバックし、HNのメタデータを優先する。
 * テキスト記事（Ask HN等）の場合はtextフィールドからMarkdownに変換する。
 *
 * @param url - Hacker NewsのURL（例: https://news.ycombinator.com/item?id=12345）
 * @returns パースされた記事情報
 * @throws Error - URLが不正、またはAPI取得に失敗した場合
 */
export async function parseHackerNews(url: string): Promise<ParsedArticle> {
  const itemId = extractItemId(url);

  const apiUrl = `${HN_API_BASE_URL}/${itemId}.json`;
  const response = await safeFetch(apiUrl, {
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Hacker Newsアイテムの取得に失敗しました（ステータス: ${response.status}）`);
  }

  const item = (await response.json()) as HackerNewsItem | null;

  if (!item) {
    throw new Error("Hacker Newsアイテムの取得に失敗しました（アイテムが存在しません）");
  }

  const author = item.by ?? null;
  const publishedAt = unixToIso(item.time);

  if (item.url) {
    return buildFromExternalUrl(item, author, publishedAt);
  }

  return buildFromText(item, author, publishedAt);
}

/**
 * 外部URL記事の場合、genericパーサーでコンテンツを取得する
 *
 * @param item - HN APIレスポンス
 * @param author - 投稿者名
 * @param publishedAt - 公開日
 * @returns パースされた記事情報
 */
async function buildFromExternalUrl(
  item: HackerNewsItem,
  author: string | null,
  publishedAt: string,
): Promise<ParsedArticle> {
  try {
    const genericResult = await parseGeneric(item.url as string);

    return {
      title: item.title,
      author,
      content: genericResult.content,
      excerpt: genericResult.excerpt,
      thumbnailUrl: genericResult.thumbnailUrl,
      readingTimeMinutes: genericResult.readingTimeMinutes,
      publishedAt,
      source: HN_HOSTNAME,
    };
  } catch {
    return {
      title: item.title,
      author,
      content: "",
      excerpt: null,
      thumbnailUrl: null,
      readingTimeMinutes: MIN_READING_TIME_MINUTES,
      publishedAt,
      source: HN_HOSTNAME,
    };
  }
}

/**
 * テキスト記事（Ask HN等）の場合、textフィールドからコンテンツを生成する
 *
 * @param item - HN APIレスポンス
 * @param author - 投稿者名
 * @param publishedAt - 公開日
 * @returns パースされた記事情報
 */
function buildFromText(
  item: HackerNewsItem,
  author: string | null,
  publishedAt: string,
): ParsedArticle {
  const htmlContent = item.text ?? "";

  let content = "";
  if (htmlContent) {
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });
    content = htmlFragmentToMarkdown(htmlContent, turndown);
  }

  const plainText = stripHtmlTags(htmlContent);

  return {
    title: item.title,
    author,
    content,
    excerpt: null,
    thumbnailUrl: null,
    readingTimeMinutes: calculateReadingTime(plainText),
    publishedAt,
    source: HN_HOSTNAME,
  };
}
