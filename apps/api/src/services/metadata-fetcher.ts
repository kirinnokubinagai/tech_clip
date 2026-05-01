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

/** クラウドプロバイダのメタデータエンドポイント FQDN */
const METADATA_HOSTS = new Set<string>([
  "metadata.google.internal",
  "metadata.azure.com",
  "metadata.aws.amazon.com",
  "metadata.oraclecloud.com",
]);

/**
 * 内部 / プライベートネットワーク用の TLD・サフィックス
 * RFC 6762 (mDNS .local)、RFC 8375 (.home.arpa)、Kubernetes svc.cluster.local 等
 */
const INTERNAL_TLD_SUFFIXES = [
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".home.arpa",
  ".corp",
  ".private",
];

/**
 * IP リテラル判定 (IPv4 / IPv6 / 省略形 / 進数表記すべて拒否)
 */
function looksLikeIpLiteral(hostname: string): boolean {
  if (hostname.length === 0) return true;
  // IPv6: URL.hostname は IPv6 を `[...]` 付きで返す実装と剥がして返す実装がある
  if (hostname.includes(":")) return true;
  if (hostname.startsWith("[")) return true;
  // IPv4 dotted quad
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  // 数値のみ (10進整数IPv4表記 e.g. 2130706433)
  if (/^[0-9]+$/.test(hostname)) return true;
  // 16 進 (e.g. 0x7f000001)
  if (/^0x[0-9a-fA-F]+$/i.test(hostname)) return true;
  // ドット区切り 1〜4 個でかつ各セグメントが純数値 / 16 進 (省略形 IPv4 e.g. 127.1)
  const parts = hostname.split(".");
  if (
    parts.length >= 1 &&
    parts.length <= 4 &&
    parts.every((p) => /^[0-9]+$/.test(p) || /^0x[0-9a-fA-F]+$/i.test(p))
  ) {
    return true;
  }
  return false;
}

/**
 * 安全な fetch 対象 URL かを判定する
 *
 * - http/https のみ許可
 * - hostname が IP リテラル (IPv4/IPv6/省略・進数表記) は拒否
 * - 単一ラベル hostname (例: localhost) は拒否
 * - 既知のクラウドメタデータ FQDN は拒否
 * - 内部用 TLD サフィックス (.local 等) は拒否
 *
 * @returns true なら拒否
 */
function isBlockedHost(urlString: string): boolean {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    return true;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return true;
  const host = u.hostname.toLowerCase();
  if (host.length === 0) return true;
  if (looksLikeIpLiteral(host)) return true;
  // 単一ラベル (`.` なし) は社内ホスト扱いで拒否
  if (!host.includes(".")) return true;
  if (METADATA_HOSTS.has(host)) return true;
  for (const suffix of INTERNAL_TLD_SUFFIXES) {
    if (host.endsWith(suffix)) return true;
  }
  return false;
}

/**
 * SSRF 対策付き fetch。redirect: "manual" でリダイレクト先も再検査する。
 *
 * @param url 取得対象 URL
 * @param maxRedirects 最大リダイレクト追跡回数（超えたら null）
 * @returns Response または null（拒否・上限超過時）
 */
async function safeFetch(url: string, maxRedirects = 3): Promise<Response | null> {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    if (isBlockedHost(current)) return null;
    const res = await fetch(current, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      try {
        current = new URL(loc, current).toString();
      } catch {
        return null;
      }
      continue;
    }
    return res;
  }
  return null;
}

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
  let source: ReturnType<typeof detectSource>;
  try {
    source = detectSource(url);
  } catch {
    source = "other";
  }

  if (isBlockedHost(url)) {
    return {
      title: url,
      author: null,
      content: "",
      excerpt: null,
      thumbnailUrl: null,
      publishedAt: null,
      readingTimeMinutes: 0,
      source,
    };
  }

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
    const response = await safeFetch(url);
    if (!response?.ok) {
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

  const title =
    firstNonEmpty(
      getMeta(document, 'meta[property="og:title"]'),
      getMeta(document, 'meta[name="twitter:title"]'),
      document.querySelector("title")?.textContent ?? null,
    ) ?? url;

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
