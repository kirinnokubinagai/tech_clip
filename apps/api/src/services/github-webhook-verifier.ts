import { createLogger } from "../lib/logger";

const logger = createLogger();

/** HMAC-SHA256 署名検証に使用するアルゴリズム */
const HMAC_ALGORITHM = "HMAC";

/** ダイジェストアルゴリズム */
const DIGEST_ALGORITHM = "SHA-256";

/** GitHub webhook 署名ヘッダーのプレフィックス */
const SIGNATURE_PREFIX = "sha256=";

/**
 * GitHub webhook の HMAC-SHA256 署名を検証する
 *
 * @param payload - リクエストボディの生テキスト
 * @param signature - X-Hub-Signature-256 ヘッダーの値
 * @param secret - webhook secret
 * @returns 検証成功なら true
 */
export async function verifyGitHubWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!signature.startsWith(SIGNATURE_PREFIX)) {
    logger.error("GitHub webhook 署名フォーマット不正", { signature: signature.slice(0, 20) });
    return false;
  }

  const expectedHex = signature.slice(SIGNATURE_PREFIX.length);

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: HMAC_ALGORITHM, hash: DIGEST_ALGORITHM },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign(HMAC_ALGORITHM, cryptoKey, payloadData);
    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return timingSafeEqual(computedHex, expectedHex);
  } catch (error) {
    logger.error("GitHub webhook 署名検証エラー", { error });
    return false;
  }
}

/**
 * タイミング攻撃を防ぐ定時間文字列比較
 *
 * @param a - 比較文字列 A
 * @param b - 比較文字列 B
 * @returns 一致する場合 true
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
