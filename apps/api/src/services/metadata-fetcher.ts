/**
 * 軽量メタデータ fetcher
 *
 * URL から og:/twitter: メタタグのみを取得する。
 * Readability を使う重い parser と違って bot-blocking 対策の影響を受けにくく、
 * 失敗しても基本情報を確保できる。実本文表示は mobile 側の WebView に任せる。
 */
import { parseHTML } from "linkedom";

import type { ParsedArticle } from "./article-parser";
import { detectSource } from "./source-detector";

const USER_AGENT = "Mozilla/5.0 (compatible; TechClipBot/1.0; +https://techclip.app)";
const FETCH_TIMEOUT_MS = 10_000;
const READING_SPEED_CHARS_PER_MIN = 500;

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) {
      return v.trim();
    }
  }
  return null;
}

function getMeta(doc: ReturnType<typeof parseHTML>["document"], selector: string): string | null {
  const el = doc.querySelector(selector);
  if (!el) return null;
  return el.getAttribute("content");
}

/**
 * URL から og / twitter / title / description / author を取得する
 *
 * 失敗時（fetch 失敗・HTML 空・meta 無し）は URL のみから title を生成する。
 */
export async function fetchArticleMetadata(url: string): Promise<ParsedArticle> {
  const source = detectSource(url);
  const fallback: ParsedArticle = {
    title: url,
    author: null,
    content: "",
    excerpt: null,
    thumbnailUrl: null,
    publishedAt: null,
    readingTimeMinutes: 0,
    source,
  };

  let html = "";
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ...fallback, title: url };
    }
    html = await response.text();
  } catch {
    return fallback;
  }

  if (!html || html.length === 0) {
    return fallback;
  }

  const { document } = parseHTML(html);
  if (!document.documentElement) {
    return fallback;
  }

  const title = firstNonEmpty(
    getMeta(document, 'meta[property="og:title"]'),
    getMeta(document, 'meta[name="twitter:title"]'),
    document.querySelector("title")?.textContent ?? null,
    url,
  ) as string;

  const author = firstNonEmpty(
    getMeta(document, 'meta[name="author"]'),
    getMeta(document, 'meta[property="article:author"]'),
    getMeta(document, 'meta[name="twitter:creator"]'),
  );

  const description = firstNonEmpty(
    getMeta(document, 'meta[property="og:description"]'),
    getMeta(document, 'meta[name="description"]'),
    getMeta(document, 'meta[name="twitter:description"]'),
  );

  const thumbnailUrl = firstNonEmpty(
    getMeta(document, 'meta[property="og:image"]'),
    getMeta(document, 'meta[name="twitter:image"]'),
  );

  const publishedAt = firstNonEmpty(
    getMeta(document, 'meta[property="article:published_time"]'),
    getMeta(document, 'meta[name="publish_date"]'),
    getMeta(document, 'meta[itemprop="datePublished"]'),
  );

  // content は mobile 側 WebView で抽出するので空文字列
  // readingTime は description / title から概算
  const descLen = description?.length ?? title.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(descLen / READING_SPEED_CHARS_PER_MIN));

  return {
    title,
    author,
    content: "",
    excerpt: description,
    thumbnailUrl,
    publishedAt,
    readingTimeMinutes,
    source,
  };
}
