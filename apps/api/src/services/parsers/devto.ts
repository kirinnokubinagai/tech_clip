import TurndownService from "turndown";

import { safeFetch } from "../../lib/safe-fetch";
import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, htmlFragmentToMarkdown, TECHCLIP_USER_AGENT } from "./_shared";

/** Dev.toのホスト名 */
const DEVTO_HOSTNAME = "dev.to";

/** Dev.to API ベースURL */
const DEVTO_API_BASE_URL = "https://dev.to/api/articles";

/** URLパス内のusernameセグメントのインデックス */
const USERNAME_SEGMENT_INDEX = 0;

/** URLパス内のslugセグメントのインデックス */
const SLUG_SEGMENT_INDEX = 1;

/** パスセグメントの最小数（username + slug） */
const MIN_PATH_SEGMENTS = 2;

/**
 * Dev.to APIレスポンスのユーザー情報
 */
type DevtoUser = {
  username: string;
  name: string;
};

/**
 * Dev.to APIレスポンスの記事情報
 */
type DevtoApiResponse = {
  id: number;
  title: string;
  description: string;
  body_markdown: string | null;
  body_html: string;
  user: DevtoUser;
  published_at: string;
  cover_image: string | null;
  tag_list: string[];
  url: string;
};

/**
 * Dev.to記事URLからusernameとslugを抽出する
 *
 * @param url - Dev.to記事のURL（例: https://dev.to/username/slug-abc1）
 * @returns usernameとslugのタプル
 * @throws Error - URLがDev.to記事URLでない場合
 */
function extractUsernameAndSlug(url: string): [string, string] {
  const parsed = new URL(url);

  if (parsed.hostname !== DEVTO_HOSTNAME) {
    throw new Error("Dev.toのURLではありません");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments.length < MIN_PATH_SEGMENTS) {
    throw new Error("Dev.toのURLからusernameとslugを抽出できません");
  }

  const username = segments[USERNAME_SEGMENT_INDEX];
  const slug = segments[SLUG_SEGMENT_INDEX];

  if (!username || !slug) {
    throw new Error("Dev.toのURLからusernameとslugを抽出できません");
  }

  return [username, slug];
}

/**
 * Dev.to記事URLからDev.to APIでコンテンツを取得してParsedArticleに変換する
 *
 * @param url - Dev.to記事のURL（例: https://dev.to/username/slug-abc1）
 * @returns パースされた記事情報
 * @throws Error - URLの解析、API取得、またはパースに失敗した場合
 */
export async function parseDevto(url: string): Promise<ParsedArticle> {
  const [username, slug] = extractUsernameAndSlug(url);

  const apiUrl = `${DEVTO_API_BASE_URL}/${username}/${slug}`;
  const response = await safeFetch(apiUrl, {
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Dev.to APIからのデータ取得に失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as DevtoApiResponse;

  let content: string;
  if (data.body_markdown) {
    content = data.body_markdown;
  } else {
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });
    content = htmlFragmentToMarkdown(data.body_html, turndown);
  }

  const plainText = content.replace(/[#*`[\]()>\-_~|]/g, "").replace(/\n+/g, " ");

  return {
    title: data.title,
    author: data.user.username,
    content,
    excerpt: null,
    thumbnailUrl: data.cover_image ?? null,
    readingTimeMinutes: calculateReadingTime(plainText),
    publishedAt: data.published_at,
    source: DEVTO_HOSTNAME,
  };
}
