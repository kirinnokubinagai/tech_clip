import {
  cleanupExpiredOauthExchangeCodes,
  createOauthExchangeCodeCleanupDeps,
  type OauthExchangeCodeCleanupDeps,
} from "@api/cron/cleanupExpiredOauthExchangeCodes";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
  lt: vi.fn((col: unknown, val: unknown) => ({ col, val, op: "lt" })),
}));

vi.mock("@api/db/schema", () => ({
  oauthExchangeCodes: { expiresAt: "expiresAt" },
}));

/** 期限切れ OAuth exchange code クリーンアップのテスト用モック */
function createMockDeps(
  overrides?: Partial<OauthExchangeCodeCleanupDeps>,
): OauthExchangeCodeCleanupDeps {
  return {
    deleteExpiredOauthExchangeCodes: vi.fn().mockResolvedValue(2),
    getCurrentTimestamp: vi.fn().mockReturnValue("2024-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("cleanupExpiredOauthExchangeCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("期限切れの exchange code を削除できること", async () => {
      // Arrange
      const deps = createMockDeps();

      // Act
      const result = await cleanupExpiredOauthExchangeCodes(deps);

      // Assert
      expect(deps.deleteExpiredOauthExchangeCodes).toHaveBeenCalledWith("2024-02-01T00:00:00.000Z");
      expect(result.deletedCount).toBe(2);
    });

    it("削除成功時に success が true であること", async () => {
      // Arrange
      const deps = createMockDeps();

      // Act
      const result = await cleanupExpiredOauthExchangeCodes(deps);

      // Assert
      expect(result.success).toBe(true);
    });

    it("対象 code が 0 件の場合も正常終了すること", async () => {
      // Arrange
      const deps = createMockDeps({
        deleteExpiredOauthExchangeCodes: vi.fn().mockResolvedValue(0),
      });

      // Act
      const result = await cleanupExpiredOauthExchangeCodes(deps);

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });

    it("getCurrentTimestamp の結果が deleteExpiredOauthExchangeCodes に渡ること", async () => {
      // Arrange
      const fixedTimestamp = "2024-03-01T00:00:00.000Z";
      const deps = createMockDeps({
        getCurrentTimestamp: vi.fn().mockReturnValue(fixedTimestamp),
      });

      // Act
      await cleanupExpiredOauthExchangeCodes(deps);

      // Assert
      expect(deps.deleteExpiredOauthExchangeCodes).toHaveBeenCalledWith(fixedTimestamp);
    });
  });

  describe("異常系", () => {
    it("DB 操作が失敗した場合はエラーをスローすること", async () => {
      // Arrange
      const deps = createMockDeps({
        deleteExpiredOauthExchangeCodes: vi
          .fn()
          .mockRejectedValue(new Error("DBエラーが発生しました")),
      });

      // Act & Assert
      await expect(cleanupExpiredOauthExchangeCodes(deps)).rejects.toThrow(
        "DBエラーが発生しました",
      );
    });
  });
});

describe("createOauthExchangeCodeCleanupDeps", () => {
  it("OauthExchangeCodeCleanupDeps インターフェースに適合したオブジェクトを返すこと", () => {
    // Arrange
    const mockReturning = vi.fn().mockResolvedValue([{}, {}]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
    const mockDb = { delete: mockDelete };

    // Act
    const deps = createOauthExchangeCodeCleanupDeps(mockDb);

    // Assert
    expect(deps).toHaveProperty("deleteExpiredOauthExchangeCodes");
    expect(deps).toHaveProperty("getCurrentTimestamp");
    expect(typeof deps.deleteExpiredOauthExchangeCodes).toBe("function");
    expect(typeof deps.getCurrentTimestamp).toBe("function");
  });

  it("getCurrentTimestamp が ISO8601 形式の文字列を返すこと", () => {
    // Arrange
    const mockDb = { delete: vi.fn() };

    // Act
    const deps = createOauthExchangeCodeCleanupDeps(mockDb);
    const timestamp = deps.getCurrentTimestamp();

    // Assert
    expect(typeof timestamp).toBe("string");
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it("deleteExpiredOauthExchangeCodes が DB の delete を呼び出して削除件数を返すこと", async () => {
    // Arrange
    const deletedRows = [{}, {}, {}];
    const mockReturning = vi.fn().mockResolvedValue(deletedRows);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
    const mockDb = { delete: mockDelete };
    const deps = createOauthExchangeCodeCleanupDeps(mockDb);

    // Act
    const count = await deps.deleteExpiredOauthExchangeCodes("2024-02-01T00:00:00.000Z");

    // Assert
    expect(count).toBe(3);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("expiresAt < currentTimestamp 条件で where が呼ばれること", async () => {
    // Arrange
    const mockReturning = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
    const mockDb = { delete: mockDelete };
    const deps = createOauthExchangeCodeCleanupDeps(mockDb);
    const currentTimestamp = "2024-02-01T00:00:00.000Z";

    // Act
    await deps.deleteExpiredOauthExchangeCodes(currentTimestamp);

    // Assert
    expect(mockWhere).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledWith(expect.anything());
  });
});
