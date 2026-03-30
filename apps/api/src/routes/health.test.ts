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
      const body = await res.json();

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("ok");
      expect(body.data.db).toBe("ok");
      expect(typeof body.data.timestamp).toBe("string");
    });

    it("DB接続に失敗した場合に503とエラー情報を返すこと", async () => {
      // Arrange
      const pingFn = vi.fn().mockRejectedValue(new Error("DB接続エラー"));
      const route = createHealthRoute({ pingFn });
      const app = new Hono();
      app.route("/api", route);

      // Act
      const res = await app.request("/api/health");
      const body = await res.json();

      // Assert
      expect(res.status).toBe(HTTP_SERVICE_UNAVAILABLE);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(body.data.status).toBe("error");
      expect(body.data.db).toBe("error");
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
