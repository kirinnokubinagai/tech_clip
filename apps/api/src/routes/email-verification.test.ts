import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmailVerificationRoute } from "./email-verification";

vi.mock("../services/emailService", () => ({
  sendEmailVerification: vi.fn(),
}));

import { sendEmailVerification } from "../services/emailService";

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 400 Bad Request ステータスコード */
const HTTP_BAD_REQUEST = 400;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 404 Not Found ステータスコード */
const HTTP_NOT_FOUND = 404;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/** テスト用のモックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
  emailVerified: false,
};

/** テスト用のモック検証レコード */
const MOCK_VERIFICATION = {
  id: "verif_01",
  identifier: "test@example.com",
  value: "test-token-abc123",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** モックDB操作関数 */
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

const mockInsert = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();

const mockUpdate = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn();

const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();

/** モックDBインスタンス */
const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
} as unknown as Parameters<typeof createEmailVerificationRoute>[0]["db"];

/**
 * 認証済みユーザーをセットするミドルウェアを含むHonoアプリを作成する
 */
function createApp(user?: Record<string, unknown>) {
  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  app.use("*", async (c, next) => {
    if (user) {
      c.set("user", user);
    }
    await next();
  });

  const route = createEmailVerificationRoute({
    db: mockDb,
    appUrl: "https://app.example.com",
    emailEnv: { RESEND_API_KEY: "test-key", FROM_EMAIL: "test@example.com" },
  });
  app.route("/api/auth", route);
  return app;
}

describe("POST /api/auth/send-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockResolvedValue([MOCK_USER]);

    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([MOCK_VERIFICATION]);

    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue([]);

    vi.mocked(sendEmailVerification).mockResolvedValue({ messageId: "msg_01" });
  });

  it("認証済みユーザーが検証メールを送信できること", async () => {
    // Arrange
    const app = createApp(MOCK_USER);
    const req = new Request("http://localhost/api/auth/send-verification", {
      method: "POST",
    });

    // Act
    const res = await app.fetch(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(HTTP_OK);
    expect(body).toMatchObject({
      success: true,
      data: { message: "認証メールを送信しました" },
    });
  });

  it("メール送信サービスが呼び出されること", async () => {
    // Arrange
    const app = createApp(MOCK_USER);
    const req = new Request("http://localhost/api/auth/send-verification", {
      method: "POST",
    });

    // Act
    await app.fetch(req);

    // Assert
    expect(sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({ RESEND_API_KEY: expect.any(String) }),
      MOCK_USER.email,
      MOCK_USER.name,
      expect.stringContaining("token="),
    );
  });

  it("メール検証URLにアプリURLとトークンが含まれること", async () => {
    // Arrange
    const app = createApp(MOCK_USER);
    const req = new Request("http://localhost/api/auth/send-verification", {
      method: "POST",
    });

    // Act
    await app.fetch(req);

    // Assert
    const callArgs = vi.mocked(sendEmailVerification).mock.calls[0];
    const verifyUrl = callArgs[3];
    expect(verifyUrl).toContain("https://app.example.com");
    expect(verifyUrl).toContain("token=");
  });

  it("未認証の場合は401を返すこと", async () => {
    // Arrange
    const app = createApp(); // userなし
    const req = new Request("http://localhost/api/auth/send-verification", {
      method: "POST",
    });

    // Act
    const res = await app.fetch(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(HTTP_UNAUTHORIZED);
    expect(body).toMatchObject({
      success: false,
      error: { code: "AUTH_REQUIRED" },
    });
  });

  it("ユーザーが存在しない場合は404を返すこと", async () => {
    // Arrange
    mockSelectWhere.mockResolvedValue([]); // ユーザー未発見
    const app = createApp(MOCK_USER);
    const req = new Request("http://localhost/api/auth/send-verification", {
      method: "POST",
    });

    // Act
    const res = await app.fetch(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(HTTP_NOT_FOUND);
    expect(body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("メール送信に失敗した場合は500を返すこと", async () => {
    // Arrange
    vi.mocked(sendEmailVerification).mockRejectedValue(new Error("送信失敗"));
    const app = createApp(MOCK_USER);
    const req = new Request("http://localhost/api/auth/send-verification", {
      method: "POST",
    });

    // Act
    const res = await app.fetch(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
    expect(body).toMatchObject({
      success: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });
});

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockResolvedValue([MOCK_VERIFICATION]);

    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockUpdateReturning.mockResolvedValue([{ ...MOCK_USER, emailVerified: true }]);

    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue([]);
  });

  it("有効なトークンでメールアドレスを認証できること", async () => {
    // Arrange
    const app = createApp();
    const req = new Request("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "test-token-abc123" }),
    });

    // Act
    const res = await app.fetch(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(HTTP_OK);
    expect(body).toMatchObject({
      success: true,
      data: { message: "メールアドレスの認証が完了しました" },
    });
  });

  it("認証後にusersテーブルのemailVerifiedがtrueになること", async () => {
    // Arrange
    const app = createApp();
    const req = new Request("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "test-token-abc123" }),
    });

    // Act
    await app.fetch(req);

    // Assert
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith({ emailVerified: true });
  });

  it("認証後に使用済みトークンが削除されること", async () => {
    // Arrange
    const app = createApp();
    const req = new Request("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "test-token-abc123" }),
    });

    // Act
    await app.fetch(req);

    // Assert
    expect(mockDelete).toHaveBeenCalled();
  });

  it("tokenが未指定の場合は422を返すこと", async () => {
    // Arrange
    const app = createApp();
    const req = new Request("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    // Act
    const res = await app.fetch(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
    expect(body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_FAILED" },
    });
  });

  it("存在しないトークンの場合は400を返すこと", async () => {
    // Arrange
    mockSelectWhere.mockResolvedValue([]); // トークン未発見
    const app = createApp();
    const req = new Request("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid-token" }),
    });

    // Act
    const res = await app.fetch(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(HTTP_BAD_REQUEST);
    expect(body).toMatchObject({
      success: false,
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("期限切れトークンの場合は400を返すこと", async () => {
    // Arrange
    const expiredVerification = {
      ...MOCK_VERIFICATION,
      expiresAt: new Date(Date.now() - 1000).toISOString(), // 過去の日時
    };
    mockSelectWhere.mockResolvedValue([expiredVerification]);
    const app = createApp();
    const req = new Request("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "test-token-abc123" }),
    });

    // Act
    const res = await app.fetch(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(HTTP_BAD_REQUEST);
    expect(body).toMatchObject({
      success: false,
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("リクエストボディが不正な場合は422を返すこと", async () => {
    // Arrange
    const app = createApp();
    const req = new Request("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    // Act
    const res = await app.fetch(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
    expect(body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_FAILED" },
    });
  });
});
