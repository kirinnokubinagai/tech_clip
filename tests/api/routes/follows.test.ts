import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HTTP_CONFLICT,
  HTTP_CREATED,
  HTTP_NO_CONTENT,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../../../apps/api/src/lib/http-status";
import type {
  FollowFn,
  GetFollowListFn,
  IsFollowingFn,
  UnfollowFn,
  UserExistsFn,
} from "../../../apps/api/src/routes/follows";
import { createFollowsRoute } from "../../../apps/api/src/routes/follows";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
};

/** フォロー対象のモックユーザー */
const MOCK_TARGET_USER = {
  id: "user_02ABCD",
  email: "target@example.com",
  name: "フォロー対象ユーザー",
};

/** エラーレスポンスの型定義 */
type ErrorResponseBody = {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** 成功レスポンスの型定義 */
type SuccessResponseBody = {
  success: boolean;
  data?: unknown;
};

/** フォロワー/フォロー中一覧レスポンスの型定義 */
type FollowListResponseBody = {
  success: boolean;
  data: Array<Record<string, unknown>>;
  meta: {
    nextCursor: string | null;
    hasNext: boolean;
  };
};

/** モックのDB操作関数 */
const mockInsertValues = vi.fn();
const mockInsert = vi.fn().mockReturnValue({
  values: mockInsertValues,
});

const mockDeleteWhere = vi.fn();
const mockDeleteFrom = vi.fn().mockReturnValue({
  where: mockDeleteWhere,
});
const mockDelete = vi.fn().mockReturnValue({
  from: mockDeleteFrom,
});

const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({
  where: mockSelectWhere,
});
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

/** モックのDBインスタンス */
const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  delete: mockDelete,
};

/** フォロー関連のモック関数 */
let mockFollowFn: ReturnType<typeof vi.fn<FollowFn>>;
let mockUnfollowFn: ReturnType<typeof vi.fn<UnfollowFn>>;
let mockGetFollowersFn: ReturnType<typeof vi.fn<GetFollowListFn>>;
let mockGetFollowingFn: ReturnType<typeof vi.fn<GetFollowListFn>>;
let mockIsFollowingFn: ReturnType<typeof vi.fn<IsFollowingFn>>;
let mockUserExistsFn: ReturnType<typeof vi.fn<UserExistsFn>>;

/**
 * 認証済みテスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ
 */
function createTestApp() {
  type Variables = {
    user: typeof MOCK_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", async (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", { id: "session_01" });
    await next();
  });

  const followsRoute = createFollowsRoute({
    db: mockDb as never,
    followFn: mockFollowFn,
    unfollowFn: mockUnfollowFn,
    getFollowersFn: mockGetFollowersFn,
    getFollowingFn: mockGetFollowingFn,
    isFollowingFn: mockIsFollowingFn,
    userExistsFn: mockUserExistsFn,
  });
  app.route("/api/users", followsRoute);

  return app;
}

/**
 * 未認証テスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createTestAppWithoutAuth() {
  const app = new Hono();

  const followsRoute = createFollowsRoute({
    db: mockDb as never,
    followFn: mockFollowFn,
    unfollowFn: mockUnfollowFn,
    getFollowersFn: mockGetFollowersFn,
    getFollowingFn: mockGetFollowingFn,
    isFollowingFn: mockIsFollowingFn,
    userExistsFn: mockUserExistsFn,
  });
  app.route("/api/users", followsRoute);

  return app;
}

describe("POST /api/users/:id/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFollowFn = vi.fn<FollowFn>();
    mockUnfollowFn = vi.fn<UnfollowFn>();
    mockGetFollowersFn = vi.fn<GetFollowListFn>();
    mockGetFollowingFn = vi.fn<GetFollowListFn>();
    mockIsFollowingFn = vi.fn<IsFollowingFn>();
    mockUserExistsFn = vi.fn<UserExistsFn>();
  });

  describe("正常系", () => {
    it("ユーザーをフォローして201を返すこと", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockIsFollowingFn.mockResolvedValue(false);
      mockFollowFn.mockResolvedValue({
        followerId: MOCK_USER.id,
        followingId: MOCK_TARGET_USER.id,
        createdAt: "2024-01-15T00:00:00Z",
      });
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/follow`, {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      const body = (await res.json()) as SuccessResponseBody;
      expect(body.success).toBe(true);
    });

    it("followFnにfollowerIdとfollowingIdが渡されること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockIsFollowingFn.mockResolvedValue(false);
      mockFollowFn.mockResolvedValue({
        followerId: MOCK_USER.id,
        followingId: MOCK_TARGET_USER.id,
        createdAt: "2024-01-15T00:00:00Z",
      });
      const app = createTestApp();

      // Act
      await app.request(`/api/users/${MOCK_TARGET_USER.id}/follow`, {
        method: "POST",
      });

      // Assert
      expect(mockFollowFn).toHaveBeenCalledWith(MOCK_USER.id, MOCK_TARGET_USER.id);
    });
  });

  describe("異常系", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/follow`, {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("自分自身をフォローしようとした場合422が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_USER.id}/follow`, {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(body.error.message).toBe("自分自身をフォローすることはできません");
    });

    it("存在しないユーザーをフォローしようとした場合404が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(false);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/nonexistent_user/follow", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("すでにフォロー済みの場合409が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockIsFollowingFn.mockResolvedValue(true);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/follow`, {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_CONFLICT);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("DUPLICATE");
    });
  });

  describe("レスポンス形式", () => {
    it("成功レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockIsFollowingFn.mockResolvedValue(false);
      mockFollowFn.mockResolvedValue({
        followerId: MOCK_USER.id,
        followingId: MOCK_TARGET_USER.id,
        createdAt: "2024-01-15T00:00:00Z",
      });
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/follow`, {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_CREATED);
      const body = (await res.json()) as SuccessResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });

    it("エラーレスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_USER.id}/follow`, {
        method: "POST",
      });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body).toHaveProperty("success", false);
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockIsFollowingFn.mockResolvedValue(false);
      mockFollowFn.mockResolvedValue({
        followerId: MOCK_USER.id,
        followingId: MOCK_TARGET_USER.id,
        createdAt: "2024-01-15T00:00:00Z",
      });
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/follow`, {
        method: "POST",
      });

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });
});

describe("DELETE /api/users/:id/follow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFollowFn = vi.fn<FollowFn>();
    mockUnfollowFn = vi.fn<UnfollowFn>();
    mockGetFollowersFn = vi.fn<GetFollowListFn>();
    mockGetFollowingFn = vi.fn<GetFollowListFn>();
    mockIsFollowingFn = vi.fn<IsFollowingFn>();
    mockUserExistsFn = vi.fn<UserExistsFn>();
  });

  describe("正常系", () => {
    it("フォローを解除して204を返すこと", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockIsFollowingFn.mockResolvedValue(true);
      mockUnfollowFn.mockResolvedValue(undefined);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/follow`, {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_NO_CONTENT);
    });

    it("unfollowFnにfollowerIdとfollowingIdが渡されること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockIsFollowingFn.mockResolvedValue(true);
      mockUnfollowFn.mockResolvedValue(undefined);
      const app = createTestApp();

      // Act
      await app.request(`/api/users/${MOCK_TARGET_USER.id}/follow`, {
        method: "DELETE",
      });

      // Assert
      expect(mockUnfollowFn).toHaveBeenCalledWith(MOCK_USER.id, MOCK_TARGET_USER.id);
    });
  });

  describe("異常系", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/follow`, {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("フォローしていないユーザーを解除しようとした場合404が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockIsFollowingFn.mockResolvedValue(false);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/follow`, {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("存在しないユーザーのフォローを解除しようとした場合404が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(false);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/nonexistent_user/follow", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});

describe("GET /api/users/:id/followers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFollowFn = vi.fn<FollowFn>();
    mockUnfollowFn = vi.fn<UnfollowFn>();
    mockGetFollowersFn = vi.fn<GetFollowListFn>();
    mockGetFollowingFn = vi.fn<GetFollowListFn>();
    mockIsFollowingFn = vi.fn<IsFollowingFn>();
    mockUserExistsFn = vi.fn<UserExistsFn>();
  });

  describe("正常系", () => {
    it("フォロワー一覧を取得して200を返すこと", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockGetFollowersFn.mockResolvedValue([
        { id: "user_follower_01", name: "フォロワー1", image: null },
        { id: "user_follower_02", name: "フォロワー2", image: null },
      ]);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/followers`);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as FollowListResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it("getFollowersFnにuserIdとページネーションパラメータが渡されること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockGetFollowersFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      await app.request(`/api/users/${MOCK_TARGET_USER.id}/followers?limit=10&cursor=abc`);

      // Assert
      expect(mockGetFollowersFn).toHaveBeenCalledWith({
        userId: MOCK_TARGET_USER.id,
        limit: 11,
        cursor: "abc",
      });
    });

    it("デフォルトで20件のフォロワーを返すこと", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const followers = Array.from({ length: 21 }, (_, i) => ({
        id: `user_follower_${String(i + 1).padStart(2, "0")}`,
        name: `フォロワー${i + 1}`,
        image: null,
      }));
      mockGetFollowersFn.mockResolvedValue(followers);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/followers`);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as FollowListResponseBody;
      expect(body.data).toHaveLength(20);
      expect(body.meta.hasNext).toBe(true);
      expect(body.meta.nextCursor).not.toBeNull();
    });

    it("次のページがない場合hasNextがfalseであること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockGetFollowersFn.mockResolvedValue([
        { id: "user_follower_01", name: "フォロワー1", image: null },
      ]);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/followers`);

      // Assert
      const body = (await res.json()) as FollowListResponseBody;
      expect(body.meta.hasNext).toBe(false);
      expect(body.meta.nextCursor).toBeNull();
    });

    it("フォロワーが0人の場合空配列を返すこと", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockGetFollowersFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/followers`);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as FollowListResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
      expect(body.meta.hasNext).toBe(false);
      expect(body.meta.nextCursor).toBeNull();
    });
  });

  describe("異常系", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/followers`);

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("存在しないユーザーのフォロワー一覧を取得しようとした場合404が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(false);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/nonexistent_user/followers");

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("limitが1未満の場合422が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/followers?limit=0`);

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("limitが50を超える場合422が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/followers?limit=51`);

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockGetFollowersFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/followers`);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as FollowListResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("meta");
      expect(body.meta).toHaveProperty("nextCursor");
      expect(body.meta).toHaveProperty("hasNext");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockGetFollowersFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/followers`);

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });
});

describe("GET /api/users/:id/following", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFollowFn = vi.fn<FollowFn>();
    mockUnfollowFn = vi.fn<UnfollowFn>();
    mockGetFollowersFn = vi.fn<GetFollowListFn>();
    mockGetFollowingFn = vi.fn<GetFollowListFn>();
    mockIsFollowingFn = vi.fn<IsFollowingFn>();
    mockUserExistsFn = vi.fn<UserExistsFn>();
  });

  describe("正常系", () => {
    it("フォロー中一覧を取得して200を返すこと", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockGetFollowingFn.mockResolvedValue([
        { id: "user_following_01", name: "フォロー中1", image: null },
        { id: "user_following_02", name: "フォロー中2", image: null },
      ]);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/following`);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as FollowListResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
    });

    it("getFollowingFnにuserIdとページネーションパラメータが渡されること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockGetFollowingFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      await app.request(`/api/users/${MOCK_TARGET_USER.id}/following?limit=10&cursor=abc`);

      // Assert
      expect(mockGetFollowingFn).toHaveBeenCalledWith({
        userId: MOCK_TARGET_USER.id,
        limit: 11,
        cursor: "abc",
      });
    });

    it("デフォルトで20件のフォロー中ユーザーを返すこと", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const following = Array.from({ length: 21 }, (_, i) => ({
        id: `user_following_${String(i + 1).padStart(2, "0")}`,
        name: `フォロー中${i + 1}`,
        image: null,
      }));
      mockGetFollowingFn.mockResolvedValue(following);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/following`);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as FollowListResponseBody;
      expect(body.data).toHaveLength(20);
      expect(body.meta.hasNext).toBe(true);
      expect(body.meta.nextCursor).not.toBeNull();
    });

    it("フォロー中が0人の場合空配列を返すこと", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockGetFollowingFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/following`);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as FollowListResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
      expect(body.meta.hasNext).toBe(false);
      expect(body.meta.nextCursor).toBeNull();
    });
  });

  describe("異常系", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestAppWithoutAuth();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/following`);

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("存在しないユーザーのフォロー中一覧を取得しようとした場合404が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(false);
      const app = createTestApp();

      // Act
      const res = await app.request("/api/users/nonexistent_user/following");

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("limitが数値でない場合422が返ること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/following?limit=abc`);

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      mockUserExistsFn.mockResolvedValue(true);
      mockGetFollowingFn.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${MOCK_TARGET_USER.id}/following`);

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as FollowListResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("meta");
      expect(body.meta).toHaveProperty("nextCursor");
      expect(body.meta).toHaveProperty("hasNext");
    });
  });
});
