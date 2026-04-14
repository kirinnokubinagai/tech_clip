import { HTTP_INTERNAL_SERVER_ERROR, HTTP_NOT_FOUND, HTTP_OK } from "@api/lib/http-status";
import { createPublicProfileRoute } from "@api/routes/public-profile";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用のターゲットユーザーID */
const TARGET_USER_ID = "user_01HXYZ";

/** テスト用の閲覧者ユーザーID */
const VIEWER_USER_ID = "viewer_01ABC";

/** 存在しないユーザーID */
const NONEXISTENT_USER_ID = "user_nonexistent";

/** テスト用のプロフィールデータ（isFollowing 含む） */
const MOCK_PUBLIC_PROFILE = {
  id: TARGET_USER_ID,
  name: "テストユーザー",
  username: "testuser",
  bio: "技術記事が好きなエンジニアです。",
  avatarUrl: null,
  followersCount: 42,
  followingCount: 18,
  isFollowing: false,
};

/** 公開プロフィールレスポンスの型定義 */
type PublicProfileResponseBody = {
  success: boolean;
  data?: {
    id: string;
    name: string | null;
    username: string | null;
    bio: string | null;
    avatarUrl: string | null;
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
};

/** プロフィール取得関数のモック */
const mockGetProfileFn = vi.fn();

/**
 * テスト用のルートを生成するヘルパー（未認証）
 */
function createTestApp() {
  const app = new Hono();
  const route = createPublicProfileRoute({ getProfileFn: mockGetProfileFn });
  app.route("/api/users", route);
  return app;
}

/**
 * テスト用のルートを生成するヘルパー（認証済み）
 */
function createTestAppWithUser(userId: string) {
  type Variables = { user?: { id: string } };
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", (c, next) => {
    c.set("user", { id: userId });
    return next();
  });
  const route = createPublicProfileRoute({ getProfileFn: mockGetProfileFn });
  app.route("/api/users", route);
  return app;
}

describe("createPublicProfileRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /:id/profile", () => {
    it("存在するユーザーの公開プロフィールを取得できること", async () => {
      // Arrange
      mockGetProfileFn.mockResolvedValue(MOCK_PUBLIC_PROFILE);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/profile`);
      const body = (await res.json()) as PublicProfileResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_OK);
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: TARGET_USER_ID,
        name: "テストユーザー",
        username: "testuser",
        bio: "技術記事が好きなエンジニアです。",
        avatarUrl: null,
        followersCount: 42,
        followingCount: 18,
        isFollowing: false,
      });
    });

    it("存在しないユーザーの場合 404 を返すこと", async () => {
      // Arrange
      mockGetProfileFn.mockResolvedValue(null);
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${NONEXISTENT_USER_ID}/profile`);
      const body = (await res.json()) as PublicProfileResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe("NOT_FOUND");
    });

    it("未認証時に getProfileFn が viewerUserId=null で呼ばれること", async () => {
      // Arrange
      mockGetProfileFn.mockResolvedValue(MOCK_PUBLIC_PROFILE);
      const app = createTestApp();

      // Act
      await app.request(`/api/users/${TARGET_USER_ID}/profile`);

      // Assert
      expect(mockGetProfileFn).toHaveBeenCalledWith(TARGET_USER_ID, null);
    });

    it("認証済み時に getProfileFn が viewerUserId 付きで呼ばれること", async () => {
      // Arrange
      mockGetProfileFn.mockResolvedValue(MOCK_PUBLIC_PROFILE);
      const app = createTestAppWithUser(VIEWER_USER_ID);

      // Act
      await app.request(`/api/users/${TARGET_USER_ID}/profile`);

      // Assert
      expect(mockGetProfileFn).toHaveBeenCalledWith(TARGET_USER_ID, VIEWER_USER_ID);
    });

    it("viewerUserId が null のとき isFollowing === false を返すこと", async () => {
      // Arrange
      mockGetProfileFn.mockResolvedValue({ ...MOCK_PUBLIC_PROFILE, isFollowing: false });
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/profile`);
      const body = (await res.json()) as PublicProfileResponseBody;

      // Assert
      expect(body.data?.isFollowing).toBe(false);
    });

    it("フォロー済みのとき isFollowing === true を返すこと", async () => {
      // Arrange
      mockGetProfileFn.mockResolvedValue({ ...MOCK_PUBLIC_PROFILE, isFollowing: true });
      const app = createTestAppWithUser(VIEWER_USER_ID);

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/profile`);
      const body = (await res.json()) as PublicProfileResponseBody;

      // Assert
      expect(body.data?.isFollowing).toBe(true);
    });

    it("getProfileFn が例外をスローした場合 500 を返すこと", async () => {
      // Arrange
      mockGetProfileFn.mockRejectedValue(new Error("DB接続エラー"));
      const app = createTestApp();

      // Act
      const res = await app.request(`/api/users/${TARGET_USER_ID}/profile`);

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
    });
  });
});
