import {
  buildPasswordResetHtml,
  getPasswordResetSubject,
} from "@api/services/email/templates/password-reset";
import { describe, expect, it } from "vitest";

/** テスト用定数 */
const TEST_USER_NAME = "テストユーザー";
const TEST_RESET_URL = "https://techclip.app/reset?token=abc123";
const TEST_APP_URL = "https://techclip.app";

/** XSS テスト用文字列 */
const XSS_USER_NAME = '<script>alert("xss")</script>';
const XSS_RESET_URL = 'https://example.com/reset?token=abc"onload="alert(1)';

describe("buildPasswordResetHtml", () => {
  describe("基本構造", () => {
    it("完全な HTML ドキュメントを生成できること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
      expect(html).toContain("<head>");
      expect(html).toContain("</head>");
      expect(html).toContain("<body");
      expect(html).toContain("</body>");
    });

    it("meta charset utf-8 が含まれること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain('charset="utf-8"');
    });

    it("meta viewport が含まれること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("viewport");
    });

    it("プリヘッダーテキストが含まれること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("パスワードリセット用のリンクをお送りします");
    });

    it("TechClip ブランドヘッダーが含まれること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("TechClip");
    });
  });

  describe("コンテンツ", () => {
    it("ユーザー名が含まれること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain(TEST_USER_NAME);
    });

    it("リセット URL が CTA ボタンとして含まれること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain(TEST_RESET_URL);
      expect(html).toContain("パスワードをリセット");
    });

    it("24時間有効の文言が含まれること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("24時間");
    });

    it("リクエストした覚えがない場合の注意文言が含まれること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("リクエストした覚えがない場合");
    });

    it("フッターが含まれること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain("送信専用");
      expect(html).toContain("TechClip");
    });

    it("通知設定リンクにアプリ URL が使われること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).toContain(`${TEST_APP_URL}/settings/notifications`);
    });
  });

  describe("XSS 対策", () => {
    it("ユーザー名の script タグがエスケープされること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(XSS_USER_NAME, TEST_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("リセット URL の二重引用符がエスケープされること", () => {
      // Arrange & Act
      const html = buildPasswordResetHtml(TEST_USER_NAME, XSS_RESET_URL, TEST_APP_URL);

      // Assert
      expect(html).not.toContain('"onload="');
      expect(html).toContain("&quot;");
    });
  });

  describe("件名", () => {
    it("件名にパスワードリセットの文言が含まれること", () => {
      // Arrange & Act
      const subject = getPasswordResetSubject();

      // Assert
      expect(subject).toContain("パスワードリセット");
    });
  });
});
