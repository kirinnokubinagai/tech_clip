import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FollowFn,
  GetFollowListFn,
  IsFollowingFn,
  UnfollowFn,
  UserExistsFn,
} from "../../src/routes/follows";
import { createFollowsRoute } from "../../src/routes/follows";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_follows_01",
  email: "follows@example.com",
  name: "フォローテストユーザー",
};

/** テスト用フォロー対象ユーザーID */
const TARGET_USER_ID = "user_follows_02";

/** エラーレスポンスの型定義 */
type ErrorResponse = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** フォローレスポンスの型定義 */
type FollowResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
};

/** フォロー一覧レスポンスの型定義 */
type FollowListResponse = {
  success: boolean;
  data: Array<Record<string, unknown>>;
  meta: {
    nextCursor: string | null;
    hasNext: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
};

/**
 * テスト用モックDBを生成する
 *
 * @returns モックDBオブジェクト
 */
function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
}

/**
 * テスト用アプリを生成する
 *
 * @param options - テスト用オプション
 * @returns テスト用 Hono アプリ
 */
function createTestApp(options: {
  mockDb?: ReturnType<typeof createMockDb>;
  followFn?: ReturnType<typeof vi.fn<FollowFn>>;
  unfollowFn?: ReturnType<typeof vi.fn<UnfollowFn>>;
  getFollowersFn?: ReturnType<typeof vi.fn<GetFollowListFn>>;
  getFollowingFn?: ReturnType<typeof vi.fn<GetFollowListFn>>;
  isFollowingFn?: ReturnType<typeof vi.fn<IsFollowingFn>>;
  userExistsFn?: ReturnType<typeof vi.fn<UserExistsFn>>;
  authenticated?: boolean;
}) {
  const {
    mockDb = createMockDb(),
    followFn = vi.fn<FollowFn>().mockResolvedValue({
      followerId: MOCK_USER.id,
      followingId: TARGET_USER_ID,
      createdAt: new Date().toISOString(),
    }),
    unfollowFn = vi.fn<UnfollowFn>().mockResolvedValue(undefined),
    getFollowersFn = vi.fn<GetFollowListFn>().mockResolvedValue([]),
    getFollowingFn = vi.fn<GetFollowListFn>().mockResolvedValue([]),
    isFollowingFn = vi.fn<IsFollowingFn>().mockResolvedValue(false),
    userExistsFn = vi.fn<UserExistsFn>().mockResolvedValue(true),
    authenticated = true,
  } = options;

  const route = createFollowsRoute({
    db: mockDb as unknown as Parameters<typeof createFollowsRoute>[0]["db"],
    followFn,
    unfollowFn,
    getFollowersFn,
    getFollowingFn,
    isFollowingFn,
    userExistsFn,
  });

  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  app.use("*", async (c, next) => {
    if (authenticated) {
      c.set("user", MOCK_USER);
    }
    await next();
  });

  app.route("/", route);
  return app;
}

describe("フォローAPI 統合テスト", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /:id/follow", () => {
    it("ユーザーをフォローできること", async () => {
      // Arrange
      const app = createTestApp({});
      const req = new Request(`http://localhost/${TARGET_USER_ID}/follow`, {
        method: "POST",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as FollowResponse;

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      expect(body.success).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp({ authenticated: false });
      const req = new Request(`http://localhost/${TARGET_USER_ID}/follow`, {
        method: "POST",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("存在しないユーザーの場合に404エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp({
        userExistsFn: vi.fn<UserExistsFn>().mockResolvedValue(false),
      });
      const req = new Request("http://localhost/nonexistent_user/follow", {
        method: "POST",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("すでにフォロー済みの場合に409エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp({
        isFollowingFn: vi.fn<IsFollowingFn>().mockResolvedValue(true),
      });
      const req = new Request(`http://localhost/${TARGET_USER_ID}/follow`, {
        method: "POST",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_CONFLICT);
      expect(body.error.code).toBe("DUPLICATE");
    });
  });

  describe("DELETE /:id/follow", () => {
    it("フォローを解除できること", async () => {
      // Arrange
      const app = createTestApp({
        isFollowingFn: vi.fn<IsFollowingFn>().mockResolvedValue(true),
      });
      const req = new Request(`http://localhost/${TARGET_USER_ID}/follow`, {
        method: "DELETE",
      });

      // Act
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(HTTP_NO_CONTENT);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp({ authenticated: false });
      const req = new Request(`http://localhost/${TARGET_USER_ID}/follow`, {
        method: "DELETE",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("フォローしていない場合に404エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp({
        isFollowingFn: vi.fn<IsFollowingFn>().mockResolvedValue(false),
      });
      const req = new Request(`http://localhost/${TARGET_USER_ID}/follow`, {
        method: "DELETE",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /:id/followers", () => {
    it("フォロワー一覧を取得できること", async () => {
      // Arrange
      const mockFollowers = [
        {
          followerId: "follower_001",
          followingId: TARGET_USER_ID,
          createdAt: new Date().toISOString(),
        },
      ];
      const app = createTestApp({
        getFollowersFn: vi.fn<GetFollowListFn>().mockResolvedValue(mockFollowers),
      });
      const req = new Request(`http://localhost/${TARGET_USER_ID}/followers`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as FollowListResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp({ authenticated: false });
      const req = new Request(`http://localhost/${TARGET_USER_ID}/followers`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("GET /:id/following", () => {
    it("フォロー中一覧を取得できること", async () => {
      // Arrange
      const mockFollowing = [
        {
          followerId: MOCK_USER.id,
          followingId: TARGET_USER_ID,
          createdAt: new Date().toISOString(),
        },
      ];
      const app = createTestApp({
        getFollowingFn: vi.fn<GetFollowListFn>().mockResolvedValue(mockFollowing),
      });
      const req = new Request(`http://localhost/${MOCK_USER.id}/following`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as FollowListResponse;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("未認証の場合に401エラーを返すこと", async () => {
      // Arrange
      const app = createTestApp({ authenticated: false });
      const req = new Request(`http://localhost/${MOCK_USER.id}/following`);

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponse;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });
});
