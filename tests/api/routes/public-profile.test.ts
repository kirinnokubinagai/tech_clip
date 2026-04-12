import { HTTP_NOT_FOUND, HTTP_OK } from "@api/lib/http-status";
import { createPublicProfileRoute } from "@api/routes/public-profile";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用のユーザーID */
const TARGET_USER_ID = "user_01HXYZ";

/** 存在しないユーザーID */
const NONEXISTENT_USER_ID = "user_nonexistent";

/** テスト用のプロフィールデータ */
const MOCK_PUBLIC_PROFILE = {
  id: TARGET_USER_ID,
  name: "テストユーザー",
  username: "testuser",
  bio: "技術記事が好きなエンジニアです。",
  avatarUrl: null,
  followersCount: 42,
  followingCount: 18,
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
  };
  error?: {
    code: string;
    message: string;
  };
};

/** プロフィール取得関数のモック */
const mockGetProfileFn = vi.fn();

/**
 * テスト用のルートを生成するヘルパー
 */
function createTestApp() {
  const app = new Hono();
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

    it("getProfileFn が userId を引数に呼ばれること", async () => {
      // Arrange
      mockGetProfileFn.mockResolvedValue(MOCK_PUBLIC_PROFILE);
      const app = createTestApp();

      // Act
      await app.request(`/api/users/${TARGET_USER_ID}/profile`);

      // Assert
      expect(mockGetProfileFn).toHaveBeenCalledWith(TARGET_USER_ID);
    });
  });
});
