import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type MonthlyResetDeps,
  createMonthlyResetDeps,
  resetFreeAiUsesMonthly,
} from "../../src/cron/monthlyReset";

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val, op: "eq" })),
}));

vi.mock("../../src/db/schema", () => ({
  users: { isPremium: "isPremium", freeAiUsesRemaining: "freeAiUsesRemaining" },
}));

/** フリーAI使用回数リセットのテスト用モック */
function createMockDeps(overrides?: Partial<MonthlyResetDeps>): MonthlyResetDeps {
  return {
    resetFreeUsers: vi.fn().mockResolvedValue(3),
    getCurrentTimestamp: vi.fn().mockReturnValue("2024-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("resetFreeAiUsesMonthly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("フリーユーザーのfreeAiUsesRemainingを5にリセットできること", async () => {
      // Arrange
      const deps = createMockDeps();

      // Act
      const result = await resetFreeAiUsesMonthly(deps);

      // Assert
      expect(deps.resetFreeUsers).toHaveBeenCalledWith({
        freeAiUsesRemaining: 5,
        freeAiResetAt: "2024-02-01T00:00:00.000Z",
      });
      expect(result.updatedCount).toBe(3);
    });

    it("リセット成功時にsuccessがtrueであること", async () => {
      // Arrange
      const deps = createMockDeps();

      // Act
      const result = await resetFreeAiUsesMonthly(deps);

      // Assert
      expect(result.success).toBe(true);
    });

    it("対象ユーザーが0人の場合も正常終了すること", async () => {
      // Arrange
      const deps = createMockDeps({
        resetFreeUsers: vi.fn().mockResolvedValue(0),
      });

      // Act
      const result = await resetFreeAiUsesMonthly(deps);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(0);
    });

    it("freeAiResetAtに現在時刻が設定されること", async () => {
      // Arrange
      const fixedTimestamp = "2024-03-01T00:00:00.000Z";
      const deps = createMockDeps({
        getCurrentTimestamp: vi.fn().mockReturnValue(fixedTimestamp),
      });

      // Act
      await resetFreeAiUsesMonthly(deps);

      // Assert
      expect(deps.resetFreeUsers).toHaveBeenCalledWith(
        expect.objectContaining({ freeAiResetAt: fixedTimestamp }),
      );
    });
  });

  describe("異常系", () => {
    it("DB操作が失敗した場合はエラーをスローすること", async () => {
      // Arrange
      const deps = createMockDeps({
        resetFreeUsers: vi.fn().mockRejectedValue(new Error("DBエラーが発生しました")),
      });

      // Act & Assert
      await expect(resetFreeAiUsesMonthly(deps)).rejects.toThrow("DBエラーが発生しました");
    });
  });
});

describe("createMonthlyResetDeps", () => {
  it("MonthlyResetDepsインターフェースに適合したオブジェクトを返すこと", () => {
    // Arrange
    const mockReturning = vi.fn().mockResolvedValue([{}, {}]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const mockDb = { update: mockUpdate };

    // Act
    const deps = createMonthlyResetDeps(mockDb);

    // Assert
    expect(deps).toHaveProperty("resetFreeUsers");
    expect(deps).toHaveProperty("getCurrentTimestamp");
    expect(typeof deps.resetFreeUsers).toBe("function");
    expect(typeof deps.getCurrentTimestamp).toBe("function");
  });

  it("getCurrentTimestampがISO8601形式の文字列を返すこと", () => {
    // Arrange
    const mockDb = { update: vi.fn() };

    // Act
    const deps = createMonthlyResetDeps(mockDb);
    const timestamp = deps.getCurrentTimestamp();

    // Assert
    expect(typeof timestamp).toBe("string");
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it("resetFreeUsersがDBのupdateを呼び出して更新件数を返すこと", async () => {
    // Arrange
    const updatedRows = [{}, {}, {}];
    const mockReturning = vi.fn().mockResolvedValue(updatedRows);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const mockDb = { update: mockUpdate };
    const deps = createMonthlyResetDeps(mockDb);

    // Act
    const count = await deps.resetFreeUsers({
      freeAiUsesRemaining: 5,
      freeAiResetAt: "2024-02-01T00:00:00.000Z",
    });

    // Assert
    expect(count).toBe(3);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({
      freeAiUsesRemaining: 5,
      freeAiResetAt: "2024-02-01T00:00:00.000Z",
    });
  });
});
