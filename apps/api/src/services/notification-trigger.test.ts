import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFollowNotification,
  createSummaryCompleteNotification,
} from "./notification-trigger";

/** テスト用ユーザーID */
const FOLLOWER_USER_ID = "user_follower_01";

/** テスト用フォロー対象ユーザーID */
const FOLLOWING_USER_ID = "user_following_01";

/** テスト用記事ID */
const TEST_ARTICLE_ID = "article_test_01";

/** テスト用要約ID */
const TEST_SUMMARY_ID = "summary_test_01";

/** テスト用フォロワー名 */
const FOLLOWER_NAME = "テストフォロワー";

/** テスト用記事タイトル */
const TEST_ARTICLE_TITLE = "テスト記事タイトル";

/** モックの db.insert クエリ結果 */
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({
  returning: mockInsertReturning,
});
const mockInsert = vi.fn().mockReturnValue({
  values: mockInsertValues,
});

/** モックのDBインスタンス */
const mockDb = {
  insert: mockInsert,
};

describe("notification-trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createFollowNotification", () => {
    it("フォロー時に通知レコードが作成されること", async () => {
      // Arrange
      const mockNotification = {
        id: "notif_001",
        userId: FOLLOWING_USER_ID,
        type: "follow",
        title: "新しいフォロワー",
        body: `${FOLLOWER_NAME}さんがあなたをフォローしました`,
        isRead: false,
        data: JSON.stringify({ followerId: FOLLOWER_USER_ID }),
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      mockInsertReturning.mockResolvedValue([mockNotification]);

      // Act
      const result = await createFollowNotification({
        db: mockDb as never,
        followerId: FOLLOWER_USER_ID,
        followingId: FOLLOWING_USER_ID,
        followerName: FOLLOWER_NAME,
      });

      // Assert
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        userId: FOLLOWING_USER_ID,
        type: "follow",
      });
    });

    it("通知のtypeがfollowであること", async () => {
      // Arrange
      const mockNotification = {
        id: "notif_001",
        userId: FOLLOWING_USER_ID,
        type: "follow",
        title: "新しいフォロワー",
        body: `${FOLLOWER_NAME}さんがあなたをフォローしました`,
        isRead: false,
        data: JSON.stringify({ followerId: FOLLOWER_USER_ID }),
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      mockInsertReturning.mockResolvedValue([mockNotification]);

      // Act
      await createFollowNotification({
        db: mockDb as never,
        followerId: FOLLOWER_USER_ID,
        followingId: FOLLOWING_USER_ID,
        followerName: FOLLOWER_NAME,
      });

      // Assert
      const insertedValues = mockInsertValues.mock.calls[0][0];
      expect(insertedValues.type).toBe("follow");
      expect(insertedValues.userId).toBe(FOLLOWING_USER_ID);
    });

    it("通知のtitleが正しいこと", async () => {
      // Arrange
      const mockNotification = {
        id: "notif_001",
        userId: FOLLOWING_USER_ID,
        type: "follow",
        title: "新しいフォロワー",
        body: `${FOLLOWER_NAME}さんがあなたをフォローしました`,
        isRead: false,
        data: JSON.stringify({ followerId: FOLLOWER_USER_ID }),
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      mockInsertReturning.mockResolvedValue([mockNotification]);

      // Act
      await createFollowNotification({
        db: mockDb as never,
        followerId: FOLLOWER_USER_ID,
        followingId: FOLLOWING_USER_ID,
        followerName: FOLLOWER_NAME,
      });

      // Assert
      const insertedValues = mockInsertValues.mock.calls[0][0];
      expect(insertedValues.title).toBe("新しいフォロワー");
    });

    it("通知のbodyにフォロワー名が含まれること", async () => {
      // Arrange
      const mockNotification = {
        id: "notif_001",
        userId: FOLLOWING_USER_ID,
        type: "follow",
        title: "新しいフォロワー",
        body: `${FOLLOWER_NAME}さんがあなたをフォローしました`,
        isRead: false,
        data: JSON.stringify({ followerId: FOLLOWER_USER_ID }),
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      mockInsertReturning.mockResolvedValue([mockNotification]);

      // Act
      await createFollowNotification({
        db: mockDb as never,
        followerId: FOLLOWER_USER_ID,
        followingId: FOLLOWING_USER_ID,
        followerName: FOLLOWER_NAME,
      });

      // Assert
      const insertedValues = mockInsertValues.mock.calls[0][0];
      expect(insertedValues.body).toContain(FOLLOWER_NAME);
    });

    it("通知のdataにfolloweIdが含まれること", async () => {
      // Arrange
      const mockNotification = {
        id: "notif_001",
        userId: FOLLOWING_USER_ID,
        type: "follow",
        title: "新しいフォロワー",
        body: `${FOLLOWER_NAME}さんがあなたをフォローしました`,
        isRead: false,
        data: JSON.stringify({ followerId: FOLLOWER_USER_ID }),
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      mockInsertReturning.mockResolvedValue([mockNotification]);

      // Act
      await createFollowNotification({
        db: mockDb as never,
        followerId: FOLLOWER_USER_ID,
        followingId: FOLLOWING_USER_ID,
        followerName: FOLLOWER_NAME,
      });

      // Assert
      const insertedValues = mockInsertValues.mock.calls[0][0];
      const parsedData = JSON.parse(insertedValues.data);
      expect(parsedData.followerId).toBe(FOLLOWER_USER_ID);
    });

    it("followerNameが未指定の場合デフォルト名が使われること", async () => {
      // Arrange
      const mockNotification = {
        id: "notif_001",
        userId: FOLLOWING_USER_ID,
        type: "follow",
        title: "新しいフォロワー",
        body: "ユーザーさんがあなたをフォローしました",
        isRead: false,
        data: JSON.stringify({ followerId: FOLLOWER_USER_ID }),
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      mockInsertReturning.mockResolvedValue([mockNotification]);

      // Act
      await createFollowNotification({
        db: mockDb as never,
        followerId: FOLLOWER_USER_ID,
        followingId: FOLLOWING_USER_ID,
      });

      // Assert
      const insertedValues = mockInsertValues.mock.calls[0][0];
      expect(insertedValues.body).toContain("ユーザー");
    });
  });

  describe("createSummaryCompleteNotification", () => {
    it("要約完了時に通知レコードが作成されること", async () => {
      // Arrange
      const mockNotification = {
        id: "notif_002",
        userId: FOLLOWER_USER_ID,
        type: "summary_complete",
        title: "要約が完了しました",
        body: `「${TEST_ARTICLE_TITLE}」の要約が完了しました`,
        isRead: false,
        data: JSON.stringify({
          articleId: TEST_ARTICLE_ID,
          summaryId: TEST_SUMMARY_ID,
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      mockInsertReturning.mockResolvedValue([mockNotification]);

      // Act
      const result = await createSummaryCompleteNotification({
        db: mockDb as never,
        userId: FOLLOWER_USER_ID,
        articleId: TEST_ARTICLE_ID,
        articleTitle: TEST_ARTICLE_TITLE,
        summaryId: TEST_SUMMARY_ID,
      });

      // Assert
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        userId: FOLLOWER_USER_ID,
        type: "summary_complete",
      });
    });

    it("通知のtypeがsummary_completeであること", async () => {
      // Arrange
      const mockNotification = {
        id: "notif_002",
        userId: FOLLOWER_USER_ID,
        type: "summary_complete",
        title: "要約が完了しました",
        body: `「${TEST_ARTICLE_TITLE}」の要約が完了しました`,
        isRead: false,
        data: JSON.stringify({
          articleId: TEST_ARTICLE_ID,
          summaryId: TEST_SUMMARY_ID,
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      mockInsertReturning.mockResolvedValue([mockNotification]);

      // Act
      await createSummaryCompleteNotification({
        db: mockDb as never,
        userId: FOLLOWER_USER_ID,
        articleId: TEST_ARTICLE_ID,
        articleTitle: TEST_ARTICLE_TITLE,
        summaryId: TEST_SUMMARY_ID,
      });

      // Assert
      const insertedValues = mockInsertValues.mock.calls[0][0];
      expect(insertedValues.type).toBe("summary_complete");
    });

    it("通知のbodyに記事タイトルが含まれること", async () => {
      // Arrange
      const mockNotification = {
        id: "notif_002",
        userId: FOLLOWER_USER_ID,
        type: "summary_complete",
        title: "要約が完了しました",
        body: `「${TEST_ARTICLE_TITLE}」の要約が完了しました`,
        isRead: false,
        data: JSON.stringify({
          articleId: TEST_ARTICLE_ID,
          summaryId: TEST_SUMMARY_ID,
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      mockInsertReturning.mockResolvedValue([mockNotification]);

      // Act
      await createSummaryCompleteNotification({
        db: mockDb as never,
        userId: FOLLOWER_USER_ID,
        articleId: TEST_ARTICLE_ID,
        articleTitle: TEST_ARTICLE_TITLE,
        summaryId: TEST_SUMMARY_ID,
      });

      // Assert
      const insertedValues = mockInsertValues.mock.calls[0][0];
      expect(insertedValues.body).toContain(TEST_ARTICLE_TITLE);
    });

    it("通知のdataにarticleIdとsummaryIdが含まれること", async () => {
      // Arrange
      const mockNotification = {
        id: "notif_002",
        userId: FOLLOWER_USER_ID,
        type: "summary_complete",
        title: "要約が完了しました",
        body: `「${TEST_ARTICLE_TITLE}」の要約が完了しました`,
        isRead: false,
        data: JSON.stringify({
          articleId: TEST_ARTICLE_ID,
          summaryId: TEST_SUMMARY_ID,
        }),
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      mockInsertReturning.mockResolvedValue([mockNotification]);

      // Act
      await createSummaryCompleteNotification({
        db: mockDb as never,
        userId: FOLLOWER_USER_ID,
        articleId: TEST_ARTICLE_ID,
        articleTitle: TEST_ARTICLE_TITLE,
        summaryId: TEST_SUMMARY_ID,
      });

      // Assert
      const insertedValues = mockInsertValues.mock.calls[0][0];
      const parsedData = JSON.parse(insertedValues.data);
      expect(parsedData.articleId).toBe(TEST_ARTICLE_ID);
      expect(parsedData.summaryId).toBe(TEST_SUMMARY_ID);
    });
  });
});
