import {
  buildEmailVerificationHtml,
  getEmailVerificationSubject,
} from "@api/services/email/templates/email-verification";
import { describe, expect, it } from "vitest";

/** テスト用定数 */
const TEST_USER_NAME = "テストユーザー";
const TEST_VERIFY_URL = "https://techclip.app/verify?token=xyz789";
const TEST_APP_URL = "https://techclip.app";

/** XSS テスト用文字列 */
const XSS_USER_NAME = '<img src=x onerror="alert(1)">';
const XSS_VERIFY_URL = 'https://example.com/verify?token=abc&redirect="><script>alert(1)</script>';

describe("buildEmailVerificationHtml", () => {
  describe("基本構造", () => {
    it("完全な HTML ドキュメントを生成できること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(TEST_USER_NAME, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
    });

    it("プリヘッダーテキストが含まれること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(TEST_USER_NAME, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("アカウント作成ありがとうございます");
    });

    it("TechClip ブランドヘッダーが含まれること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(TEST_USER_NAME, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("TechClip");
    });
  });

  describe("コンテンツ", () => {
    it("ユーザー名が含まれること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(TEST_USER_NAME, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain(TEST_USER_NAME);
    });

    it("認証 URL が CTA ボタンとして含まれること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(TEST_USER_NAME, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain(TEST_VERIFY_URL);
      expect(html).toContain("メールアドレスを認証");
    });

    it("24時間有効の文言が含まれること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(TEST_USER_NAME, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("24時間");
    });

    it("機能紹介が含まれること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(TEST_USER_NAME, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("技術記事をワンタップで保存");
      expect(html).toContain("AI で要約・翻訳");
      expect(html).toContain("オフラインで読める");
    });

    it("フッターが含まれること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(TEST_USER_NAME, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("送信専用");
    });

    it("通知設定リンクにアプリ URL が使われること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(TEST_USER_NAME, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain(`${TEST_APP_URL}/settings/notifications`);
    });
  });

  describe("XSS 対策", () => {
    it("ユーザー名の script タグがエスケープされること", () => {
      // Arrange
      const xssName = '<script>alert("xss")</script>';

      // Act
      const html = buildEmailVerificationHtml(xssName, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("ユーザー名の img タグがエスケープされること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(XSS_USER_NAME, TEST_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;img");
      expect(html).toContain("&quot;alert(1)&quot;");
    });

    it("認証 URL の script タグがエスケープされること", () => {
      // Arrange & Act
      const html = buildEmailVerificationHtml(TEST_USER_NAME, XSS_VERIFY_URL, TEST_APP_URL);

      // Assert
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("件名", () => {
    it("件名にメールアドレスの文言が含まれること", () => {
      // Arrange & Act
      const subject = getEmailVerificationSubject();

      // Assert
      expect(subject).toContain("メールアドレス");
    });

    it("件名に TechClip が含まれること", () => {
      // Arrange & Act
      const subject = getEmailVerificationSubject();

      // Assert
      expect(subject).toContain("TechClip");
    });
  });
});
