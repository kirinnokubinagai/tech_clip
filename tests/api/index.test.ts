import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResetFreeAiUsesMonthly = vi.fn().mockResolvedValue({ success: true });
const mockReconcileFailedRollbacks = vi.fn().mockResolvedValue({ success: true });
const mockCleanupExpiredRefreshTokens = vi.fn().mockResolvedValue({ success: true });
const mockDisableExpiredSubscriptions = vi.fn().mockResolvedValue({ success: true });
const mockCreateMonthlyResetDeps = vi.fn().mockReturnValue({});
const mockCreateReconcileFailedRollbacksDeps = vi.fn().mockReturnValue({});
const mockCreateRefreshTokenCleanupDeps = vi.fn().mockReturnValue({});
const mockCreateSubscriptionCheckDeps = vi.fn().mockReturnValue({});
const mockCreateDatabase = vi.fn().mockReturnValue({});
const mockCreateLogger = vi.fn().mockReturnValue({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

vi.mock("@api/cron/monthlyReset", () => ({
  resetFreeAiUsesMonthly: mockResetFreeAiUsesMonthly,
  createMonthlyResetDeps: mockCreateMonthlyResetDeps,
}));
vi.mock("@api/cron/reconcileFailedRollbacks", () => ({
  reconcileFailedRollbacks: mockReconcileFailedRollbacks,
  createReconcileFailedRollbacksDeps: mockCreateReconcileFailedRollbacksDeps,
}));
vi.mock("@api/cron/cleanupExpiredRefreshTokens", () => ({
  cleanupExpiredRefreshTokens: mockCleanupExpiredRefreshTokens,
  createRefreshTokenCleanupDeps: mockCreateRefreshTokenCleanupDeps,
}));
vi.mock("@api/cron/subscriptionCheck", () => ({
  disableExpiredSubscriptions: mockDisableExpiredSubscriptions,
  createSubscriptionCheckDeps: mockCreateSubscriptionCheckDeps,
}));
vi.mock("@api/db", () => ({
  createDatabase: mockCreateDatabase,
}));
vi.mock("@api/lib/logger", () => ({
  createLogger: mockCreateLogger,
}));

describe("scheduled handler cron ルーティング", () => {
  let scheduledHandler: (
    event: { cron: string },
    env: Record<string, unknown>,
    ctx: { waitUntil: (p: Promise<unknown>) => void },
  ) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import("@api/index");
    // default export の scheduled を取り出す
    const defaultExport = mod.default as Record<string, unknown>;
    scheduledHandler = defaultExport.scheduled as typeof scheduledHandler;
  });

  async function runScheduled(cron: string): Promise<void> {
    const waitUntilPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      },
    };
    await scheduledHandler({ cron }, {}, ctx);
    await Promise.all(waitUntilPromises);
  }

  it("月次 cron (0 0 1 * *) では resetFreeAiUsesMonthly が実行されること", async () => {
    // Arrange / Act
    await runScheduled("0 0 1 * *");

    // Assert
    expect(mockResetFreeAiUsesMonthly).toHaveBeenCalledTimes(1);
  });

  it("日次 cron (0 0 * * *) では resetFreeAiUsesMonthly が実行されないこと", async () => {
    // Arrange / Act
    await runScheduled("0 0 * * *");

    // Assert
    expect(mockResetFreeAiUsesMonthly).not.toHaveBeenCalled();
  });

  it("月次 cron でも reconcileFailedRollbacks は実行されること", async () => {
    // Arrange / Act
    await runScheduled("0 0 1 * *");

    // Assert
    expect(mockReconcileFailedRollbacks).toHaveBeenCalledTimes(1);
  });

  it("日次 cron では reconcileFailedRollbacks が実行されること", async () => {
    // Arrange / Act
    await runScheduled("0 0 * * *");

    // Assert
    expect(mockReconcileFailedRollbacks).toHaveBeenCalledTimes(1);
  });

  it("日次 cron では cleanupExpiredRefreshTokens が実行されること", async () => {
    // Arrange / Act
    await runScheduled("0 0 * * *");

    // Assert
    expect(mockCleanupExpiredRefreshTokens).toHaveBeenCalledTimes(1);
  });

  it("日次 cron では disableExpiredSubscriptions が実行されること", async () => {
    // Arrange / Act
    await runScheduled("0 0 * * *");

    // Assert
    expect(mockDisableExpiredSubscriptions).toHaveBeenCalledTimes(1);
  });
});
