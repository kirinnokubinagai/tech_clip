import { safeFetch } from "../../lib/safe-fetch";
import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, createExcerpt, TECHCLIP_USER_AGENT } from "./_shared";

/** Reddit投稿URL判定パターン（www.reddit.com, old.reddit.com, reddit.com） */
const REDDIT_HOSTNAME_PATTERN = /^(www\.)?reddit\.com$|^old\.reddit\.com$/;

/** Reddit投稿パスの最小セグメント数（r/subreddit/comments/id） */
const MIN_POST_PATH_SEGMENTS = 4;

/** commentsセグメントのインデックス */
const COMMENTS_SEGMENT_INDEX = 2;

/** Reddit JSON APIのベースホスト */
const REDDIT_API_HOST = "www.reddit.com";

/** UNIXタイムスタンプをミリ秒に変換する係数 */
const SECONDS_TO_MS = 1000;

/** thumbnailとして無効な値（Redditが返す特殊文字列） */
const INVALID_THUMBNAIL_VALUES = new Set(["self", "default", "nsfw", "spoiler", ""]);

/**
 * Reddit JSON APIレスポンスの投稿データ
 */
type RedditPostData = {
  title: string;
  author: string;
  selftext: string;
  url: string;
  created_utc: number;
  thumbnail: string;
  subreddit: string;
  is_self: boolean;
};

/**
 * Reddit JSON APIレスポンスの構造
 */
type RedditApiResponse = {
  data: {
    children: Array<{
      data: RedditPostData;
    }>;
  };
};

/**
 * URLがReddit投稿URLかどうかを検証する
 *
 * @param parsed - パース済みURLオブジェクト
 * @throws Error - RedditのURLでない場合、または投稿URLの形式でない場合
 */
function validateRedditUrl(parsed: URL): void {
  if (!REDDIT_HOSTNAME_PATTERN.test(parsed.hostname)) {
    throw new Error("RedditのURLではありません");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments.length < MIN_POST_PATH_SEGMENTS || segments[COMMENTS_SEGMENT_INDEX] !== "comments") {
    throw new Error("Reddit投稿URLの形式が正しくありません");
  }
}

/**
 * Reddit投稿URLからJSON APIのURLを構築する
 *
 * old.reddit.comやreddit.comのURLもwww.reddit.comに正規化する。
 *
 * @param parsed - パース済みURLオブジェクト
 * @returns JSON APIのURL文字列
 */
function buildJsonApiUrl(parsed: URL): string {
  const pathname = parsed.pathname.endsWith("/")
    ? `${parsed.pathname}.json`
    : `${parsed.pathname}/.json`;

  return `https://${REDDIT_API_HOST}${pathname}`;
}

/**
 * thumbnailの値が有効なURLかどうかを判定する
 *
 * @param thumbnail - Redditが返すthumbnail値
 * @returns 有効なURLの場合はそのURL、無効な場合はnull
 */
function resolveThumbnailUrl(thumbnail: string): string | null {
  if (INVALID_THUMBNAIL_VALUES.has(thumbnail)) {
    return null;
  }
  return thumbnail;
}

/**
 * selftextからexcerptを生成する
 *
 * @param selftext - Reddit投稿のMarkdown本文
 * @returns excerptテキスト。selftextが空の場合はnull
 */
function generateExcerpt(selftext: string): string | null {
  if (!selftext) {
    return null;
  }

  const plainText = selftext
    .replace(/[#*`[\]()>\-_~|]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  return createExcerpt(plainText);
}

/**
 * Reddit投稿URLからReddit JSON APIでコンテンツを取得してParsedArticleに変換する
 *
 * selftext投稿（テキスト投稿）の場合はMarkdown本文を取得し、
 * 外部リンク投稿の場合はリンク先URLをコンテンツとして返す。
 * reddit.com / old.reddit.com 両方のURL形式に対応する。
 *
 * @param url - Reddit投稿のURL
 * @returns パースされた記事情報
 * @throws Error - URLの解析、API取得、またはパースに失敗した場合
 */
export async function parseReddit(url: string): Promise<ParsedArticle> {
  const parsed = new URL(url);
  validateRedditUrl(parsed);

  const apiUrl = buildJsonApiUrl(parsed);
  const response = await safeFetch(apiUrl, {
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Reddit APIからのデータ取得に失敗しました（ステータス: ${response.status}）`);
  }

  const json = (await response.json()) as RedditApiResponse[];
  const postData = json[0]?.data?.children[0]?.data;

  if (!postData) {
    throw new Error("Reddit投稿データの取得に失敗しました");
  }

  const isSelfPost = postData.is_self;
  const content = isSelfPost ? postData.selftext : postData.url;
  const plainText = isSelfPost
    ? postData.selftext.replace(/[#*`[\]()>\-_~|]/g, "").replace(/\n+/g, " ")
    : postData.title;

  return {
    title: postData.title,
    author: postData.author,
    content,
    excerpt: generateExcerpt(postData.selftext),
    thumbnailUrl: resolveThumbnailUrl(postData.thumbnail),
    readingTimeMinutes: calculateReadingTime(plainText),
    publishedAt: new Date(postData.created_utc * SECONDS_TO_MS).toISOString(),
    source: parsed.hostname,
  };
}
