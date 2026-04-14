import { handleEmailVerification } from "@api/app/auth-subapp";
import type { Auth } from "@api/auth";
import type { Bindings } from "@api/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@api/services/emailService", () => ({
  sendEmailVerification: vi.fn(),
}));

import { sendEmailVerification } from "@api/services/emailService";

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
  identifier: `email-verification:${MOCK_USER.id}`,
  value: "hashed-token",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** DBモック */
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });

const mockInsertValues = vi.fn().mockResolvedValue([]);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

const mockUpdateWhere = vi.fn().mockResolvedValue([]);
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

const mockDeleteWhere = vi.fn().mockResolvedValue([]);
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
} as unknown as Parameters<typeof handleEmailVerification>[0];

const mockEnv = {
  APP_URL: "https://app.example.com",
  RESEND_API_KEY: "test-key",
  FROM_EMAIL: "test@example.com",
} as unknown as Bindings;

/**
 * テスト用のモック Auth インスタンスを生成する
 *
 * @param sessionUser - セッションに返すユーザー（null の場合は未認証）
 * @returns モック Auth インスタンス
 */
function createMockAuth(sessionUser: Record<string, unknown> | null = null): Auth {
  return {
    api: {
      getSession: vi.fn().mockResolvedValue(sessionUser ? { user: sessionUser } : null),
    },
  } as unknown as Auth;
}

describe("handleEmailVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockInsertValues.mockResolvedValue([]);
    mockUpdateWhere.mockResolvedValue([]);
    mockDeleteWhere.mockResolvedValue([]);
  });

  describe("POST /api/auth/send-verification", () => {
    it("セッション付きリクエストで認証メール送信が成功すること", async () => {
      // Arrange
      const auth = createMockAuth(MOCK_USER);
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      vi.mocked(sendEmailVerification).mockResolvedValue({ messageId: "msg_01" });

      const request = new Request("https://app.example.com/api/auth/send-verification", {
        method: "POST",
        headers: { Cookie: "session=test-session-token" },
      });

      // Act
      const response = await handleEmailVerification(mockDb, mockEnv, auth, request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        data: { message: "認証メールを送信しました" },
      });
    });

    it("getSession にリクエストヘッダーが渡されること", async () => {
      // Arrange
      const auth = createMockAuth(MOCK_USER);
      mockSelectWhere.mockResolvedValue([MOCK_USER]);
      vi.mocked(sendEmailVerification).mockResolvedValue({ messageId: "msg_01" });

      const request = new Request("https://app.example.com/api/auth/send-verification", {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
      });

      // Act
      await handleEmailVerification(mockDb, mockEnv, auth, request);

      // Assert
      expect(auth.api.getSession).toHaveBeenCalledOnce();
      expect(auth.api.getSession).toHaveBeenCalledWith(
        expect.objectContaining({ headers: expect.any(Headers) }),
      );
    });

    it("セッションなしリクエストで401を返すこと", async () => {
      // Arrange
      const auth = createMockAuth(null);

      const request = new Request("https://app.example.com/api/auth/send-verification", {
        method: "POST",
      });

      // Act
      const response = await handleEmailVerification(mockDb, mockEnv, auth, request);
      const body = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        error: { code: "AUTH_REQUIRED" },
      });
    });
  });

  describe("POST /api/auth/verify-email", () => {
    it("セッションなしでもトークン検証処理が進み認証エラーにならないこと", async () => {
      // Arrange
      const auth = createMockAuth(null);
      mockSelectWhere.mockResolvedValue([MOCK_VERIFICATION]);

      const request = new Request("https://app.example.com/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "some-token" }),
      });

      // Act
      const response = await handleEmailVerification(mockDb, mockEnv, auth, request);

      // Assert
      expect(response.status).not.toBe(401);
      expect(response.status).toBe(200);
    });
  });
});
