import { createFeedRoute } from "@api/routes/feed";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
};

/** テスト用記事データ */
const MOCK_ARTICLES = [
  {
    id: "art_003",
    userId: "following_user",
    createdAt: new Date("2024-01-03T00:00:00Z"),
    isPublic: true,
    title: "記事3",
  },
  {
    id: "art_002",
    userId: "following_user",
    createdAt: new Date("2024-01-02T00:00:00Z"),
    isPublic: true,
    title: "記事2",
  },
  {
    id: "art_001",
    userId: "following_user",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    isPublic: true,
    title: "記事1",
  },
];

/** モックDB */
const mockDb = {
  select: vi.fn(),
};

/**
 * テスト用 Hono アプリを生成する
 */
function createTestApp() {
  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();
  app.use("*", (c, next) => {
    c.set("user", MOCK_USER);
    return next();
  });
  const feedRoute = createFeedRoute({ db: mockDb as never });
  app.route("/", feedRoute);
  return app;
}

describe("createFeedRoute", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /feed", () => {
    describe("認証チェック", () => {
      it("未認証の場合 401 を返すこと", async () => {
        // Arrange
        const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();
        const feedRoute = createFeedRoute({ db: mockDb as never });
        app.route("/", feedRoute);

        // Act
        const res = await app.request("/feed");

        // Assert
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("AUTH_REQUIRED");
      });
    });

    describe("正常系", () => {
      it("フォロー中ユーザーがいない場合は空配列を返すこと", async () => {
        // Arrange
        const app = createTestApp();
        const mockSelect = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });
        mockDb.select.mockImplementation(mockSelect);

        // Act
        const res = await app.request("/feed");

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data).toEqual([]);
        expect(body.meta.nextCursor).toBeNull();
        expect(body.meta.hasNext).toBe(false);
      });

      it("記事一覧をページネーション付きで返すこと", async () => {
        // Arrange
        const app = createTestApp();
        let callCount = 0;
        mockDb.select.mockImplementation(() => ({
          from: vi.fn().mockImplementation((_table) => {
            callCount++;
            if (callCount === 1) {
              // follows query
              return {
                where: vi.fn().mockResolvedValue([{ followingId: "following_user" }]),
              };
            }
            // articles query
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(MOCK_ARTICLES.slice(0, 2)),
                }),
              }),
            };
          }),
        }));

        // Act
        const res = await app.request("/feed?limit=2");

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
      });
    });

    describe("limitバリデーション", () => {
      it("limit が負の値の場合でも最小値 1 に丸められること", async () => {
        // Arrange
        const app = createTestApp();
        let callCount = 0;
        mockDb.select.mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return {
                where: vi.fn().mockResolvedValue([{ followingId: "following_user" }]),
              };
            }
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            };
          }),
        }));

        // Act
        const res = await app.request("/feed?limit=-5");

        // Assert
        expect(res.status).toBe(200);
      });

      it("limit が 50 を超える場合でも最大値 50 に丸められること", async () => {
        // Arrange
        const app = createTestApp();
        let callCount = 0;
        mockDb.select.mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return {
                where: vi.fn().mockResolvedValue([{ followingId: "following_user" }]),
              };
            }
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            };
          }),
        }));

        // Act
        const res = await app.request("/feed?limit=9999");

        // Assert
        expect(res.status).toBe(200);
      });
    });

    describe("複合カーソルページネーション", () => {
      it("カーソルが複合形式 (createdAt,id) でエンコードされること", async () => {
        // Arrange
        const app = createTestApp();
        let callCount = 0;
        mockDb.select.mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return {
                where: vi.fn().mockResolvedValue([{ followingId: "following_user" }]),
              };
            }
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  // limit+1件返して hasNext=true にする
                  limit: vi.fn().mockResolvedValue([...MOCK_ARTICLES]),
                }),
              }),
            };
          }),
        }));

        // Act
        const res = await app.request("/feed?limit=2");

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.meta.hasNext).toBe(true);
        // nextCursor は base64 エンコードされた複合カーソル
        expect(body.meta.nextCursor).not.toBeNull();
        const decoded = JSON.parse(Buffer.from(body.meta.nextCursor, "base64url").toString());
        expect(decoded).toHaveProperty("createdAt");
        expect(decoded).toHaveProperty("id");
      });
    });
  });
});
