import { describe, expect, it } from "vitest";
import {
  buildEmailVerificationHtml,
  buildNotificationDigestHtml,
  buildPasswordResetHtml,
} from "./emailService";

describe("buildPasswordResetHtml", () => {
  describe("正常系", () => {
    it("ユーザー名とリセットURLを含むHTMLを生成できること", () => {
      // Arrange
      const userName = "テストユーザー";
      const resetUrl = "https://example.com/reset?token=abc";

      // Act
      const html = buildPasswordResetHtml(userName, resetUrl);

      // Assert
      expect(html).toContain("テストユーザー");
      expect(html).toContain("https://example.com/reset?token=abc");
    });
  });

  describe("XSS対策", () => {
    it("userNameに<script>タグが含まれる場合エスケープされること", () => {
      // Arrange
      const userName = '<script>alert("xss")</script>';
      const resetUrl = "https://example.com/reset?token=abc";

      // Act
      const html = buildPasswordResetHtml(userName, resetUrl);

      // Assert
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("userNameに&が含まれる場合エスケープされること", () => {
      // Arrange
      const userName = "Alice & Bob";
      const resetUrl = "https://example.com/reset?token=abc";

      // Act
      const html = buildPasswordResetHtml(userName, resetUrl);

      // Assert
      expect(html).not.toContain("Alice & Bob");
      expect(html).toContain("Alice &amp; Bob");
    });

    it('userNameに"が含まれる場合エスケープされること', () => {
      // Arrange
      const userName = 'user"name';
      const resetUrl = "https://example.com/reset?token=abc";

      // Act
      const html = buildPasswordResetHtml(userName, resetUrl);

      // Assert
      expect(html).not.toContain('"name');
      expect(html).toContain("&quot;name");
    });

    it("resetUrlに<script>タグが含まれる場合エスケープされること", () => {
      // Arrange
      const userName = "テストユーザー";
      const resetUrl = "https://example.com/reset?token=<script>alert(1)</script>";

      // Act
      const html = buildPasswordResetHtml(userName, resetUrl);

      // Assert
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });
});

describe("buildEmailVerificationHtml", () => {
  describe("正常系", () => {
    it("ユーザー名と認証URLを含むHTMLを生成できること", () => {
      // Arrange
      const userName = "テストユーザー";
      const verifyUrl = "https://example.com/verify?token=xyz";

      // Act
      const html = buildEmailVerificationHtml(userName, verifyUrl);

      // Assert
      expect(html).toContain("テストユーザー");
      expect(html).toContain("https://example.com/verify?token=xyz");
    });
  });

  describe("XSS対策", () => {
    it("userNameに<script>タグが含まれる場合エスケープされること", () => {
      // Arrange
      const userName = "<script>alert('xss')</script>";
      const verifyUrl = "https://example.com/verify?token=xyz";

      // Act
      const html = buildEmailVerificationHtml(userName, verifyUrl);

      // Assert
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("verifyUrlに悪意あるスクリプトが含まれる場合エスケープされること", () => {
      // Arrange
      const userName = "テストユーザー";
      const verifyUrl = "https://example.com/verify?token=<img src=x onerror=alert(1)>";

      // Act
      const html = buildEmailVerificationHtml(userName, verifyUrl);

      // Assert
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;img");
    });
  });
});

describe("buildNotificationDigestHtml", () => {
  describe("正常系", () => {
    it("ユーザー名と通知リストを含むHTMLを生成できること", () => {
      // Arrange
      const userName = "テストユーザー";
      const notifications = [{ title: "新着記事", body: "気になる記事が届きました" }];

      // Act
      const html = buildNotificationDigestHtml(userName, notifications);

      // Assert
      expect(html).toContain("テストユーザー");
      expect(html).toContain("新着記事");
      expect(html).toContain("気になる記事が届きました");
    });

    it("通知が複数ある場合すべて含まれること", () => {
      // Arrange
      const userName = "テストユーザー";
      const notifications = [
        { title: "記事1", body: "本文1" },
        { title: "記事2", body: "本文2" },
      ];

      // Act
      const html = buildNotificationDigestHtml(userName, notifications);

      // Assert
      expect(html).toContain("記事1");
      expect(html).toContain("記事2");
      expect(html).toContain("本文1");
      expect(html).toContain("本文2");
    });
  });

  describe("XSS対策", () => {
    it("userNameに<script>タグが含まれる場合エスケープされること", () => {
      // Arrange
      const userName = "<script>alert('xss')</script>";
      const notifications = [{ title: "通知", body: "本文" }];

      // Act
      const html = buildNotificationDigestHtml(userName, notifications);

      // Assert
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("通知タイトルに<script>タグが含まれる場合エスケープされること", () => {
      // Arrange
      const userName = "テストユーザー";
      const notifications = [{ title: "<script>alert('xss')</script>", body: "本文" }];

      // Act
      const html = buildNotificationDigestHtml(userName, notifications);

      // Assert
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("通知本文に<script>タグが含まれる場合エスケープされること", () => {
      // Arrange
      const userName = "テストユーザー";
      const notifications = [{ title: "タイトル", body: "<script>alert('xss')</script>" }];

      // Act
      const html = buildNotificationDigestHtml(userName, notifications);

      // Assert
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("通知タイトルの&がエスケープされること", () => {
      // Arrange
      const userName = "テストユーザー";
      const notifications = [{ title: "A & B", body: "本文" }];

      // Act
      const html = buildNotificationDigestHtml(userName, notifications);

      // Assert
      expect(html).not.toContain("A & B");
      expect(html).toContain("A &amp; B");
    });
  });
});
