import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createHealthRoute } from "./health";

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 503 Service Unavailable ステータスコード */
const HTTP_SERVICE_UNAVAILABLE = 503;

describe("createHealthRoute", () => {
  describe("GET /health", () => {
    it("DBが正常な場合に200とステータス情報を返すこと", async () => {
      // Arrange
      const pingFn = vi.fn().mockResolvedValue(undefined);
      const route = createHealthRoute({ pingFn });
      const app = new Hono();
      app.route("/api", route);

      // Act
      const res = await app.request("/api/health");
      const body = (await res.json()) as Record<string, unknown>;
      const data = body.data as Record<string, unknown>;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(data.status).toBe("ok");
      expect(data.db).toBe("ok");
      expect(typeof data.timestamp).toBe("string");
    });

    it("DB接続に失敗した場合に503とエラー情報を返すこと", async () => {
      // Arrange
      const pingFn = vi.fn().mockRejectedValue(new Error("DB接続エラー"));
      const route = createHealthRoute({ pingFn });
      const app = new Hono();
      app.route("/api", route);

      // Act
      const res = await app.request("/api/health");
      const body = (await res.json()) as Record<string, unknown>;
      const data = body.data as Record<string, unknown>;
      const error = body.error as Record<string, unknown> | undefined;

      // Assert
      expect(res.status).toBe(HTTP_SERVICE_UNAVAILABLE);
      expect(body.success).toBe(false);
      expect(error?.code).toBe("SERVICE_UNAVAILABLE");
      expect(data.status).toBe("error");
      expect(data.db).toBe("error");
    });

    it("DBチェックが実行されること", async () => {
      // Arrange
      const pingFn = vi.fn().mockResolvedValue(undefined);
      const route = createHealthRoute({ pingFn });
      const app = new Hono();
      app.route("/api", route);

      // Act
      await app.request("/api/health");

      // Assert
      expect(pingFn).toHaveBeenCalledOnce();
    });
  });
});
