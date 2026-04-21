/**
 * トークン生成・ハッシュ化のユーティリティ
 *
 * SHA-256 ハッシュとランダムトークン生成を共通化する。
 * Web Crypto API を使用するため Cloudflare Workers 環境でも動作する。
 */

/** リフレッシュトークンの文字数 */
const REFRESH_TOKEN_LENGTH = 48;

/**
 * トークン文字列を SHA-256 でハッシュ化する
 *
 * @param token - ハッシュ化するトークン文字列
 * @returns SHA-256 の16進数文字列（64文字）
 */
export async function hashTokenSha256(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * ランダムな16進数文字列を生成する
 *
 * @param lengthInChars - 生成する文字数（偶数）
 * @returns ランダムな16進数文字列
 */
export function generateRandomHexToken(lengthInChars: number): string {
  const bytes = new Uint8Array(lengthInChars / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * ランダムなリフレッシュトークン文字列を生成する
 *
 * @returns 48文字の16進数リフレッシュトークン
 */
export function generateRefreshToken(): string {
  return generateRandomHexToken(REFRESH_TOKEN_LENGTH);
}
