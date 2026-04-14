import {
  cleanupExpiredRefreshTokens,
  createRefreshTokenCleanupDeps,
  type RefreshTokenCleanupDeps,
} from "@api/cron/cleanupExpiredRefreshTokens";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
  lt: vi.fn((col: unknown, val: unknown) => ({ col, val, op: "lt" })),
}));

vi.mock("@api/db/schema", () => ({
  refreshTokens: { expiresAt: "expiresAt" },
}));

/** 期限切れリフレッシュトークンクリーンアップのテスト用モック */
function createMockDeps(overrides?: Partial<RefreshTokenCleanupDeps>): RefreshTokenCleanupDeps {
  return {
    deleteExpiredRefreshTokens: vi.fn().mockResolvedValue(3),
    getCurrentTimestamp: vi.fn().mockReturnValue("2024-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("cleanupExpiredRefreshTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("期限切れのトークンを削除できること", async () => {
      // Arrange
      const deps = createMockDeps();

      // Act
      const result = await cleanupExpiredRefreshTokens(deps);

      // Assert
      expect(deps.deleteExpiredRefreshTokens).toHaveBeenCalledWith("2024-02-01T00:00:00.000Z");
      expect(result.deletedCount).toBe(3);
    });

    it("削除成功時にsuccessがtrueであること", async () => {
      // Arrange
      const deps = createMockDeps();

      // Act
      const result = await cleanupExpiredRefreshTokens(deps);

      // Assert
      expect(result.success).toBe(true);
    });

    it("対象トークンが0件の場合も正常終了すること", async () => {
      // Arrange
      const deps = createMockDeps({
        deleteExpiredRefreshTokens: vi.fn().mockResolvedValue(0),
      });

      // Act
      const result = await cleanupExpiredRefreshTokens(deps);

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });

    it("getCurrentTimestampの結果がdeleteExpiredRefreshTokensに渡ること", async () => {
      // Arrange
      const fixedTimestamp = "2024-03-01T00:00:00.000Z";
      const deps = createMockDeps({
        getCurrentTimestamp: vi.fn().mockReturnValue(fixedTimestamp),
      });

      // Act
      await cleanupExpiredRefreshTokens(deps);

      // Assert
      expect(deps.deleteExpiredRefreshTokens).toHaveBeenCalledWith(fixedTimestamp);
    });
  });

  describe("異常系", () => {
    it("DB操作が失敗した場合はエラーをスローすること", async () => {
      // Arrange
      const deps = createMockDeps({
        deleteExpiredRefreshTokens: vi.fn().mockRejectedValue(new Error("DBエラーが発生しました")),
      });

      // Act & Assert
      await expect(cleanupExpiredRefreshTokens(deps)).rejects.toThrow("DBエラーが発生しました");
    });
  });
});

describe("createRefreshTokenCleanupDeps", () => {
  it("RefreshTokenCleanupDepsインターフェースに適合したオブジェクトを返すこと", () => {
    // Arrange
    const mockReturning = vi.fn().mockResolvedValue([{}, {}]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
    const mockDb = { delete: mockDelete };

    // Act
    const deps = createRefreshTokenCleanupDeps(mockDb);

    // Assert
    expect(deps).toHaveProperty("deleteExpiredRefreshTokens");
    expect(deps).toHaveProperty("getCurrentTimestamp");
    expect(typeof deps.deleteExpiredRefreshTokens).toBe("function");
    expect(typeof deps.getCurrentTimestamp).toBe("function");
  });

  it("getCurrentTimestampがISO8601形式の文字列を返すこと", () => {
    // Arrange
    const mockDb = { delete: vi.fn() };

    // Act
    const deps = createRefreshTokenCleanupDeps(mockDb);
    const timestamp = deps.getCurrentTimestamp();

    // Assert
    expect(typeof timestamp).toBe("string");
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it("deleteExpiredRefreshTokensがDBのdeleteを呼び出して削除件数を返すこと", async () => {
    // Arrange
    const deletedRows = [{}, {}, {}];
    const mockReturning = vi.fn().mockResolvedValue(deletedRows);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
    const mockDb = { delete: mockDelete };
    const deps = createRefreshTokenCleanupDeps(mockDb);

    // Act
    const count = await deps.deleteExpiredRefreshTokens("2024-02-01T00:00:00.000Z");

    // Assert
    expect(count).toBe(3);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("expiresAt < currentTimestamp 条件でwhereが呼ばれること", async () => {
    // Arrange
    const mockReturning = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
    const mockDb = { delete: mockDelete };
    const deps = createRefreshTokenCleanupDeps(mockDb);
    const currentTimestamp = "2024-02-01T00:00:00.000Z";

    // Act
    await deps.deleteExpiredRefreshTokens(currentTimestamp);

    // Assert（whereが呼ばれたことを確認する）
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledWith(expect.anything());
  });
});
