import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSubscriptionCheckDeps,
  disableExpiredSubscriptions,
  type SubscriptionCheckDeps,
} from "../../src/cron/subscriptionCheck";

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val, op: "eq" })),
  lt: vi.fn((col: unknown, val: unknown) => ({ col, val, op: "lt" })),
}));

vi.mock("../../src/db/schema", () => ({
  users: { isPremium: "isPremium", premiumExpiresAt: "premiumExpiresAt" },
}));

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

describe("createSubscriptionCheckDeps", () => {
  it("SubscriptionCheckDepsインターフェースに適合したオブジェクトを返すこと", () => {
    // Arrange
    const mockDb = { update: vi.fn() };

    // Act
    const deps = createSubscriptionCheckDeps(mockDb);

    // Assert
    expect(deps).toHaveProperty("disableExpiredPremiumUsers");
    expect(deps).toHaveProperty("getCurrentTimestamp");
    expect(typeof deps.disableExpiredPremiumUsers).toBe("function");
    expect(typeof deps.getCurrentTimestamp).toBe("function");
  });

  it("getCurrentTimestampがISO8601形式の文字列を返すこと", () => {
    // Arrange
    const mockDb = { update: vi.fn() };

    // Act
    const deps = createSubscriptionCheckDeps(mockDb);
    const timestamp = deps.getCurrentTimestamp();

    // Assert
    expect(typeof timestamp).toBe("string");
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it("disableExpiredPremiumUsersがDBのupdateを呼び出して更新件数を返すこと", async () => {
    // Arrange
    const updatedRows = [{}, {}];
    const mockReturning = vi.fn().mockResolvedValue(updatedRows);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const mockDb = { update: mockUpdate };
    const deps = createSubscriptionCheckDeps(mockDb);

    // Act
    const count = await deps.disableExpiredPremiumUsers({
      isPremium: false,
      currentTimestamp: "2024-02-01T00:00:00.000Z",
    });

    // Assert
    expect(count).toBe(2);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ isPremium: false });
  });
});
