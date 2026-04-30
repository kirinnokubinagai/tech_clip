import { buildEmailLayout } from "@api/services/email/layout";
import { describe, expect, it } from "vitest";

/** テスト用定数 */
const TEST_TITLE = "メールタイトル";
const TEST_PREHEADER = "これはプリヘッダーテキストです";
const TEST_CONTENT = "<p>メインコンテンツ</p>";
const TEST_APP_URL = "https://techclip.app";

describe("buildEmailLayout", () => {
  describe("基本構造", () => {
    it("完全な HTML ドキュメントを生成すること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
    });

    it("<head> タグを含むこと", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("<head>");
      expect(html).toContain("</head>");
    });

    it("<body> タグを含むこと", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("<body");
      expect(html).toContain("</body>");
    });
  });

  describe("title", () => {
    it("title パラメータが <title> タグに設定されること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain(`<title>${TEST_TITLE}</title>`);
    });
  });

  describe("preheader", () => {
    it("preheader テキストが隠し div に含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain(TEST_PREHEADER);
    });

    it("preheader が display:none スタイルで非表示になっていること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("display:none");
    });
  });

  describe("content", () => {
    it("コンテンツが本文に含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain(TEST_CONTENT);
    });
  });

  describe("ヘッダー", () => {
    it("TechClip ブランド名がヘッダーに含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("TechClip");
    });

    it("ロゴ img タグが含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("<img");
      expect(html).toContain("TechClip ロゴ");
    });

    it("ヘッダーにプライマリカラーの背景が設定されること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("#0f766e");
    });
  });

  describe("フッター", () => {
    it("メール受信設定リンクが appUrl を含むこと", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain(`${TEST_APP_URL}/settings/notifications`);
    });

    it("フッターに著作権表示が含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("TechClip");
      expect(html).toContain("All rights reserved");
    });

    it("フッターに現在の年が含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      const currentYear = new Date().getFullYear().toString();
      expect(html).toContain(currentYear);
    });

    it("送信専用であることを示すテキストが含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("送信専用");
    });
  });

  describe("レスポンシブ対応", () => {
    it("viewport メタタグが含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("viewport");
      expect(html).toContain("width=device-width");
    });

    it("レスポンシブ用 CSS が含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("@media only screen");
      expect(html).toContain("max-width: 600px");
    });
  });

  describe("ダークモード対応", () => {
    it("prefers-color-scheme: dark のメディアクエリが含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("prefers-color-scheme: dark");
    });
  });

  describe("Outlook 互換", () => {
    it("Outlook 向け条件コメントが含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("[if mso]");
    });

    it("OfficeDocumentSettings が含まれること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain("OfficeDocumentSettings");
    });
  });

  describe("charset / lang", () => {
    it("UTF-8 charset が設定されること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain('charset="utf-8"');
    });

    it("html lang=ja が設定されること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: TEST_APP_URL,
      });

      // Assert
      expect(html).toContain('lang="ja"');
    });
  });

  describe("異なる appUrl", () => {
    it("別の appUrl でも正しくフッターリンクが生成されること", () => {
      // Arrange & Act
      const html = buildEmailLayout({
        title: TEST_TITLE,
        preheader: TEST_PREHEADER,
        content: TEST_CONTENT,
        appUrl: "https://staging.techclip.app",
      });

      // Assert
      expect(html).toContain("https://staging.techclip.app/settings/notifications");
    });
  });
});
