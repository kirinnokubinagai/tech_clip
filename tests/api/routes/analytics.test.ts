import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../apps/api/src/db";
import { createAnalyticsRoute } from "../../../apps/api/src/routes/analytics";

/** テスト用ユーザー */
const TEST_USER = { id: "user-123", email: "test@example.com" };

/**
 * db.insert(table).values(data).returning() のモックを生成する
 */
function createMockDb(returnValue: Record<string, unknown> = {}) {
  const returningFn = vi.fn().mockResolvedValue([returnValue]);
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn });

  return { insert: insertFn, _values: valuesFn, _returning: returningFn } as unknown as Database;
}

/**
 * テスト用Honoアプリを生成する
 */
function createTestApp(db: Database, user?: Record<string, unknown>) {
  const route = createAnalyticsRoute({ db });
  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  if (user) {
    app.use("*", async (c, next) => {
      c.set("user", user);
      await next();
    });
  }

  app.route("/analytics", route);
  return app;
}

describe("createAnalyticsRoute", () => {
  describe("POST /events", () => {
    it("有効なイベントを送信して201を返すこと", async () => {
      // Arrange
      const mockReturn = {
        id: "test-id",
        userId: TEST_USER.id,
        event: "article_view",
        properties: "{}",
        createdAt: "2026-01-01",
      };
      const db = createMockDb(mockReturn);
      const app = createTestApp(db, TEST_USER);

      // Act
      const response = await app.request("/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "article_view", properties: { articleId: "art-001" } }),
      });

      // Assert
      expect(response.status).toBe(201);
      const body = (await response.json()) as { success: boolean; data: { id: string } };
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("test-id");
    });

    it("未認証の場合401を返すこと", async () => {
      // Arrange
      const db = createMockDb();
      const app = createTestApp(db);

      // Act
      const response = await app.request("/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "article_view", properties: {} }),
      });

      // Assert
      expect(response.status).toBe(401);
    });

    it("イベント名が空の場合422を返すこと", async () => {
      // Arrange
      const db = createMockDb();
      const app = createTestApp(db, TEST_USER);

      // Act
      const response = await app.request("/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "", properties: {} }),
      });

      // Assert
      expect(response.status).toBe(422);
    });

    it("propertiesが欠落している場合デフォルト空オブジェクトで201を返すこと", async () => {
      // Arrange
      const mockReturn = {
        id: "test-id",
        userId: TEST_USER.id,
        event: "article_view",
        properties: "{}",
        createdAt: "2026-01-01",
      };
      const db = createMockDb(mockReturn);
      const app = createTestApp(db, TEST_USER);

      // Act
      const response = await app.request("/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "article_view" }),
      });

      // Assert
      expect(response.status).toBe(201);
    });

    it("eventフィールドが欠落している場合422を返すこと", async () => {
      // Arrange
      const db = createMockDb();
      const app = createTestApp(db, TEST_USER);

      // Act
      const response = await app.request("/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties: { key: "value" } }),
      });

      // Assert
      expect(response.status).toBe(422);
    });

    it("不正なJSONの場合422を返すこと", async () => {
      // Arrange
      const db = createMockDb();
      const app = createTestApp(db, TEST_USER);

      // Act
      const response = await app.request("/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json",
      });

      // Assert
      expect(response.status).toBe(422);
    });

    it("insertが呼ばれること", async () => {
      // Arrange
      const mockReturn = {
        id: "test-id",
        userId: TEST_USER.id,
        event: "search",
        properties: "{}",
        createdAt: "2026-01-01",
      };
      const db = createMockDb(mockReturn);
      const app = createTestApp(db, TEST_USER);

      // Act
      await app.request("/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "search", properties: { query: "react" } }),
      });

      // Assert
      expect((db as unknown as Record<string, unknown>).insert).toHaveBeenCalled();
    });
  });
});
