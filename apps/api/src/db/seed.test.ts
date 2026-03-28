import { describe, expect, it } from "vitest";
import {
  buildArticleData,
  buildFollowData,
  buildNotificationData,
  buildSummaryData,
  buildTagData,
  buildTranslationData,
  buildUserData,
} from "./seed";

describe("seed", () => {
  describe("buildUserData", () => {
    it("有効なユーザーデータを返すこと", () => {
      // Arrange
      const index = 0;

      // Act
      const user = buildUserData(index);

      // Assert
      expect(user.id).toBeDefined();
      expect(user.email).toBe("seed-user-0@example.com");
      expect(user.name).toBe("シードユーザー0");
      expect(user.username).toBe("seed_user_0");
      expect(user.emailVerified).toBe(true);
    });

    it("インデックスに応じて異なるメールアドレスを返すこと", () => {
      // Arrange & Act
      const user1 = buildUserData(1);
      const user2 = buildUserData(2);

      // Assert
      expect(user1.email).toBe("seed-user-1@example.com");
      expect(user2.email).toBe("seed-user-2@example.com");
      expect(user1.id).not.toBe(user2.id);
    });
  });

  describe("buildArticleData", () => {
    it("有効な記事データを返すこと", () => {
      // Arrange
      const userId = "test-user-id";
      const index = 0;

      // Act
      const article = buildArticleData(userId, index);

      // Assert
      expect(article.id).toBeDefined();
      expect(article.userId).toBe(userId);
      expect(article.url).toContain("https://");
      expect(article.title).toBeDefined();
      expect(article.source).toBeDefined();
      expect(article.createdAt).toBeInstanceOf(Date);
      expect(article.updatedAt).toBeInstanceOf(Date);
    });

    it("インデックスに応じて異なるURLを返すこと", () => {
      // Arrange
      const userId = "test-user-id";

      // Act
      const article1 = buildArticleData(userId, 0);
      const article2 = buildArticleData(userId, 1);

      // Assert
      expect(article1.url).not.toBe(article2.url);
    });
  });

  describe("buildTagData", () => {
    it("有効なタグデータを返すこと", () => {
      // Arrange
      const userId = "test-user-id";
      const index = 0;

      // Act
      const tag = buildTagData(userId, index);

      // Assert
      expect(tag.id).toBeDefined();
      expect(tag.userId).toBe(userId);
      expect(tag.name).toBeDefined();
      expect(tag.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("buildSummaryData", () => {
    it("有効なサマリーデータを返すこと", () => {
      // Arrange
      const articleId = "test-article-id";

      // Act
      const summary = buildSummaryData(articleId);

      // Assert
      expect(summary.id).toBeDefined();
      expect(summary.articleId).toBe(articleId);
      expect(summary.language).toBe("ja");
      expect(summary.summary).toBeDefined();
      expect(summary.model).toBeDefined();
      expect(summary.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("buildTranslationData", () => {
    it("有効な翻訳データを返すこと", () => {
      // Arrange
      const articleId = "test-article-id";

      // Act
      const translation = buildTranslationData(articleId);

      // Assert
      expect(translation.id).toBeDefined();
      expect(translation.articleId).toBe(articleId);
      expect(translation.targetLanguage).toBe("en");
      expect(translation.translatedTitle).toBeDefined();
      expect(translation.translatedContent).toBeDefined();
      expect(translation.model).toBeDefined();
      expect(translation.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("buildFollowData", () => {
    it("有効なフォローデータを返すこと", () => {
      // Arrange
      const followerId = "follower-id";
      const followingId = "following-id";

      // Act
      const follow = buildFollowData(followerId, followingId);

      // Assert
      expect(follow.followerId).toBe(followerId);
      expect(follow.followingId).toBe(followingId);
    });
  });

  describe("buildNotificationData", () => {
    it("有効な通知データを返すこと", () => {
      // Arrange
      const userId = "test-user-id";
      const index = 0;

      // Act
      const notification = buildNotificationData(userId, index);

      // Assert
      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe(userId);
      expect(notification.type).toBeDefined();
      expect(notification.title).toBeDefined();
      expect(notification.body).toBeDefined();
    });
  });
});
