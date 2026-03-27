import type { MiddlewareHandler } from "hono";

/**
 * セキュリティヘッダーミドルウェア
 *
 * すべてのレスポンスにセキュリティ関連のHTTPヘッダーを付与する。
 * HSTSは本番環境（ENVIRONMENT=production）のみ有効。
 */
export const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (c.env?.ENVIRONMENT === "production") {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
};
