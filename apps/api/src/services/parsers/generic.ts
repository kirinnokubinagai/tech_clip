import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, TECHCLIP_USER_AGENT } from "./_shared";

/** fetchタイムアウト（ミリ秒） */
const FETCH_TIMEOUT_MS = 10000;

/**
 * SSRF 対策: 内部ネットワーク・metadata サーバへの fetch を防ぐ
 * ホスト名が私設 IP 帯 or 予約名に該当する URL は拒否する
 */
const PRIVATE_HOST_PATTERNS: ReadonlyArray<RegExp> = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^metadata\.google\.internal$/i,
  /^metadata\.azure\.com$/i,
  /^\[::1\]$/,
  /^\[::\]$/,
  /^\[fc00:/i,
  /^\[fd/i,
  /^\[fe80:/i,
];

/**
 * URL が内部ネットワーク or メタデータサーバを指しているか判定する
 *
 * @param urlString - 判定対象の URL 文字列
 * @returns 内部ネットワークと判定した場合 true。parse 失敗や非 http(s) プロトコルも true
 */
function isPrivateHost(urlString: string): boolean {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    return true;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return true;
  }
  return PRIVATE_HOST_PATTERNS.some((p) => p.test(u.hostname));
}

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
  if (isPrivateHost(url)) {
    throw new Error("内部ネットワークへの fetch は許可されていません");
  }

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
  const markdown = turndown.turndown(article.content);

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
