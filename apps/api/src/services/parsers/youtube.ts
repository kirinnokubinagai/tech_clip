import { z } from "zod";

import type { ParsedArticleContent } from "../article-parser";
import { createExcerpt, TECHCLIP_USER_AGENT } from "./_shared";

/** YouTube oEmbed APIエンドポイント */
const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";

/** oEmbed APIのタイムアウト（ミリ秒） */
const FETCH_TIMEOUT_MS = 10_000;

/** YouTube の有効なホスト名一覧 */
const YOUTUBE_HOSTNAMES = ["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"] as const;

/** YouTube oEmbed APIレスポンスのZodスキーマ */
const OEmbedResponseSchema = z.object({
  title: z.string(),
  author_name: z.string(),
  author_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
});

/**
 * URLがYouTubeのものか検証する
 *
 * @param url - 検証対象のURL
 * @throws Error - YouTubeのURLではない場合
 */
function validateYoutubeUrl(url: string): void {
  const parsed = new URL(url);
  const isYoutube = (YOUTUBE_HOSTNAMES as ReadonlyArray<string>).includes(parsed.hostname);
  if (!isYoutube) {
    throw new Error("YouTubeのURLではありません");
  }
}

/**
 * YouTube動画の抜粋テキストを生成する
 *
 * @param authorName - チャンネル名
 * @param title - 動画タイトル
 * @returns 抜粋テキスト
 */
function buildYoutubeExcerpt(authorName: string, title: string): string {
  return createExcerpt(`${authorName}によるYouTube動画「${title}」`);
}

/**
 * YouTube動画をoEmbed APIでパースする
 *
 * source-detector が "youtube" と判定したURLに対して呼び出される。
 *
 * @param url - YouTube動画のURL
 * @returns パース済みコンテンツ
 * @throws Error - URLの検証失敗時またはoEmbed API失敗時
 */
export async function parseYoutube(url: string): Promise<ParsedArticleContent> {
  validateYoutubeUrl(url);

  const oembedUrl = `${OEMBED_ENDPOINT}?url=${encodeURIComponent(url)}&format=json`;
  const response = await fetch(oembedUrl, {
    headers: {
      "User-Agent": TECHCLIP_USER_AGENT,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`YouTube動画の取得に失敗しました（ステータス: ${response.status}）`);
  }

  const raw: unknown = await response.json();
  const parsed = OEmbedResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("YouTube動画のメタデータが不正です");
  }

  const data = parsed.data;

  return {
    title: data.title,
    content: null,
    excerpt: buildYoutubeExcerpt(data.author_name, data.title),
    author: data.author_name,
    thumbnailUrl: data.thumbnail_url ?? null,
    publishedAt: null,
    readingTimeMinutes: null,
  };
}
