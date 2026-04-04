import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** ヘルスチェックレスポンスの型定義 */
type HealthResponse = {
  status: string;
  timestamp: string;
};

/**
 * テスト用のアプリを生成する
 *
 * @returns テスト用 Hono アプリ
 */
function createTestApp() {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

describe("GET /health", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  it("ステータス200とokを返すこと", async () => {
    // Arrange
    const req = new Request("http://localhost/health");

    // Act
    const res = await app.fetch(req);
    const body = (await res.json()) as HealthResponse;

    // Assert
    expect(res.status).toBe(HTTP_OK);
    expect(body.status).toBe("ok");
  });

  it("timestampがISO形式の文字列であること", async () => {
    // Arrange
    const req = new Request("http://localhost/health");

    // Act
    const res = await app.fetch(req);
    const body = (await res.json()) as HealthResponse;

    // Assert
    expect(body.timestamp).toBeDefined();
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
