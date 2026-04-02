import type { MiddlewareHandler } from "hono";

/**
 * セキュリティヘッダーミドルウェア
 *
 * すべてのレスポンスにセキュリティ関連のHTTPヘッダーを付与する。
 * HSTSは本番環境（ENVIRONMENT=production）のみ有効。
 * X-XSS-Protection は廃止済みのため削除し、CSPで代替する。
 */
export const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header(
    "Content-Security-Policy",
    "default-src 'none'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  );
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (c.env?.ENVIRONMENT === "production") {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
};
