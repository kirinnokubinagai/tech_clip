import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailEnv } from "../../src/services/emailService";
import {
  sendEmail,
  sendEmailVerification,
  sendNotificationDigest,
  sendPasswordReset,
} from "../../src/services/emailService";

/** テスト用宛先メールアドレス */
const TEST_TO = "user@example.com";

/** テスト用件名 */
const TEST_SUBJECT = "テスト件名";

/** テスト用HTMLボディ */
const TEST_HTML_BODY = "<p>テスト本文</p>";

/** テスト用ユーザー名 */
const TEST_USER_NAME = "テストユーザー";

/** テスト用パスワードリセットURL */
const TEST_RESET_URL = "https://example.com/reset?token=abc123";

/** テスト用メール認証URL */
const TEST_VERIFY_URL = "https://example.com/verify?token=xyz789";

/** テスト用通知リスト */
const TEST_NOTIFICATIONS = [
  { title: "新着記事", body: "TypeScriptの新機能について" },
  { title: "フォロー通知", body: "テストユーザーさんがフォローしました" },
];

/** テスト用環境変数 */
const TEST_ENV: EmailEnv = {
  RESEND_API_KEY: "test_api_key_123",
  FROM_EMAIL: "no-reply@techclip.app",
};

/** Resend API成功レスポンス */
const MOCK_RESEND_SUCCESS = { id: "resend_msg_01" };

/** Resend API エンドポイント */
const RESEND_API_URL = "https://api.resend.com/emails";

describe("emailService", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(MOCK_RESEND_SUCCESS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendEmail", () => {
    it("Resend APIに正しいエンドポイントでリクエストを送信できること", async () => {
      // Arrange & Act
      await sendEmail(TEST_ENV, TEST_TO, TEST_SUBJECT, TEST_HTML_BODY);

      // Assert
      expect(fetch).toHaveBeenCalledWith(
        RESEND_API_URL,
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("Resend APIにAuthorizationヘッダーが含まれること", async () => {
      // Arrange & Act
      await sendEmail(TEST_ENV, TEST_TO, TEST_SUBJECT, TEST_HTML_BODY);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const headers = options?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer test_api_key_123");
    });

    it("Resend APIにContent-Typeヘッダーが含まれること", async () => {
      // Arrange & Act
      await sendEmail(TEST_ENV, TEST_TO, TEST_SUBJECT, TEST_HTML_BODY);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const headers = options?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("リクエストボディに宛先・件名・HTMLが含まれること", async () => {
      // Arrange & Act
      await sendEmail(TEST_ENV, TEST_TO, TEST_SUBJECT, TEST_HTML_BODY);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.to).toBe(TEST_TO);
      expect(body.subject).toBe(TEST_SUBJECT);
      expect(body.html).toBe(TEST_HTML_BODY);
    });

    it("リクエストボディのfromにFROM_EMAIL環境変数が使われること", async () => {
      // Arrange & Act
      await sendEmail(TEST_ENV, TEST_TO, TEST_SUBJECT, TEST_HTML_BODY);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.from).toBe("no-reply@techclip.app");
    });

    it("送信成��時にmessageIdを返すこと", async () => {
      // Arrange & Act
      const result = await sendEmail(TEST_ENV, TEST_TO, TEST_SUBJECT, TEST_HTML_BODY);

      // Assert
      expect(result.messageId).toBe("resend_msg_01");
    });

    it("APIがエラーを返した場合に例外をスローすること", async () => {
      // Arrange
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ message: "Invalid API Key" }), { status: 401 }),
      );

      // Act & Assert
      await expect(sendEmail(TEST_ENV, TEST_TO, TEST_SUBJECT, TEST_HTML_BODY)).rejects.toThrow(
        "メール送信に失敗しました",
      );
    });

    it("RESEND_API_KEYが未設定の場合に例外をスローすること", async () => {
      // Arrange
      const envWithoutKey: EmailEnv = { RESEND_API_KEY: "", FROM_EMAIL: "a@b.com" };

      // Act & Assert
      await expect(sendEmail(envWithoutKey, TEST_TO, TEST_SUBJECT, TEST_HTML_BODY)).rejects.toThrow(
        "RESEND_API_KEY",
      );
    });

    it("FROM_EMAILが未設定の場合に例外をスローすること", async () => {
      // Arrange
      const envWithoutFrom: EmailEnv = { RESEND_API_KEY: "key", FROM_EMAIL: "" };

      // Act & Assert
      await expect(
        sendEmail(envWithoutFrom, TEST_TO, TEST_SUBJECT, TEST_HTML_BODY),
      ).rejects.toThrow("FROM_EMAIL");
    });
  });

  describe("sendPasswordReset", () => {
    it("パスワードリセットメールを送信できること", async () => {
      // Arrange & Act
      await sendPasswordReset(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_RESET_URL);

      // Assert
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("件名にパスワードリセットの文言が含まれること", async () => {
      // Arrange & Act
      await sendPasswordReset(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_RESET_URL);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.subject).toContain("パスワードリセット");
    });

    it("HTMLボディにリセットURLが含まれること", async () => {
      // Arrange & Act
      await sendPasswordReset(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_RESET_URL);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.html).toContain(TEST_RESET_URL);
    });

    it("HTMLボディにユーザー名が含まれること", async () => {
      // Arrange & Act
      await sendPasswordReset(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_RESET_URL);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.html).toContain(TEST_USER_NAME);
    });

    it("宛先が正しく設定されること", async () => {
      // Arrange & Act
      await sendPasswordReset(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_RESET_URL);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.to).toBe(TEST_TO);
    });
  });

  describe("sendEmailVerification", () => {
    it("メール認証メールを送信できること", async () => {
      // Arrange & Act
      await sendEmailVerification(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_VERIFY_URL);

      // Assert
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("件名にメール認証の文言が含まれること", async () => {
      // Arrange & Act
      await sendEmailVerification(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_VERIFY_URL);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.subject).toContain("メールアドレス認証");
    });

    it("HTMLボディに認証URLが含まれること", async () => {
      // Arrange & Act
      await sendEmailVerification(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_VERIFY_URL);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.html).toContain(TEST_VERIFY_URL);
    });

    it("HTMLボディにユーザー名が含まれること", async () => {
      // Arrange & Act
      await sendEmailVerification(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_VERIFY_URL);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.html).toContain(TEST_USER_NAME);
    });

    it("宛先が正しく設定されること", async () => {
      // Arrange & Act
      await sendEmailVerification(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_VERIFY_URL);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.to).toBe(TEST_TO);
    });
  });

  describe("sendNotificationDigest", () => {
    it("通知ダイジェストメールを送信できること", async () => {
      // Arrange & Act
      await sendNotificationDigest(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_NOTIFICATIONS);

      // Assert
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("件名にダイジェストの文言が含まれること", async () => {
      // Arrange & Act
      await sendNotificationDigest(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_NOTIFICATIONS);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.subject).toContain("通知");
    });

    it("HTMLボディに各通知タイトルが含まれること", async () => {
      // Arrange & Act
      await sendNotificationDigest(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_NOTIFICATIONS);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      for (const notification of TEST_NOTIFICATIONS) {
        expect(body.html).toContain(notification.title);
      }
    });

    it("HTMLボディにユーザー名が含まれること", async () => {
      // Arrange & Act
      await sendNotificationDigest(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_NOTIFICATIONS);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.html).toContain(TEST_USER_NAME);
    });

    it("宛先が正しく設定されること", async () => {
      // Arrange & Act
      await sendNotificationDigest(TEST_ENV, TEST_TO, TEST_USER_NAME, TEST_NOTIFICATIONS);

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.to).toBe(TEST_TO);
    });

    it("通知が空配列の場合でも送信できること", async () => {
      // Arrange & Act
      await sendNotificationDigest(TEST_ENV, TEST_TO, TEST_USER_NAME, []);

      // Assert
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
