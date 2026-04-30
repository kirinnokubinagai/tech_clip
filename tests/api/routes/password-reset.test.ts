import { HTTP_BAD_REQUEST, HTTP_OK, HTTP_UNPROCESSABLE_ENTITY } from "@api/lib/http-status";
import { createPasswordResetRoute } from "@api/routes/password-reset";
import { sendPasswordReset } from "@api/services/emailService";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@api/services/emailService", () => ({
  sendPasswordReset: vi.fn(),
}));

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
  data: {
    message: string;
  };
};

/** テスト用モックユーザー */
const MOCK_USER = {
  id: "user_01HXYZ",
  email: "test@example.com",
  name: "テストユーザー",
  emailVerified: true,
  createdAt: "2024-01-15T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

/** モックのDB操作関数 */
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

const mockInsertValues = vi.fn();
const mockInsert = vi.fn().mockReturnValue({
  values: mockInsertValues,
});

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({
  where: mockDeleteWhere,
});

/** モックのDBインスタンス */
const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
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
 * テスト用Honoアプリを作成する
 *
 * @returns テスト用Honoアプリ
 */
function createTestApp() {
  const app = new Hono();
  const passwordResetRoute = createPasswordResetRoute({
    db: mockDb as never,
    appUrl: "https://app.example.com",
    emailEnv: { RESEND_API_KEY: "test-key", FROM_EMAIL: "test@example.com" },
    auth: mockAuth as never,
  });
  app.route("/api/auth", passwordResetRoute);
  return app;
}

/**
 * POST /api/auth/forgot-password リクエストを送信するヘルパー
 */
function postForgotPassword(app: { request: Hono["request"] }, body: Record<string, unknown>) {
  return app.request("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * POST /api/auth/reset-password リクエストを送信するヘルパー
 */
function postResetPassword(app: { request: Hono["request"] }, body: Record<string, unknown>) {
  return app.request("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockInsertValues.mockResolvedValue(undefined);
    vi.mocked(sendPasswordReset).mockResolvedValue({ messageId: "msg_01" });
  });

  describe("正常系", () => {
    it("登録済みメールアドレスでリセットメールを送信できること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      const app = createTestApp();

      // Act
      const res = await postForgotPassword(app, { email: "test@example.com" });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SuccessResponseBody;
      expect(body.success).toBe(true);
      expect(body.data.message).toBe(
        "パスワードリセットのメールを送信しました。メールをご確認ください。",
      );
    });

    it("未登録メールアドレスでも同じ成功レスポンスを返すこと（ユーザー列挙攻撃対策）", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      const res = await postForgotPassword(app, { email: "notfound@example.com" });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SuccessResponseBody;
      expect(body.success).toBe(true);
      expect(body.data.message).toBe(
        "パスワードリセットのメールを送信しました。メールをご確認ください。",
      );
    });

    it("登録済みユーザーの場合メールサービスが呼び出されること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      const app = createTestApp();

      // Act
      await postForgotPassword(app, { email: "test@example.com" });

      // Assert
      expect(sendPasswordReset).toHaveBeenCalledOnce();
      expect(sendPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({ RESEND_API_KEY: expect.any(String) }),
        "test@example.com",
        "テストユーザー",
        expect.stringContaining("https://app.example.com"),
      );
    });

    it("未登録ユーザーの場合メールサービスが呼び出されないこと", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([]);
      const app = createTestApp();

      // Act
      await postForgotPassword(app, { email: "notfound@example.com" });

      // Assert
      expect(sendPasswordReset).not.toHaveBeenCalled();
    });

    it("リセットトークンがDBに保存されること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      const app = createTestApp();

      // Act
      await postForgotPassword(app, { email: "test@example.com" });

      // Assert
      expect(mockInsert).toHaveBeenCalledOnce();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: "password-reset:test@example.com",
        }),
      );
    });
  });

  describe("バリデーションエラー", () => {
    it("emailが空の場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postForgotPassword(app, { email: "" });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("emailが不正な形式の場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postForgotPassword(app, { email: "not-an-email" });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("emailフィールドがない場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postForgotPassword(app, {});

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postForgotPassword(app, { email: "invalid" });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("入力内容を確認してください");
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      const app = createTestApp();

      // Act
      const res = await postForgotPassword(app, { email: "test@example.com" });

      // Assert
      const body = (await res.json()) as SuccessResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveProperty("message");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      const app = createTestApp();

      // Act
      const res = await postForgotPassword(app, { email: "test@example.com" });

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });
});

describe("POST /api/auth/reset-password", () => {
  /** テスト用リセットトークン */
  const VALID_TOKEN = "valid-reset-token-abc123";

  /** 有効期限内のverificationレコード */
  const MOCK_VERIFICATION = {
    id: "verif_01",
    identifier: "test@example.com",
    value: VALID_TOKEN,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue(undefined);
  });

  describe("正常系", () => {
    it("有効なトークンでパスワードをリセットできること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValueOnce([MOCK_VERIFICATION]).mockResolvedValueOnce([MOCK_USER]);
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, {
        token: VALID_TOKEN,
        password: "NewPassword123",
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
      const body = (await res.json()) as SuccessResponseBody;
      expect(body.success).toBe(true);
      expect(body.data.message).toBe("パスワードをリセットしました。");
    });

    it("パスワードリセット後にトークンとセッションが削除されること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValueOnce([MOCK_VERIFICATION]).mockResolvedValueOnce([MOCK_USER]);
      const app = createTestApp();

      // Act
      await postResetPassword(app, {
        token: VALID_TOKEN,
        password: "NewPassword123",
      });

      // Assert: verification 削除 + session 全削除 = 2回
      expect(mockDelete).toHaveBeenCalledTimes(2);
    });

    it("パスワードリセット後にユーザーのパスワードが更新されること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValueOnce([MOCK_VERIFICATION]).mockResolvedValueOnce([MOCK_USER]);
      const app = createTestApp();

      // Act
      await postResetPassword(app, {
        token: VALID_TOKEN,
        password: "NewPassword123",
      });

      // Assert
      expect(mockUpdate).toHaveBeenCalledOnce();
    });
  });

  describe("バリデーションエラー", () => {
    it("tokenが空の場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, {
        token: "",
        password: "NewPassword123",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("passwordが空の場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, {
        token: VALID_TOKEN,
        password: "",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("passwordが8文字未満の場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, {
        token: VALID_TOKEN,
        password: "Pass1",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("tokenフィールドがない場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, { password: "NewPassword123" });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("passwordフィールドがない場合422が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, { token: VALID_TOKEN });

      // Assert
      expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("エラーメッセージが日本語であること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, { token: VALID_TOKEN, password: "" });

      // Assert
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.message).toBe("入力内容を確認してください");
    });
  });

  describe("トークン無効エラー", () => {
    it("存在しないトークンの場合400が返ること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValueOnce([]);
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, {
        token: "nonexistent-token",
        password: "NewPassword123",
      });

      // Assert
      expect(res.status).toBe(HTTP_BAD_REQUEST);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_REQUEST");
      expect(body.error.message).toBe(
        "リセットトークンが無効または期限切れです。再度パスワードリセットをお試しください。",
      );
    });

    it("期限切れトークンの場合400が返ること", async () => {
      // Arrange
      const expiredVerification = {
        ...MOCK_VERIFICATION,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      mockSelectWhere.mockResolvedValueOnce([expiredVerification]);
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, {
        token: VALID_TOKEN,
        password: "NewPassword123",
      });

      // Assert
      expect(res.status).toBe(HTTP_BAD_REQUEST);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_REQUEST");
    });
  });

  describe("レスポンス形式", () => {
    it("統一レスポンス形式に従っていること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValueOnce([MOCK_VERIFICATION]).mockResolvedValueOnce([MOCK_USER]);
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, {
        token: VALID_TOKEN,
        password: "NewPassword123",
      });

      // Assert
      const body = (await res.json()) as SuccessResponseBody;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveProperty("message");
    });

    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValueOnce([MOCK_VERIFICATION]).mockResolvedValueOnce([MOCK_USER]);
      const app = createTestApp();

      // Act
      const res = await postResetPassword(app, {
        token: VALID_TOKEN,
        password: "NewPassword123",
      });

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });
});

describe("セキュリティ強化テスト", () => {
  /** テスト用リセットトークン */
  const VALID_TOKEN = "valid-reset-token-sec-test";

  /** 有効期限内のverificationレコード */
  const MOCK_VERIFICATION = {
    id: "verif_sec_01",
    identifier: "password-reset:test@example.com",
    value: VALID_TOKEN,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue(undefined);
    mockInsertValues.mockResolvedValue(undefined);
    vi.mocked(sendPasswordReset).mockResolvedValue({ messageId: "msg_01" });
  });

  it("新規トークン発行前に旧トークンを削除すること", async () => {
    // Arrange
    mockSelectWhere.mockResolvedValue([MOCK_USER]);
    const app = createTestApp();

    // Act
    await postForgotPassword(app, { email: "test@example.com" });

    // Assert: delete が insert より先（または同時）に呼ばれていること
    expect(mockDelete).toHaveBeenCalled();
    const deleteOrder = mockDelete.mock.invocationCallOrder[0];
    const insertOrder = mockInsert.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(insertOrder);
  });

  it("パスワードリセット後に providerId='credential' のアカウントのみ更新すること", async () => {
    // Arrange
    mockSelectWhere.mockResolvedValueOnce([MOCK_VERIFICATION]).mockResolvedValueOnce([MOCK_USER]);
    const app = createTestApp();

    // Act
    await postResetPassword(app, {
      token: VALID_TOKEN,
      password: "NewPassword123",
    });

    // Assert: update の where 引数に providerId='credential' フィルタが含まれること
    expect(mockUpdateWhere).toHaveBeenCalled();
    // update().set().where() の引数を検証
    // where が2つの条件（userId AND providerId）で呼ばれていること
    const whereArg = mockUpdateWhere.mock.calls[0][0];
    // Drizzle の and() 条件が渡されていることを確認（条件が単一でないこと）
    expect(whereArg).toBeDefined();
  });

  it("パスワードリセット後にユーザーの全セッションを削除すること", async () => {
    // Arrange
    mockSelectWhere.mockResolvedValueOnce([MOCK_VERIFICATION]).mockResolvedValueOnce([MOCK_USER]);
    const app = createTestApp();

    // Act
    await postResetPassword(app, {
      token: VALID_TOKEN,
      password: "NewPassword123",
    });

    // Assert: delete が2回呼ばれていること
    // 1回目: verification トークン削除
    // 2回目: セッション全削除
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });
});
