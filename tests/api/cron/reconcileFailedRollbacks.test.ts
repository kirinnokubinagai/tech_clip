import {
  type ReconcileFailedRollbacksDeps,
  reconcileFailedRollbacks,
} from "@api/cron/reconcileFailedRollbacks";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用のモック deps を作成する */
function createMockDeps(
  overrides: Partial<ReconcileFailedRollbacksDeps> = {},
): ReconcileFailedRollbacksDeps {
  return {
    fetchUnresolvedFailures: vi.fn().mockResolvedValue([]),
    compensateAndMarkResolved: vi.fn().mockResolvedValue(undefined),
    getCurrentTimestamp: vi.fn().mockReturnValue("2026-04-30T00:00:00.000Z"),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      withRequestId: vi.fn(),
    },
    ...overrides,
  };
}

describe("reconcileFailedRollbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未処理レコードが 0 件の場合 processedCount が 0 になること", async () => {
    // Arrange
    const deps = createMockDeps({
      fetchUnresolvedFailures: vi.fn().mockResolvedValue([]),
    });

    // Act
    const result = await reconcileFailedRollbacks(deps);

    // Assert
    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.success).toBe(true);
    expect(deps.compensateAndMarkResolved).not.toHaveBeenCalled();
  });

  it("未処理レコード 3 件すべてに補正が適用されること", async () => {
    // Arrange
    const failures = [
      { id: "failure-1", userId: "user-1" },
      { id: "failure-2", userId: "user-2" },
      { id: "failure-3", userId: "user-3" },
    ];
    const deps = createMockDeps({
      fetchUnresolvedFailures: vi.fn().mockResolvedValue(failures),
    });

    // Act
    const result = await reconcileFailedRollbacks(deps);

    // Assert
    expect(result.processedCount).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(result.success).toBe(true);
    expect(deps.compensateAndMarkResolved).toHaveBeenCalledTimes(3);
    expect(deps.compensateAndMarkResolved).toHaveBeenCalledWith(
      "user-1",
      "failure-1",
      "+1",
      "2026-04-30T00:00:00.000Z",
    );
    expect(deps.compensateAndMarkResolved).toHaveBeenCalledWith(
      "user-2",
      "failure-2",
      "+1",
      "2026-04-30T00:00:00.000Z",
    );
    expect(deps.compensateAndMarkResolved).toHaveBeenCalledWith(
      "user-3",
      "failure-3",
      "+1",
      "2026-04-30T00:00:00.000Z",
    );
  });

  it("適用後に resolved_at と applied_adjustment が打たれること", async () => {
    // Arrange
    const timestamp = "2026-04-30T00:00:00.000Z";
    const failures = [{ id: "failure-1", userId: "user-1" }];
    const deps = createMockDeps({
      fetchUnresolvedFailures: vi.fn().mockResolvedValue(failures),
      getCurrentTimestamp: vi.fn().mockReturnValue(timestamp),
    });

    // Act
    await reconcileFailedRollbacks(deps);

    // Assert
    expect(deps.compensateAndMarkResolved).toHaveBeenCalledWith(
      "user-1",
      "failure-1",
      "+1",
      timestamp,
    );
  });

  it("既に resolved_at が立っているレコードは対象外であること（fetchUnresolvedFailures が isNull で絞り込む）", async () => {
    // Arrange
    const deps = createMockDeps({
      fetchUnresolvedFailures: vi.fn().mockResolvedValue([]),
    });

    // Act
    await reconcileFailedRollbacks(deps);

    // Assert
    expect(deps.fetchUnresolvedFailures).toHaveBeenCalledTimes(1);
    expect(deps.compensateAndMarkResolved).not.toHaveBeenCalled();
  });

  it("1 件の補正失敗が他件に影響しないこと", async () => {
    // Arrange
    const failures = [
      { id: "failure-1", userId: "user-1" },
      { id: "failure-2", userId: "user-2" },
      { id: "failure-3", userId: "user-3" },
    ];
    const deps = createMockDeps({
      fetchUnresolvedFailures: vi.fn().mockResolvedValue(failures),
      compensateAndMarkResolved: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("補正失敗"))
        .mockResolvedValueOnce(undefined),
    });

    // Act
    const result = await reconcileFailedRollbacks(deps);

    // Assert
    expect(result.processedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.success).toBe(false);
    expect(deps.logger.error).toHaveBeenCalledTimes(1);
  });

  it("freeAiUsesRemaining が既に 5 の場合は 5 のまま (MIN キャップ) - compensateAndMarkResolved が MIN を管理すること", async () => {
    // Arrange
    const failures = [{ id: "failure-1", userId: "user-max" }];
    const deps = createMockDeps({
      fetchUnresolvedFailures: vi.fn().mockResolvedValue(failures),
      compensateAndMarkResolved: vi.fn().mockResolvedValue(undefined),
    });

    // Act
    const result = await reconcileFailedRollbacks(deps);

    // Assert
    // compensateAndMarkResolved が MIN(remaining+1, 5) の SQL を実行する責務を持つ
    expect(deps.compensateAndMarkResolved).toHaveBeenCalledWith(
      "user-max",
      "failure-1",
      "+1",
      "2026-04-30T00:00:00.000Z",
    );
    expect(result.processedCount).toBe(1);
  });

  it("compensateAndMarkResolved がアトミックに呼ばれること（補正と解決マーク同時失敗）", async () => {
    // Arrange
    const failures = [{ id: "failure-1", userId: "user-1" }];
    const deps = createMockDeps({
      fetchUnresolvedFailures: vi.fn().mockResolvedValue(failures),
      compensateAndMarkResolved: vi.fn().mockRejectedValue(new Error("トランザクション失敗")),
    });

    // Act
    const result = await reconcileFailedRollbacks(deps);

    // Assert
    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.success).toBe(false);
    expect(deps.logger.error).toHaveBeenCalledWith(
      "ロールバック失敗の補正に失敗しました",
      expect.objectContaining({
        failureId: "failure-1",
        error: "トランザクション失敗",
      }),
    );
  });
});
