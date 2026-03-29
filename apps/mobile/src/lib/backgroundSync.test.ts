jest.mock("./syncManager", () => ({
  syncArticles: jest.fn(),
}));

import { AppState } from "react-native";
import {
  DEFAULT_BACKGROUND_SYNC_CONFIG,
  createAppStateHandler,
  getLastSyncedAt,
  isSyncDue,
  resetBackgroundSyncState,
  startBackgroundSync,
} from "./backgroundSync";
import { syncArticles } from "./syncManager";

/** モック型キャスト */
const mockSyncArticles = jest.mocked(syncArticles);

/** AppState.addEventListener のスパイ */
let mockAddEventListener: jest.SpyInstance;

/** NativeEventSubscription モック */
function makeMockSubscription(): { remove: jest.Mock } {
  return { remove: jest.fn() };
}

describe("backgroundSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetBackgroundSyncState();
    mockAddEventListener = jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue(
        makeMockSubscription() as ReturnType<typeof AppState.addEventListener>,
      );
  });

  afterEach(() => {
    resetBackgroundSyncState();
  });

  describe("DEFAULT_BACKGROUND_SYNC_CONFIG", () => {
    it("デフォルト設定が15分間隔であること", () => {
      // Assert
      expect(DEFAULT_BACKGROUND_SYNC_CONFIG.intervalMs).toBe(15 * 60 * 1000);
    });

    it("デフォルト設定にタスク名が含まれること", () => {
      // Assert
      expect(DEFAULT_BACKGROUND_SYNC_CONFIG.taskName).toBe("BACKGROUND_SYNC_ARTICLES");
    });
  });

  describe("isSyncDue", () => {
    it("lastSyncedAtがnullの場合はtrueを返すこと", () => {
      // Act
      const result = isSyncDue(null, 15 * 60 * 1000);

      // Assert
      expect(result).toBe(true);
    });

    it("間隔が経過している場合はtrueを返すこと", () => {
      // Arrange
      const intervalMs = 15 * 60 * 1000;
      const lastSyncedAt = Date.now() - intervalMs - 1;

      // Act
      const result = isSyncDue(lastSyncedAt, intervalMs);

      // Assert
      expect(result).toBe(true);
    });

    it("間隔がちょうど経過した場合はtrueを返すこと", () => {
      // Arrange
      const intervalMs = 15 * 60 * 1000;
      const lastSyncedAt = Date.now() - intervalMs;

      // Act
      const result = isSyncDue(lastSyncedAt, intervalMs);

      // Assert
      expect(result).toBe(true);
    });

    it("間隔が経過していない場合はfalseを返すこと", () => {
      // Arrange
      const intervalMs = 15 * 60 * 1000;
      const lastSyncedAt = Date.now() - intervalMs + 1000;

      // Act
      const result = isSyncDue(lastSyncedAt, intervalMs);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("createAppStateHandler", () => {
    it("activeになった場合にsyncArticlesを呼び出すこと", async () => {
      // Arrange
      mockSyncArticles.mockResolvedValue({ synced: 5, errors: [] });
      const handler = createAppStateHandler(DEFAULT_BACKGROUND_SYNC_CONFIG);

      // Act
      handler("active");
      await Promise.resolve();

      // Assert
      expect(mockSyncArticles).toHaveBeenCalledTimes(1);
    });

    it("backgroundになった場合はsyncArticlesを呼び出さないこと", () => {
      // Arrange
      const handler = createAppStateHandler(DEFAULT_BACKGROUND_SYNC_CONFIG);

      // Act
      handler("background");

      // Assert
      expect(mockSyncArticles).not.toHaveBeenCalled();
    });

    it("inactiveになった場合はsyncArticlesを呼び出さないこと", () => {
      // Arrange
      const handler = createAppStateHandler(DEFAULT_BACKGROUND_SYNC_CONFIG);

      // Act
      handler("inactive");

      // Assert
      expect(mockSyncArticles).not.toHaveBeenCalled();
    });

    it("同期間隔が経過していない場合はsyncArticlesを呼び出さないこと", async () => {
      // Arrange
      mockSyncArticles.mockResolvedValue({ synced: 0, errors: [] });
      const config = { ...DEFAULT_BACKGROUND_SYNC_CONFIG, intervalMs: 15 * 60 * 1000 };
      const handler = createAppStateHandler(config);

      // 1回目: 同期実行
      handler("active");
      await Promise.resolve();
      expect(mockSyncArticles).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Act: 2回目: 間隔未経過
      handler("active");
      await Promise.resolve();

      // Assert
      expect(mockSyncArticles).not.toHaveBeenCalled();
    });

    it("syncArticlesがエラーを返してもハンドラーがクラッシュしないこと", async () => {
      // Arrange
      mockSyncArticles.mockRejectedValue(new Error("ネットワークエラー"));
      const handler = createAppStateHandler(DEFAULT_BACKGROUND_SYNC_CONFIG);

      // Act & Assert: エラーがスローされないこと
      handler("active");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("startBackgroundSync", () => {
    it("AppState.addEventListenerを登録すること", () => {
      // Act
      startBackgroundSync();

      // Assert
      expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("カスタム設定でも登録できること", () => {
      // Arrange
      const customConfig = { intervalMs: 5 * 60 * 1000, taskName: "CUSTOM_SYNC" };

      // Act
      startBackgroundSync(customConfig);

      // Assert
      expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("クリーンアップ関数がsubscription.removeを呼び出すこと", () => {
      // Arrange
      const mockSubscription = makeMockSubscription();
      mockAddEventListener.mockReturnValue(
        mockSubscription as ReturnType<typeof AppState.addEventListener>,
      );

      // Act
      const cleanup = startBackgroundSync();
      cleanup();

      // Assert
      expect(mockSubscription.remove).toHaveBeenCalledTimes(1);
    });

    it("二重登録時は既存のsubscriptionを解除してから再登録すること", () => {
      // Arrange
      const firstSubscription = makeMockSubscription();
      const secondSubscription = makeMockSubscription();
      mockAddEventListener
        .mockReturnValueOnce(firstSubscription as ReturnType<typeof AppState.addEventListener>)
        .mockReturnValueOnce(secondSubscription as ReturnType<typeof AppState.addEventListener>);

      // Act
      startBackgroundSync();
      startBackgroundSync();

      // Assert: 最初のsubscriptionが解除されること
      expect(firstSubscription.remove).toHaveBeenCalledTimes(1);
      expect(mockAddEventListener).toHaveBeenCalledTimes(2);
    });

    it("クリーンアップ後に再度クリーンアップを呼んでもエラーにならないこと", () => {
      // Arrange
      const mockSubscription = makeMockSubscription();
      mockAddEventListener.mockReturnValue(
        mockSubscription as ReturnType<typeof AppState.addEventListener>,
      );
      const cleanup = startBackgroundSync();
      cleanup();

      // Act & Assert: 二重クリーンアップでエラーにならない
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe("getLastSyncedAt", () => {
    it("初期状態ではnullを返すこと", () => {
      // Act
      const result = getLastSyncedAt();

      // Assert
      expect(result).toBeNull();
    });

    it("activeになった後は同期時刻が記録されること", async () => {
      // Arrange
      const before = Date.now();
      mockSyncArticles.mockResolvedValue({ synced: 1, errors: [] });
      const handler = createAppStateHandler(DEFAULT_BACKGROUND_SYNC_CONFIG);

      // Act
      handler("active");
      await Promise.resolve();

      // Assert
      const lastSyncedAt = getLastSyncedAt();
      expect(lastSyncedAt).not.toBeNull();
      expect(lastSyncedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe("resetBackgroundSyncState", () => {
    it("lastSyncedAtをnullにリセットすること", async () => {
      // Arrange
      mockSyncArticles.mockResolvedValue({ synced: 0, errors: [] });
      const handler = createAppStateHandler(DEFAULT_BACKGROUND_SYNC_CONFIG);
      handler("active");
      await Promise.resolve();
      expect(getLastSyncedAt()).not.toBeNull();

      // Act
      resetBackgroundSyncState();

      // Assert
      expect(getLastSyncedAt()).toBeNull();
    });
  });
});
