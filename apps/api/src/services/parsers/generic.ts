import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, htmlFragmentToMarkdown, TECHCLIP_USER_AGENT } from "./_shared";

/** fetchタイムアウト（ミリ秒） */
const FETCH_TIMEOUT_MS = 10000;

/** ペイウォール検出セレクター */
const PAYWALL_SELECTORS = [
  "[class*='paywall']",
  "[id*='paywall']",
  ".meteredContent",
  "[class*='metered']",
  "[class*='subscriber-only']",
  "[class*='member-only']",
];

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
 * ペイウォールが存在するか検出する
 *
 * @param doc - linkedomのドキュメントオブジェクト
 * @returns ペイウォールが検出された場合true
 */
function detectPaywall(doc: LinkedomDocument): boolean {
  for (const selector of PAYWALL_SELECTORS) {
    if (doc.querySelector(selector)) {
      return true;
    }
  }
  return false;
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
 * 任意のURLからHTML取得 → 本文抽出 → Markdown変換する汎用パーサー
 *
 * @param url - パース対象のURL
 * @returns パースされた記事情報
 * @throws Error - HTMLの取得またはパースに失敗した場合
 */
export async function parseGeneric(url: string): Promise<ParsedArticle> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": TECHCLIP_USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`HTMLの取得に失敗しました（ステータス: ${response.status}）`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);

  const paywallDoc = document as unknown as LinkedomDocument;
  if (detectPaywall(paywallDoc)) {
    throw new Error("記事本文の抽出に失敗しました");
  }

  const reader = new Readability(document);
  const article = reader.parse();

  if (!article?.content) {
    throw new Error("記事本文の抽出に失敗しました");
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const markdown = htmlFragmentToMarkdown(article.content, turndown);

  const { document: originalDoc } = parseHTML(html);
  const doc = originalDoc as unknown as LinkedomDocument;
  const thumbnailUrl = getMetaContent(doc, "og:image");
  const author = getMetaContent(doc, "article:author");
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
