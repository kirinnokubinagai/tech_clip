import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUsersRoute } from "./users";

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
  image: null,
  emailVerified: true,
  username: "testuser",
  bio: "テスト用のプロフィールです",
  websiteUrl: "https://example.com",
  githubUsername: "testuser",
  twitterUsername: "testuser",
  avatarUrl: null,
  isProfilePublic: true,
  preferredLanguage: "ja",
  isPremium: false,
  premiumExpiresAt: null,
  freeAiUsesRemaining: 5,
  freeAiResetAt: null,
  pushToken: null,
  pushEnabled: true,
  createdAt: "2024-01-15T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 404 Not Found ステータスコード */
const HTTP_NOT_FOUND = 404;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** HTTP 409 Conflict ステータスコード */
const HTTP_CONFLICT = 409;

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
type UserResponseBody = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** モックのDB操作関数 */
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

/** モックのDBインスタンス */
const mockDb = {
  select: mockSelect,
  update: mockUpdate,
};

/**
 * GET テスト用Honoアプリを作成する（認証済み）
 *
 * @returns テスト用Honoアプリ
 */
function createGetTestApp() {
  type Variables = {
    user: typeof MOCK_USER;
    session: Record<string, unknown>;
  };
  const app = new Hono<{ Variables: Variables }>();

  app.use("*", (c, next) => {
    c.set("user", MOCK_USER);
    c.set("session", { id: "session_01" });
    return next();
  });

  const usersRoute = createUsersRoute({ db: mockDb as never });
  app.route("/api/users", usersRoute);

  return app;
}

/**
 * GET テスト用Honoアプリを作成する（未認証）
 *
 * @returns テスト用Honoアプリ（認証ミドルウェアなし）
 */
function createGetTestAppWithoutAuth() {
  const app = new Hono();

  const usersRoute = createUsersRoute({ db: mockDb as never });
  app.route("/api/users", usersRoute);

  return app;
}

/**
 * PATCH リクエストを送信するヘルパー
 */
function patchUser(app: { request: Hono["request"] }, body: Record<string, unknown>) {
  return app.request("/api/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("認証", () => {
    it("認証済みユーザーが自分のプロフィールを取得できること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      const app = createGetTestApp();

      // Act
      const res = await app.request("/api/users/me");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: MOCK_USER.id,
        email: MOCK_USER.email,
        name: MOCK_USER.name,
      });
    });

    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createGetTestAppWithoutAuth();

      // Act
      const res = await app.request("/api/users/me");

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      const app = createGetTestApp();

      // Act
      const res = await app.request("/api/users/me");

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      const app = createGetTestApp();

      // Act
      const res = await app.request("/api/users/me");

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("機密情報がレスポンスに含まれないこと", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      const app = createGetTestApp();

      // Act
      const res = await app.request("/api/users/me");

      // Assert
      const body = (await res.json()) as UserResponseBody;
      expect(body.data).not.toHaveProperty("pushToken");
      expect(body.data).not.toHaveProperty("freeAiResetAt");
    });

    it("プロフィールフィールドがレスポンスに含まれること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      const app = createGetTestApp();

      // Act
      const res = await app.request("/api/users/me");

      // Assert
      const body = (await res.json()) as UserResponseBody;
      expect(body.data).toHaveProperty("username");
      expect(body.data).toHaveProperty("bio");
      expect(body.data).toHaveProperty("websiteUrl");
      expect(body.data).toHaveProperty("githubUsername");
      expect(body.data).toHaveProperty("twitterUsername");
    });
  });

  describe("ユーザー未存在", () => {
    it("DBにユーザーが存在しない場合404が返ること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([]);
      const app = createGetTestApp();

      // Act
      const res = await app.request("/api/users/me");

      // Assert
      expect(res.status).toBe(HTTP_NOT_FOUND);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});

describe("PATCH /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockResolvedValue([MOCK_USER]);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createGetTestAppWithoutAuth();

      // Act
      const res = await patchUser(app, { name: "新しい名前" });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("正常系", () => {
    it("nameを更新できること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, name: "新しい名前" };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { name: "新しい名前" });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ name: "新しい名前" });
    });

    it("usernameを更新できること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, username: "newusername" };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { username: "newusername" });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ username: "newusername" });
    });

    it("bioを更新できること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, bio: "新しい自己紹介" };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { bio: "新しい自己紹介" });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ bio: "新しい自己紹介" });
    });

    it("websiteUrlを更新できること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, websiteUrl: "https://new-site.com" };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { websiteUrl: "https://new-site.com" });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ websiteUrl: "https://new-site.com" });
    });

    it("複数フィールドを同時に更新できること", async () => {
      // Arrange
      const updatedUser = {
        ...MOCK_USER,
        name: "新しい名前",
        bio: "新しい自己紹介",
        websiteUrl: "https://new-site.com",
      };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, {
        name: "新しい名前",
        bio: "新しい自己紹介",
        websiteUrl: "https://new-site.com",
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        name: "新しい名前",
        bio: "新しい自己紹介",
        websiteUrl: "https://new-site.com",
      });
    });

    it("githubUsernameを更新できること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, githubUsername: "newgithub" };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { githubUsername: "newgithub" });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ githubUsername: "newgithub" });
    });

    it("twitterUsernameを更新できること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, twitterUsername: "newtwitter" };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { twitterUsername: "newtwitter" });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ twitterUsername: "newtwitter" });
    });

    it("nullを設定してフィールドをクリアできること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, bio: null, websiteUrl: null };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { bio: null, websiteUrl: null });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ bio: null, websiteUrl: null });
    });
  });

  describe("バリデーションエラー", () => {
    it("nameが100文字を超える場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();
      const longName = "あ".repeat(101);

      // Act
      const res = await patchUser(app, { name: longName });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("usernameが30文字を超える場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();
      const longUsername = "a".repeat(31);

      // Act
      const res = await patchUser(app, { username: longUsername });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("usernameに不正な文字が含まれる場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { username: "user name!" });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("bioが500文字を超える場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();
      const longBio = "あ".repeat(501);

      // Act
      const res = await patchUser(app, { bio: longBio });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("websiteUrlが不正な形式の場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { websiteUrl: "not-a-url" });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("更新可能でないフィールドが無視されること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, name: "新しい名前" };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, {
        name: "新しい名前",
        email: "hacker@evil.com",
        isPremium: true,
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ name: "新しい名前" });
    });

    it("空のリクエストボディの場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, {});

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { name: "あ".repeat(101) });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("入力内容を確認してください");
    });
  });

  describe("username重複", () => {
    it("usernameが他のユーザーと重複する場合409が返ること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([{ id: "other_user", username: "taken" }]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { username: "taken" });

      // Assert
      expect(res.status).toBe(HTTP_CONFLICT);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("DUPLICATE");
    });

    it("自分自身のusernameと同じ場合は重複エラーにならないこと", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      mockUpdateReturning.mockResolvedValue([MOCK_USER]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { username: MOCK_USER.username });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
    });
  });

  describe("レスポンス形式", () => {
    it("成功レスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, name: "新しい名前" };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { name: "新しい名前" });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as UserResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
    });

    it("エラーレスポンスがAPI設計規約に従った形式であること", async () => {
      // Arrange
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { name: "あ".repeat(101) });

      // Assert
      const body = (await res.json()) as UserResponseBody;
      expect(body).toHaveProperty("success", false);
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, name: "新しい名前" };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { name: "新しい名前" });

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("機密情報が更新レスポンスに含まれないこと", async () => {
      // Arrange
      const updatedUser = { ...MOCK_USER, name: "新しい名前" };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createGetTestApp();

      // Act
      const res = await patchUser(app, { name: "新しい名前" });

      // Assert
      const body = (await res.json()) as UserResponseBody;
      expect(body.data).not.toHaveProperty("pushToken");
      expect(body.data).not.toHaveProperty("freeAiResetAt");
    });
  });
});
