import { z } from "zod";

import type { ParsedArticleContent } from "../article-parser";
import { createExcerpt, TECHCLIP_USER_AGENT } from "./_shared";

/** YouTube oEmbed APIエンドポイント */
const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";

/** oEmbed APIのタイムアウト（ミリ秒） */
const FETCH_TIMEOUT_MS = 10_000;

/** YouTube oEmbed APIレスポンスのZodスキーマ */
const OEmbedResponseSchema = z.object({
  title: z.string(),
  author_name: z.string(),
  author_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

/**
 * YouTube動画をoEmbed APIでパースする
 *
 * source-detector が "youtube" と判定したURLに対して呼び出される。
 *
 * @param url - YouTube動画のURL
 * @returns パース済みコンテンツ
 * @throws Error - oEmbed API失敗時
 */
export async function parseYoutube(url: string): Promise<ParsedArticleContent> {
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

  const parsed = OEmbedResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("YouTube動画のメタデータが不正です");
  }

  const data = parsed.data;

  return {
    title: data.title,
    content: null,
    excerpt: createExcerpt(`${data.author_name}によるYouTube動画「${data.title}」`),
    author: data.author_name,
    thumbnailUrl: data.thumbnail_url ?? null,
    publishedAt: null,
    readingTimeMinutes: null,
  };
}
