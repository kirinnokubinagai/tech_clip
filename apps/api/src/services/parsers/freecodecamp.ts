import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

import { safeFetch } from "../../lib/safe-fetch";
import type { ParsedArticle } from "../../types/article";
import {
  assertHtmlSize,
  calculateReadingTime,
  htmlFragmentToMarkdown,
  TECHCLIP_USER_AGENT,
} from "./_shared";

/** freeCodeCampのホスト名 */
const FREECODECAMP_HOSTNAME = "freecodecamp.org";

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
 * URLがfreeCodeCampのドメインかどうかを検証する
 *
 * @param hostname - 検証対象のホスト名
 * @returns freeCodeCampドメインの場合true
 */
function isFreecodecampDomain(hostname: string): boolean {
  return hostname === FREECODECAMP_HOSTNAME || hostname.endsWith(`.${FREECODECAMP_HOSTNAME}`);
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
 * freeCodeCamp記事URLからHTML取得 → Readability本文抽出 → Markdown変換するパーサー
 *
 * 対応ドメイン: freecodecamp.org, www.freecodecamp.org
 *
 * @param url - freeCodeCamp記事のURL
 * @returns パースされた記事情報
 * @throws Error - URLがfreeCodeCampでない、HTML取得失敗、本文抽出失敗の場合
 */
export async function parseFreecodecamp(url: string): Promise<ParsedArticle> {
  const parsed = new URL(url);

  if (!isFreecodecampDomain(parsed.hostname)) {
    throw new Error("freeCodeCampのURLではありません");
  }

  const response = await safeFetch(url, {
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`freeCodeCamp記事の取得に失敗しました（ステータス: ${response.status}）`);
  }

  const html = await response.text();
  assertHtmlSize(html);
  const { document } = parseHTML(html);
  if (!document.documentElement) {
    throw new Error("HTMLが空または不正です（Cloudflare等のbot対策の可能性）");
  }

  const reader = new Readability(document);
  const article = reader.parse();

  if (!article?.content) {
    throw new Error("freeCodeCamp記事の本文の抽出に失敗しました");
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const markdown = htmlFragmentToMarkdown(article.content, turndown);

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
