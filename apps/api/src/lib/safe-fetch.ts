import { createLogger } from "./logger";

const logger = createLogger("safe-fetch");

/** デフォルトのリダイレクト上限 */
const DEFAULT_MAX_REDIRECTS = 5;

/** SSRF ブロック時にスローされるエラー */
export class SsrfBlockedError extends Error {
  readonly url: string;
  readonly reason:
    | "non_http"
    | "non_default_port"
    | "private_ip"
    | "private_hostname"
    | "redirect_loop";

  constructor(url: string, reason: SsrfBlockedError["reason"]) {
    super(`SSRF ブロック: ${url} (${reason})`);
    this.name = "SsrfBlockedError";
    this.url = url;
    this.reason = reason;
  }
}

/**
 * IPv4 dotted-decimal を [o1, o2, o3, o4] に変換する
 * 失敗時は null を返す
 */
function parseIPv4(host: string): readonly [number, number, number, number] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const octets = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])] as const;
  if (octets.some((o) => o > 255)) return null;
  return octets;
}

/**
 * IPv4 が CIDR に含まれるか判定する
 * cidr は "a.b.c.d/prefix" 形式
 */
function isInIPv4Cidr(ip: readonly [number, number, number, number], cidr: string): boolean {
  const [addr, prefixStr] = cidr.split("/");
  const prefix = Number(prefixStr);
  const net = parseIPv4(addr);
  if (!net) return false;

  const ipNum = ((ip[0] << 24) | (ip[1] << 16) | (ip[2] << 8) | ip[3]) >>> 0;
  const netNum = ((net[0] << 24) | (net[1] << 16) | (net[2] << 8) | net[3]) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

  return (ipNum & mask) === (netNum & mask);
}

/** deny する IPv4 CIDR 一覧 */
const DENY_IPV4_CIDRS: readonly string[] = [
  "0.0.0.0/8", // unspecified / source
  "10.0.0.0/8", // RFC1918 private
  "100.64.0.0/10", // CGNAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local (AWS/GCP metadata)
  "172.16.0.0/12", // RFC1918 private
  "192.0.0.0/24", // IETF assignments
  "192.0.2.0/24", // TEST-NET-1
  "192.88.99.0/24", // 6to4 anycast
  "192.168.0.0/16", // RFC1918 private
  "198.18.0.0/15", // benchmark
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved (broadcast 含む)
];

/**
 * IPv4 が private/reserved かどうか判定する
 * true = deny (private/reserved), false = allow (public)
 */
function isPrivateIPv4(ip: readonly [number, number, number, number]): boolean {
  return DENY_IPV4_CIDRS.some((cidr) => isInIPv4Cidr(ip, cidr));
}

/**
 * IPv6 の圧縮表記を展開して 8 セグメントの数値配列に変換する
 * ホスト文字列は "[::1]" 形式（角括弧付き）または "::1" 形式
 * 失敗時は null を返す
 */
function parseIPv6(host: string): readonly number[] | null {
  // 角括弧を除去
  let raw = host;
  if (raw.startsWith("[") && raw.endsWith("]")) {
    raw = raw.slice(1, -1);
  }

  // :: を含む場合は展開が必要
  const sides = raw.split("::");
  if (sides.length > 2) return null; // :: が 2 つ以上はエラー

  let left: string[];
  let right: string[];

  if (sides.length === 2) {
    left = sides[0] ? sides[0].split(":") : [];
    right = sides[1] ? sides[1].split(":") : [];
  } else {
    left = raw.split(":");
    right = [];
  }

  // IPv4-mapped (::ffff:a.b.c.d) の処理 - right の最後の要素が IPv4 形式かチェック
  if (right.length > 0) {
    const lastRight = right[right.length - 1];
    const v4 = parseIPv4(lastRight);
    if (v4 !== null) {
      // IPv4 部分を 2 つの 16-bit セグメントに変換
      right = [
        ...right.slice(0, right.length - 1),
        ((v4[0] << 8) | v4[1]).toString(16),
        ((v4[2] << 8) | v4[3]).toString(16),
      ];
    }
  }

  const totalSegments = left.length + right.length;
  if (totalSegments > 8) return null;

  const zeros = new Array(8 - totalSegments).fill("0");
  const segments = [...left, ...zeros, ...right];

  const nums = segments.map((s) => {
    const n = Number.parseInt(s, 16);
    if (Number.isNaN(n) || n < 0 || n > 0xffff) return null;
    return n;
  });

  if (nums.some((n) => n === null)) return null;
  return nums as number[];
}

/**
 * IPv6 が private/reserved かどうか判定する
 * true = deny, false = allow (global unicast 2000::/3 のみ allow)
 */
function isPrivateIPv6(segs: readonly number[]): boolean {
  if (segs.length !== 8) return true;

  const first = segs[0];

  // global unicast 2000::/3: 上位 3 bit が 001 (0x2000 <= first <= 0x3fff)
  if ((first & 0xe000) === 0x2000) {
    // 2001:db8::/32 は documentation → deny
    if (first === 0x2001 && segs[1] === 0x0db8) return true;
    // 0100::/64 は discard prefix → deny
    if (first === 0x0100 && segs[1] === 0 && segs[2] === 0 && segs[3] === 0) return true;
    return false;
  }

  // ::ffff:0:0/96 (IPv4-mapped) → deny
  // segs[0..4] が 0, segs[5] が 0xffff
  if (
    segs[0] === 0 &&
    segs[1] === 0 &&
    segs[2] === 0 &&
    segs[3] === 0 &&
    segs[4] === 0 &&
    segs[5] === 0xffff
  ) {
    return true;
  }

  // それ以外はすべて deny (loopback, ULA, link-local, multicast, unspecified, etc.)
  return true;
}

/** hostname denylist（IP literal 以外でも明らかに internal なものを補助的に弾く） */
const PRIVATE_HOSTNAME_DENYLIST: readonly RegExp[] = [
  /^localhost$/i,
  /^metadata\.google\.internal$/i,
  /^metadata\.azure\.com$/i,
  /^.*\.internal$/i,
  /^.*\.local$/i,
  /^.*\.localhost$/i,
];

/**
 * URL のホストが「public な fetch 先」として許可されるか判定する
 *
 * 判定ロジック (whitelist 方式):
 * 1. URL parse 失敗 / プロトコルが http(s) 以外 → false
 * 2. デフォルト以外のポート (80/443 以外) → false
 * 3. ホストが IP literal の場合:
 *    - IPv4: public 範囲のみ true
 *    - IPv6: global unicast (2000::/3) のみ true
 * 4. ホスト名の場合:
 *    - PRIVATE_HOSTNAME_DENYLIST にマッチしたら false
 *    - それ以外は true
 */
export function isPublicHost(urlString: string): boolean {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return false;
  }

  // ポートチェック
  const port = u.port;
  if (port !== "" && port !== "80" && port !== "443") {
    return false;
  }

  const hostname = u.hostname;

  // IPv6 literal (角括弧付き)
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const segs = parseIPv6(hostname);
    if (!segs) return false;
    return !isPrivateIPv6(segs);
  }

  // IPv4 literal
  const v4 = parseIPv4(hostname);
  if (v4 !== null) {
    return !isPrivateIPv4(v4);
  }

  // ホスト名
  return !PRIVATE_HOSTNAME_DENYLIST.some((p) => p.test(hostname));
}

/**
 * SSRF 対策付き fetch ラッパー
 *
 * - リクエスト前に isPublicHost で URL を検証
 * - redirect: "manual" で fetch、3xx の Location を解決して再検証してから次ホップ
 * - maxRedirects 超過は SsrfBlockedError (reason=redirect_loop) を throw
 * - 違反は SsrfBlockedError を throw
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  options: { maxRedirects?: number } = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  /** URL が許可されているか検証し、違反時は SsrfBlockedError を throw する */
  function assertPublic(targetUrl: string): void {
    let u: URL;
    try {
      u = new URL(targetUrl);
    } catch {
      logger.warn("SSRF ブロック: 外部 fetch が拒否されました", {
        url: targetUrl,
        reason: "non_http",
      });
      throw new SsrfBlockedError(targetUrl, "non_http");
    }

    if (u.protocol !== "http:" && u.protocol !== "https:") {
      logger.warn("SSRF ブロック: 外部 fetch が拒否されました", {
        url: u.origin + u.pathname,
        reason: "non_http",
      });
      throw new SsrfBlockedError(targetUrl, "non_http");
    }

    const port = u.port;
    if (port !== "" && port !== "80" && port !== "443") {
      logger.warn("SSRF ブロック: 外部 fetch が拒否されました", {
        url: u.origin + u.pathname,
        reason: "non_default_port",
      });
      throw new SsrfBlockedError(targetUrl, "non_default_port");
    }

    const hostname = u.hostname;

    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      const segs = parseIPv6(hostname);
      if (!segs || isPrivateIPv6(segs)) {
        logger.warn("SSRF ブロック: 外部 fetch が拒否されました", {
          url: u.origin + u.pathname,
          reason: "private_ip",
        });
        throw new SsrfBlockedError(targetUrl, "private_ip");
      }
      return;
    }

    const v4 = parseIPv4(hostname);
    if (v4 !== null) {
      if (isPrivateIPv4(v4)) {
        logger.warn("SSRF ブロック: 外部 fetch が拒否されました", {
          url: u.origin + u.pathname,
          reason: "private_ip",
        });
        throw new SsrfBlockedError(targetUrl, "private_ip");
      }
      return;
    }

    if (PRIVATE_HOSTNAME_DENYLIST.some((p) => p.test(hostname))) {
      logger.warn("SSRF ブロック: 外部 fetch が拒否されました", {
        url: u.origin + u.pathname,
        reason: "private_hostname",
      });
      throw new SsrfBlockedError(targetUrl, "private_hostname");
    }
  }

  let currentUrl = url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (hop === maxRedirects) {
      logger.warn("SSRF ブロック: 外部 fetch が拒否されました", {
        url: currentUrl,
        reason: "redirect_loop",
      });
      throw new SsrfBlockedError(currentUrl, "redirect_loop");
    }

    assertPublic(currentUrl);

    const response = await fetch(currentUrl, { ...init, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location) {
        return response;
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return response;
  }

  // unreachable
  throw new SsrfBlockedError(currentUrl, "redirect_loop");
}
