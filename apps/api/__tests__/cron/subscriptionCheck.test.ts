import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type SubscriptionCheckDeps,
  disableExpiredSubscriptions,
} from "../../src/cron/subscriptionCheck";

/** サブスクリプションチェックのテスト用モック */
function createMockDeps(overrides?: Partial<SubscriptionCheckDeps>): SubscriptionCheckDeps {
  return {
    disableExpiredPremiumUsers: vi.fn().mockResolvedValue(2),
    getCurrentTimestamp: vi.fn().mockReturnValue("2024-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("disableExpiredSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("期限切れのプレミアムユーザーを無効化できること", async () => {
      // Arrange
      const deps = createMockDeps();

      // Act
      const result = await disableExpiredSubscriptions(deps);

      // Assert
      expect(deps.disableExpiredPremiumUsers).toHaveBeenCalledWith({
        isPremium: false,
        currentTimestamp: "2024-02-01T00:00:00.000Z",
      });
      expect(result.disabledCount).toBe(2);
    });

    it("処理成功時にsuccessがtrueであること", async () => {
      // Arrange
      const deps = createMockDeps();

      // Act
      const result = await disableExpiredSubscriptions(deps);

      // Assert
      expect(result.success).toBe(true);
    });

    it("期限切れユーザーが0人の場合も正常終了すること", async () => {
      // Arrange
      const deps = createMockDeps({
        disableExpiredPremiumUsers: vi.fn().mockResolvedValue(0),
      });

      // Act
      const result = await disableExpiredSubscriptions(deps);

      // Assert
      expect(result.success).toBe(true);
      expect(result.disabledCount).toBe(0);
    });

    it("現在時刻を使って期限切れ判定すること", async () => {
      // Arrange
      const fixedTimestamp = "2024-04-01T00:00:00.000Z";
      const deps = createMockDeps({
        getCurrentTimestamp: vi.fn().mockReturnValue(fixedTimestamp),
      });

      // Act
      await disableExpiredSubscriptions(deps);

      // Assert
      expect(deps.disableExpiredPremiumUsers).toHaveBeenCalledWith(
        expect.objectContaining({ currentTimestamp: fixedTimestamp }),
      );
    });
  });

  describe("異常系", () => {
    it("DB操作が失敗した場合はエラーをスローすること", async () => {
      // Arrange
      const deps = createMockDeps({
        disableExpiredPremiumUsers: vi.fn().mockRejectedValue(new Error("DBエラーが発生しました")),
      });

      // Act & Assert
      await expect(disableExpiredSubscriptions(deps)).rejects.toThrow("DBエラーが発生しました");
    });
  });
});
