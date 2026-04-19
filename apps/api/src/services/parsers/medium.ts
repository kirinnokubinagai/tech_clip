import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, TECHCLIP_USER_AGENT } from "./_shared";

/**
 * linkedomのドキュメント型
 *
 * Cloudflare Workers環境にはDOM型が存在しないため、
 * linkedomが返すドキュメントオブジェクトの必要なインターフェースのみ定義する
 */
type LinkedomDocument = {
  querySelector: (selector: string) => { getAttribute: (name: string) => string | null } | null;
};

/**
 * HTMLからOGPメタタグの値を取得する
 *
 * @param doc - linkedomのドキュメントオブジェクト
 * @param property - metaタグのproperty属性値
 * @returns メタタグのcontent値。存在しない場合はnull
 */
function getMetaContent(doc: LinkedomDocument, property: string): string | null {
  const meta = doc.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    return null;
  }
  return meta.getAttribute("content");
}

/**
 * HTMLからname属性ベースのメタタグの値を取得する
 *
 * @param doc - linkedomのドキュメントオブジェクト
 * @param name - metaタグのname属性値
 * @returns メタタグのcontent値。存在しない場合はnull
 */
function getMetaByName(doc: LinkedomDocument, name: string): string | null {
  const meta = doc.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    return null;
  }
  return meta.getAttribute("content");
}

/**
 * Medium記事URLからHTML取得 → Readabilityで本文抽出 → Markdown変換するパーサー
 *
 * medium.comおよびカスタムドメインの両方に対応する。
 * OGPメタタグからサムネイル・著者・公開日を取得する。
 *
 * @param url - Medium記事のURL
 * @returns パースされた記事情報
 * @throws Error - HTMLの取得またはパースに失敗した場合
 */
export async function parseMedium(url: string): Promise<ParsedArticle> {
  const response = await fetch(url, {
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`HTMLの取得に失敗しました（ステータス: ${response.status}）`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  const reader = new Readability(document);
  const article = reader.parse();

  if (!article?.content) {
    throw new Error("記事本文の抽出に失敗しました");
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const contentDoc = parseHTML(article.content);
  const markdown = turndown.turndown(contentDoc.document.documentElement);

  const { document: originalDoc } = parseHTML(html);
  const doc = originalDoc as unknown as LinkedomDocument;

  const thumbnailUrl = getMetaContent(doc, "og:image");
  const author = getMetaByName(doc, "author");
  const publishedAt = getMetaContent(doc, "article:published_time");

  const parsed = new URL(url);
  const title = article.title ?? "";
  const textContent = article.textContent ?? "";

  return {
    title,
    author,
    content: markdown,
    excerpt: article.excerpt ?? null,
    thumbnailUrl,
    readingTimeMinutes: calculateReadingTime(textContent),
    publishedAt,
    source: parsed.hostname,
  };
}
