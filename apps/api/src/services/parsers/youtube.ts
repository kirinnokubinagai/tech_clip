import type { ParsedArticleContent } from "../article-parser";

/** YouTube oEmbed APIエンドポイント */
const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";

/** YouTube URLパターン（watch, shorts, youtu.be） */
const YOUTUBE_URL_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=[\w-]+/,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
  /^https?:\/\/youtu\.be\/[\w-]+/,
];

/**
 * YouTube URLが有効か検証する
 *
 * @param url - 検証対象のURL
 * @returns 有効な YouTube URL かどうか
 */
export function isYoutubeUrl(url: string): boolean {
  return YOUTUBE_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * YouTube動画をoEmbed APIでパースする
 *
 * @param url - YouTube動画のURL
 * @returns パース済みコンテンツ
 * @throws Error - URL不正またはoEmbed API失敗時
 */
export async function parseYoutube(url: string): Promise<ParsedArticleContent> {
  if (!isYoutubeUrl(url)) {
    throw new Error("YouTubeのURLではありません");
  }

  const oembedUrl = `${OEMBED_ENDPOINT}?url=${encodeURIComponent(url)}&format=json`;
  const response = await fetch(oembedUrl);

  if (!response.ok) {
    throw new Error(`YouTube動画の取得に失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as {
    title: string;
    author_name: string;
    author_url: string;
    thumbnail_url: string;
  };

  return {
    title: data.title,
    content: null,
    excerpt: `${data.author_name}によるYouTube動画`,
    author: data.author_name,
    thumbnailUrl: data.thumbnail_url ?? null,
    publishedAt: null,
    readingTimeMinutes: null,
  };
}
