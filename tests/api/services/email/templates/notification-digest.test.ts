import {
  buildNotificationDigestHtml,
  getNotificationDigestPreheader,
  getNotificationDigestSubject,
} from "@api/services/email/templates/notification-digest";
import type { NotificationItem } from "@api/services/emailService";
import { describe, expect, it } from "vitest";

/** テスト用定数 */
const TEST_USER_NAME = "テストユーザー";
const TEST_APP_URL = "https://techclip.app";

/** テスト用通知リスト */
const TEST_NOTIFICATIONS: NotificationItem[] = [
  { title: "新着記事", body: "TypeScriptの新機能について" },
  { title: "フォロー通知", body: "テストユーザーさんがフォローしました" },
];

/** XSS テスト用通知 */
const XSS_NOTIFICATIONS: NotificationItem[] = [
  {
    title: '<script>alert("xss")</script>',
    body: '<img src=x onerror="alert(1)">',
  },
];

describe("buildNotificationDigestHtml", () => {
  describe("基本構造", () => {
    it("完全な HTML ドキュメントを生成できること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, TEST_NOTIFICATIONS, TEST_APP_URL);

      // Assert
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
    });

    it("TechClip ブランドヘッダーが含まれること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, TEST_NOTIFICATIONS, TEST_APP_URL);

      // Assert
      expect(html).toContain("TechClip");
    });

    it("フッターが含まれること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, TEST_NOTIFICATIONS, TEST_APP_URL);

      // Assert
      expect(html).toContain("送信専用");
    });
  });

  describe("コンテンツ（通知あり）", () => {
    it("ユーザー名が含まれること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, TEST_NOTIFICATIONS, TEST_APP_URL);

      // Assert
      expect(html).toContain(TEST_USER_NAME);
    });

    it("各通知タイトルが含まれること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, TEST_NOTIFICATIONS, TEST_APP_URL);

      // Assert
      for (const notification of TEST_NOTIFICATIONS) {
        expect(html).toContain(notification.title);
      }
    });

    it("各通知本文が含まれること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, TEST_NOTIFICATIONS, TEST_APP_URL);

      // Assert
      for (const notification of TEST_NOTIFICATIONS) {
        expect(html).toContain(notification.body);
      }
    });

    it("CTA ボタンのリンクにアプリ URL が使われること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, TEST_NOTIFICATIONS, TEST_APP_URL);

      // Assert
      expect(html).toContain(`${TEST_APP_URL}/notifications`);
      expect(html).toContain("アプリで確認する");
    });

    it("通知設定リンクが含まれること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, TEST_NOTIFICATIONS, TEST_APP_URL);

      // Assert
      expect(html).toContain(`${TEST_APP_URL}/settings/notifications`);
    });
  });

  describe("コンテンツ（通知なし）", () => {
    it("通知が空配列の場合でも HTML を生成できること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, [], TEST_APP_URL);

      // Assert
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain(TEST_USER_NAME);
    });

    it("通知が空配列の場合に空メッセージが表示されること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, [], TEST_APP_URL);

      // Assert
      expect(html).toContain("新しい通知はありません");
    });
  });

  describe("XSS 対策", () => {
    it("通知タイトルの script タグがエスケープされること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, XSS_NOTIFICATIONS, TEST_APP_URL);

      // Assert
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("通知本文の img タグがエスケープされること", () => {
      // Arrange & Act
      const html = buildNotificationDigestHtml(TEST_USER_NAME, XSS_NOTIFICATIONS, TEST_APP_URL);

      // Assert
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;img");
      expect(html).toContain("&quot;alert(1)&quot;");
    });
  });

  describe("件名・プリヘッダー", () => {
    it("件名に通知の文言が含まれること", () => {
      // Arrange & Act
      const subject = getNotificationDigestSubject();

      // Assert
      expect(subject).toContain("通知");
    });

    it("通知件数が N 件の場合プリヘッダーに件数が含まれること", () => {
      // Arrange & Act
      const preheader = getNotificationDigestPreheader(5);

      // Assert
      expect(preheader).toContain("5");
      expect(preheader).toContain("件");
    });

    it("通知が 0 件の場合プリヘッダーにデフォルト文言が含まれること", () => {
      // Arrange & Act
      const preheader = getNotificationDigestPreheader(0);

      // Assert
      expect(preheader).toContain("通知");
      expect(preheader).not.toContain("0 件");
    });
  });
});
