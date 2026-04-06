import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../db";
import { createHealthRoute } from "../routes/health";

/**
 * ヘルスチェックサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleHealth(db: Database, request: Request): Promise<Response> {
  const healthRoute = createHealthRoute({
    pingFn: async () => {
      await db.run(sql`SELECT 1`);
    },
  });

  const subApp = new Hono();
  subApp.route("/api", healthRoute);
  return subApp.fetch(request);
}
