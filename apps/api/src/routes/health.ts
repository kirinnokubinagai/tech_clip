import { Hono } from "hono";

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 503 Service Unavailable ステータスコード */
const HTTP_SERVICE_UNAVAILABLE = 503;

/** サービス停止エラーコード */
const SERVICE_UNAVAILABLE_CODE = "SERVICE_UNAVAILABLE";

/** サービス停止エラーメッセージ */
const SERVICE_UNAVAILABLE_MESSAGE = "データベースに接続できません";

/** createHealthRoute のオプション */
type HealthRouteOptions = {
  /** DB疎通確認関数 */
  pingFn: () => Promise<void>;
};

/**
 * ヘルスチェックルートを生成する
 *
 * GET /health: サーバーおよびDB接続の正常性を確認する
 *
 * @param options - DB疎通確認関数
 * @returns Hono ルーターインスタンス
 */
export function createHealthRoute(options: HealthRouteOptions) {
  const { pingFn } = options;
  const route = new Hono();

  route.get("/health", async (c) => {
    const timestamp = new Date().toISOString();

    try {
      await pingFn();

      return c.json(
        {
          success: true,
          data: {
            status: "ok",
            db: "ok",
            timestamp,
          },
        },
        HTTP_OK,
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: SERVICE_UNAVAILABLE_CODE,
            message: SERVICE_UNAVAILABLE_MESSAGE,
          },
          data: {
            status: "error",
            db: "error",
            timestamp,
          },
        },
        HTTP_SERVICE_UNAVAILABLE,
      );
    }
  });

  return route;
}
