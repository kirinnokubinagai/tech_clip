import type { Auth } from "@api/auth";
import type { Database } from "@api/db";
import { createUsersRoute } from "@api/routes/users";
import { processAvatarImage, uploadAvatarToR2, validateImageFile } from "@api/services/imageUpload";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@api/services/imageUpload", () => ({
  validateImageFile: vi.fn(),
  processAvatarImage: vi.fn(),
  uploadAvatarToR2: vi.fn(),
}));

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

/** Better Auth の password.hash/verify をそのまま返すモック auth */
const mockAuth = {
  $context: Promise.resolve({
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  }),
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

  const usersRoute = createUsersRoute({
    db: mockDb as unknown as Database,
    auth: mockAuth as unknown as Auth,
  });
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

  const usersRoute = createUsersRoute({
    db: mockDb as unknown as Database,
    auth: mockAuth as unknown as Auth,
  });
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

/** HTTP 200 OK ステータスコード */
const HTTP_OK_PASSWORD = 200;

/** モックのアカウントデータ（passwordはダミー値; verifyに通らないことが前提のテストで使用） */
const MOCK_ACCOUNT = {
  id: "account_01HXYZ",
  userId: "user_01HXYZ",
  accountId: "user_01HXYZ",
  providerId: "credential",
  password: "dummy-hash-does-not-verify",
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scope: null,
  idToken: null,
  createdAt: "2024-01-15T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

/**
 * PATCH /me/password リクエストを送信するヘルパー
 */
function patchPassword(app: { request: Hono["request"] }, body: Record<string, unknown>) {
  return app.request("/api/users/me/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/users/me/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockResolvedValue([MOCK_ACCOUNT]);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  describe("認証", () => {
    it("未認証の場合401が返ること", async () => {
      // Arrange
      const app = createGetTestAppWithoutAuth();

      // Act
      const res = await patchPassword(app, {
        currentPassword: "OldPass123",
        newPassword: "NewPass456",
      });

      // Assert
      expect(res.status).toBe(401);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("バリデーション", () => {
    it("currentPasswordが空の場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();

      // Act
      const res = await patchPassword(app, {
        currentPassword: "",
        newPassword: "NewPass456",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("newPasswordが8文字未満の場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();

      // Act
      const res = await patchPassword(app, {
        currentPassword: "OldPass123",
        newPassword: "short",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("newPasswordが128文字を超える場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();

      // Act
      const res = await patchPassword(app, {
        currentPassword: "OldPass123",
        newPassword: "a".repeat(129),
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("currentPasswordが存在しない場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();

      // Act
      const res = await patchPassword(app, {
        newPassword: "NewPass456",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("newPasswordが存在しない場合422が返ること", async () => {
      // Arrange
      const app = createGetTestApp();

      // Act
      const res = await patchPassword(app, {
        currentPassword: "OldPass123",
      });

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
      const res = await patchPassword(app, {
        currentPassword: "OldPass123",
        newPassword: "short",
      });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("入力内容を確認してください");
    });
  });

  describe("現在のパスワード検証", () => {
    it("アカウントが存在しない場合（ソーシャルログインユーザー）401が返ること", async () => {
      // Arrange
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockImplementation((_cond: unknown) => {
        return Promise.resolve([]);
      });
      const app = createGetTestApp();

      // Act
      const res = await patchPassword(app, {
        currentPassword: "OldPass123",
        newPassword: "NewPass456",
      });

      // Assert
      expect(res.status).toBe(401);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("現在のパスワードが正しくない場合401が返ること", async () => {
      // Arrange: Better Auth の hash で "CorrectPass123" のハッシュを生成し、
      //          "WrongPassword123" で照合すると false になることを確認する
      const correctHash = await hashPassword("CorrectPass123");
      const accountWithHash = {
        ...MOCK_ACCOUNT,
        password: correctHash,
      };
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([accountWithHash]);
      const app = createGetTestApp();

      // Act
      const res = await patchPassword(app, {
        currentPassword: "WrongPassword123",
        newPassword: "NewPass456",
      });

      // Assert
      expect(res.status).toBe(401);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_INVALID");
    });
  });

  describe("正常系", () => {
    it("正しい現在のパスワードでパスワードを変更できること", async () => {
      // Arrange: Better Auth の hashPassword で現在パスワードのハッシュを生成する
      const plainPassword = "OldPass123";
      const storedHash = await hashPassword(plainPassword);

      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockResolvedValue([{ ...MOCK_ACCOUNT, password: storedHash }]);
      mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
      mockUpdateWhere.mockResolvedValue(undefined);
      const app = createGetTestApp();

      // Act
      const res = await patchPassword(app, {
        currentPassword: plainPassword,
        newPassword: "NewPass456",
      });

      // Assert
      expect(res.status).toBe(HTTP_OK_PASSWORD);
      const body = (await res.json()) as { success: boolean; data: { message: string } };
      expect(body.success).toBe(true);
      expect(body.data.message).toBeDefined();
    });
  });
});

/** HTTP 200 OK ステータスコード (avatar) */
const HTTP_OK_AVATAR = 200;

/** HTTP 400 Bad Request ステータスコード */
const HTTP_BAD_REQUEST = 400;

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** モックのアバターアップロードR2設定 */
const MOCK_R2_BUCKET = {} as R2Bucket;

/**
 * アバターアップロード用テストアプリを作成する（認証済み）
 *
 * @returns テスト用Honoアプリ
 */
function createAvatarTestApp() {
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

  const usersRoute = createUsersRoute({
    db: mockDb as unknown as Database,
    r2Bucket: MOCK_R2_BUCKET,
    r2PublicUrl: "https://cdn.example.com",
    auth: mockAuth as unknown as Auth,
  });
  app.route("/api/users", usersRoute);

  return app;
}

/**
 * multipart/form-dataリクエストを送信するヘルパー
 */
function postAvatar(app: { request: Hono["request"] }, file: File) {
  const formData = new FormData();
  formData.append("avatar", file);
  return app.request("/api/users/me/avatar", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/users/me/avatar", () => {
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
      const usersRoute = createUsersRoute({
        db: mockDb as unknown as Database,
        r2Bucket: MOCK_R2_BUCKET,
        r2PublicUrl: "https://cdn.example.com",
        auth: mockAuth as unknown as Auth,
      });
      app.route("/api/users", usersRoute);
      const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "avatar.jpg", {
        type: "image/jpeg",
      });

      // Act
      const res = await postAvatar(app as unknown as { request: Hono["request"] }, file);

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("正常系", () => {
    it("有効なJPEGファイルをアップロードできること", async () => {
      // Arrange
      const mockValidate = vi.mocked(validateImageFile);
      const mockProcessImage = vi.mocked(processAvatarImage);
      const mockUpload = vi.mocked(uploadAvatarToR2);
      mockValidate.mockReturnValue({ isValid: true });
      mockProcessImage.mockResolvedValue({
        isValid: true,
        image: {
          buffer: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
          contentType: "image/jpeg",
          extension: "jpg",
        },
      });
      mockUpload.mockResolvedValue({
        avatarUrl: "https://cdn.example.com/avatars/user_01HXYZ_123.jpg",
      });
      const updatedUser = {
        ...MOCK_USER,
        avatarUrl: "https://cdn.example.com/avatars/user_01HXYZ_123.jpg",
      };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createAvatarTestApp();
      const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "avatar.jpg", {
        type: "image/jpeg",
      });

      // Act
      const res = await postAvatar(app, file);

      // Assert
      expect(res.status).toBe(HTTP_OK_AVATAR);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        avatarUrl: "https://cdn.example.com/avatars/user_01HXYZ_123.jpg",
      });
    });

    it("有効なPNGファイルをアップロードできること", async () => {
      // Arrange
      const mockValidate = vi.mocked(validateImageFile);
      const mockProcessImage = vi.mocked(processAvatarImage);
      const mockUpload = vi.mocked(uploadAvatarToR2);
      mockValidate.mockReturnValue({ isValid: true });
      mockProcessImage.mockResolvedValue({
        isValid: true,
        image: {
          buffer: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
          contentType: "image/png",
          extension: "png",
        },
      });
      mockUpload.mockResolvedValue({
        avatarUrl: "https://cdn.example.com/avatars/user_01HXYZ_456.png",
      });
      const updatedUser = {
        ...MOCK_USER,
        avatarUrl: "https://cdn.example.com/avatars/user_01HXYZ_456.png",
      };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createAvatarTestApp();
      const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "avatar.png", {
        type: "image/png",
      });

      // Act
      const res = await postAvatar(app, file);

      // Assert
      expect(res.status).toBe(HTTP_OK_AVATAR);
      const body = (await res.json()) as UserResponseBody;
      expect(body.success).toBe(true);
    });

    it("アップロード後にavatarUrlがDBに保存されること", async () => {
      // Arrange
      const mockValidate = vi.mocked(validateImageFile);
      const mockProcessImage = vi.mocked(processAvatarImage);
      const mockUpload = vi.mocked(uploadAvatarToR2);
      const AVATAR_URL = "https://cdn.example.com/avatars/user_01HXYZ_789.webp";
      mockValidate.mockReturnValue({ isValid: true });
      mockProcessImage.mockResolvedValue({
        isValid: true,
        image: {
          buffer: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
          contentType: "image/webp",
          extension: "webp",
        },
      });
      mockUpload.mockResolvedValue({ avatarUrl: AVATAR_URL });
      const updatedUser = { ...MOCK_USER, avatarUrl: AVATAR_URL };
      mockUpdateReturning.mockResolvedValue([updatedUser]);
      const app = createAvatarTestApp();
      const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "avatar.jpg", {
        type: "image/jpeg",
      });

      // Act
      await postAvatar(app, file);

      // Assert
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: AVATAR_URL }),
      );
    });

    it("実体画像の検証で失敗した場合400が返ること", async () => {
      // Arrange
      const mockValidate = vi.mocked(validateImageFile);
      const mockProcessImage = vi.mocked(processAvatarImage);
      const mockUpload = vi.mocked(uploadAvatarToR2);
      mockValidate.mockReturnValue({ isValid: true });
      mockProcessImage.mockResolvedValue({
        isValid: false,
        error: "画像は4096px以下でアップロードしてください",
      });
      const app = createAvatarTestApp();
      const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "avatar.jpg", {
        type: "image/jpeg",
      });

      // Act
      const res = await postAvatar(app, file);

      // Assert
      expect(res.status).toBe(HTTP_BAD_REQUEST);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_REQUEST");
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  describe("バリデーションエラー", () => {
    it("不正なファイル形式の場合400が返ること", async () => {
      // Arrange
      const mockValidate = vi.mocked(validateImageFile);
      mockValidate.mockReturnValue({
        isValid: false,
        error: "jpg/png/webpのみアップロードできます",
      });
      const app = createAvatarTestApp();
      const file = new File([new Uint8Array([0x00, 0x00])], "avatar.gif", {
        type: "image/gif",
      });

      // Act
      const res = await postAvatar(app, file);

      // Assert
      expect(res.status).toBe(HTTP_BAD_REQUEST);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_REQUEST");
    });

    it("avatarフィールドがない場合400が返ること", async () => {
      // Arrange
      const app = createAvatarTestApp();

      // Act
      const formData = new FormData();
      const res = await app.request("/api/users/me/avatar", {
        method: "POST",
        body: formData,
      });

      // Assert
      expect(res.status).toBe(HTTP_BAD_REQUEST);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_REQUEST");
    });
  });

  describe("サーバーエラー", () => {
    it("R2アップロードに失敗した場合500が返ること", async () => {
      // Arrange
      const mockValidate = vi.mocked(validateImageFile);
      const mockProcessImage = vi.mocked(processAvatarImage);
      const mockUpload = vi.mocked(uploadAvatarToR2);
      mockValidate.mockReturnValue({ isValid: true });
      mockProcessImage.mockResolvedValue({
        isValid: true,
        image: {
          buffer: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
          contentType: "image/webp",
          extension: "webp",
        },
      });
      mockUpload.mockRejectedValue(new Error("アバター画像のアップロードに失敗しました"));
      const app = createAvatarTestApp();
      const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "avatar.jpg", {
        type: "image/jpeg",
      });

      // Act
      const res = await postAvatar(app, file);

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
