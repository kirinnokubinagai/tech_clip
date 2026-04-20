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
 * SSRF 対策: 内部ネットワーク・metadata サーバへの fetch を防ぐ
 * ホスト名が私設 IP 帯 or 予約名に該当する URL は拒否する
 */
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^metadata\.google\.internal$/i,
  /^metadata\.azure\.com$/i,
  /^\[::1\]$/,
  /^\[fc00:/i,
  /^\[fd/i,
  /^\[fe80:/i,
];

/**
 * ホスト名がプライベート/予約アドレスかどうかを判定する
 *
 * @param hostname - チェックするホスト名
 * @returns プライベートアドレスの場合 true
 */
function isPrivateHostname(hostname: string): boolean {
  return PRIVATE_HOST_PATTERNS.some((p) => p.test(hostname));
}

/** リダイレクトの最大ホップ数 */
const MAX_REDIRECT_HOPS = 5;

/**
 * SSRF 対策付きの fetch ラッパー
 *
 * `redirect: "manual"` で fetch し、3xx レスポンスの Location ヘッダーを取り出して
 * リダイレクト先のホストが isPrivateHostname に該当しないか検証しながら辿る。
 * MAX_REDIRECT_HOPS を超えた場合はエラーをスローする。
 *
 * @param initialUrl - 最初の fetch 先 URL
 * @param opts - fetch オプション（redirect は上書きされる）
 * @returns 最終的な fetch レスポンス
 * @throws Error - プライベート IP へのリダイレクト、ホップ数超過の場合
 */
async function safeFetch(initialUrl: string, opts: RequestInit = {}): Promise<Response> {
  let url = initialUrl;
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const parsed = new URL(url);
    if (isPrivateHostname(parsed.hostname)) {
      throw new Error("プライベート IP へのアクセスは許可されません");
    }
    const response = await fetch(url, { ...opts, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location) {
        return response;
      }
      url = new URL(location, url).toString();
      continue;
    }
    return response;
  }
  throw new Error("リダイレクト回数が上限を超えました");
}

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
 * SSRF 対策として、プライベート IP アドレスやメタデータサーバーへの
 * アクセスはブロックする。
 *
 * @param url - パース対象のURL
 * @returns パースされた記事情報
 * @throws Error - プライベートIPへのアクセス、HTMLの取得またはパースに失敗した場合
 */
export async function parseGeneric(url: string): Promise<ParsedArticle> {
  const parsedUrl = new URL(url);
  if (isPrivateHostname(parsedUrl.hostname)) {
    throw new Error("プライベート IP は許可されません");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await safeFetch(url, {
      headers: { "User-Agent": TECHCLIP_USER_AGENT },
      signal: controller.signal,
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
    source: parsedUrl.hostname,
  };
}
