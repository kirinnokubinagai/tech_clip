import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, TECHCLIP_USER_AGENT } from "./_shared";

/** はてなブログの対応ドメインパターン */
const HATENA_DOMAIN_PATTERN = /\.(hatenablog\.com|hatenablog\.jp|hateblo\.jp)$/;

/**
 * linkedomのドキュメント型
 *
 * Cloudflare Workers環境にはDOM型が存在しないため、
 * linkedomが返すドキュメントオブジェクトの必要なインターフェースのみ定義する
 */
type LinkedomDocument = {
  querySelector: (
    selector: string,
  ) => { getAttribute: (name: string) => string | null; textContent: string | null } | null;
};

/**
 * URLがはてなブログのドメインかどうかを検証する
 *
 * @param hostname - 検証対象のホスト名
 * @returns はてなブログドメインの場合true
 */
function isHatenaDomain(hostname: string): boolean {
  return HATENA_DOMAIN_PATTERN.test(hostname);
}

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
 * HTMLからname属性のメタタグの値を取得する
 *
 * @param doc - linkedomのドキュメントオブジェクト
 * @param name - metaタグのname属性値
 * @returns メタタグのcontent値。存在しない場合はnull
 */
function getMetaNameContent(doc: LinkedomDocument, name: string): string | null {
  const meta = doc.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    return null;
  }
  return meta.getAttribute("content");
}

/**
 * はてなブログ記事URLからHTML取得 → Readability本文抽出 → Markdown変換するパーサー
 *
 * 対応ドメイン: *.hatenablog.com, *.hatenablog.jp, *.hateblo.jp
 *
 * @param url - はてなブログ記事のURL
 * @returns パースされた記事情報
 * @throws Error - URLがはてなブログでない、HTML取得失敗、本文抽出失敗の場合
 */
export async function parseHatena(url: string): Promise<ParsedArticle> {
  const parsed = new URL(url);

  if (!isHatenaDomain(parsed.hostname)) {
    throw new Error("はてなブログのURLではありません");
  }

  const response = await fetch(url, {
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`はてなブログ記事の取得に失敗しました（ステータス: ${response.status}）`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  const reader = new Readability(document);
  const article = reader.parse();

  if (!article?.content) {
    throw new Error("はてなブログ記事の本文の抽出に失敗しました");
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const markdown = turndown.turndown(article.content);

  const { document: originalDoc } = parseHTML(html);
  const doc = originalDoc as unknown as LinkedomDocument;
  const thumbnailUrl = getMetaContent(doc, "og:image");
  const author = getMetaNameContent(doc, "author") ?? getMetaContent(doc, "article:author");
  const publishedAt = getMetaContent(doc, "article:published_time");

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
