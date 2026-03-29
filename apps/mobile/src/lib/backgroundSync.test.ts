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

/** NativeEventSubscription モック */
function makeMockSubscription(): { remove: jest.Mock } {
  return { remove: jest.fn() };
}

/** addEventListener のスパイ */
let addEventListenerSpy: jest.SpyInstance;

describe("backgroundSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetBackgroundSyncState();
    addEventListenerSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue(makeMockSubscription() as ReturnType<typeof AppState.addEventListener>);
  });

  afterEach(() => {
    resetBackgroundSyncState();
    addEventListenerSpy.mockRestore();
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
      (syncArticles as jest.Mock).mockResolvedValue({ synced: 5, errors: [] });
      const handler = createAppStateHandler(DEFAULT_BACKGROUND_SYNC_CONFIG);

      // Act
      handler("active");
      await Promise.resolve();

      // Assert
      expect(syncArticles).toHaveBeenCalledTimes(1);
    });

    it("backgroundになった場合はsyncArticlesを呼び出さないこと", () => {
      // Arrange
      const handler = createAppStateHandler(DEFAULT_BACKGROUND_SYNC_CONFIG);

      // Act
      handler("background");

      // Assert
      expect(syncArticles).not.toHaveBeenCalled();
    });

    it("inactiveになった場合はsyncArticlesを呼び出さないこと", () => {
      // Arrange
      const handler = createAppStateHandler(DEFAULT_BACKGROUND_SYNC_CONFIG);

      // Act
      handler("inactive");

      // Assert
      expect(syncArticles).not.toHaveBeenCalled();
    });

    it("同期間隔が経過していない場合はsyncArticlesを呼び出さないこと", async () => {
      // Arrange
      (syncArticles as jest.Mock).mockResolvedValue({ synced: 0, errors: [] });
      const config = { ...DEFAULT_BACKGROUND_SYNC_CONFIG, intervalMs: 15 * 60 * 1000 };
      const handler = createAppStateHandler(config);

      handler("active");
      await Promise.resolve();
      expect(syncArticles).toHaveBeenCalledTimes(1);

      (syncArticles as jest.Mock).mockClear();

      // Act
      handler("active");
      await Promise.resolve();

      // Assert
      expect(syncArticles).not.toHaveBeenCalled();
    });

    it("syncArticlesがエラーを返してもハンドラーがクラッシュしないこと", async () => {
      // Arrange
      (syncArticles as jest.Mock).mockRejectedValue(new Error("ネットワークエラー"));
      const handler = createAppStateHandler(DEFAULT_BACKGROUND_SYNC_CONFIG);

      // Act & Assert
      handler("active");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("startBackgroundSync", () => {
    it("AppState.addEventListenerを登録すること", () => {
      // Act
      startBackgroundSync();

      // Assert
      expect(addEventListenerSpy).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("カスタム設定でも登録できること", () => {
      // Arrange
      const customConfig = { intervalMs: 5 * 60 * 1000, taskName: "CUSTOM_SYNC" };

      // Act
      startBackgroundSync(customConfig);

      // Assert
      expect(addEventListenerSpy).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("クリーンアップ関数がsubscription.removeを呼び出すこと", () => {
      // Arrange
      const mockSubscription = makeMockSubscription();
      addEventListenerSpy.mockReturnValue(
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
      addEventListenerSpy
        .mockReturnValueOnce(firstSubscription as ReturnType<typeof AppState.addEventListener>)
        .mockReturnValueOnce(secondSubscription as ReturnType<typeof AppState.addEventListener>);

      // Act
      startBackgroundSync();
      startBackgroundSync();

      // Assert
      expect(firstSubscription.remove).toHaveBeenCalledTimes(1);
      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
    });

    it("クリーンアップ後に再度クリーンアップを呼んでもエラーにならないこと", () => {
      // Arrange
      const mockSubscription = makeMockSubscription();
      addEventListenerSpy.mockReturnValue(
        mockSubscription as ReturnType<typeof AppState.addEventListener>,
      );
      const cleanup = startBackgroundSync();
      cleanup();

      // Act & Assert
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
      (syncArticles as jest.Mock).mockResolvedValue({ synced: 1, errors: [] });
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
      (syncArticles as jest.Mock).mockResolvedValue({ synced: 0, errors: [] });
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
