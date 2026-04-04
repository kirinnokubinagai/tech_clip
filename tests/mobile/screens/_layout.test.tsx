import { render, waitFor } from "@testing-library/react-native";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@mobile/stores/settings-store", () => ({
  useSettingsStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      loadLanguage: jest.fn(),
    }),
  ),
}));

jest.mock("@mobile/lib/i18n", () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn(), language: "ja" },
}));

jest.mock("@mobile/lib/backgroundSync", () => ({
  DEFAULT_BACKGROUND_SYNC_CONFIG: { intervalMs: 900000, taskName: "TEST_TASK" },
  registerNativeBackgroundFetch: jest.fn().mockResolvedValue(undefined),
  startBackgroundSync: jest.fn().mockReturnValue(() => {}),
}));

jest.mock("@mobile/lib/revenueCat", () => ({
  configureRevenueCat: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@mobile/lib/notifications", () => ({
  registerForPushNotifications: jest.fn().mockResolvedValue(null),
  registerTokenWithApi: jest.fn(),
  setupNotificationHandlers: jest.fn().mockReturnValue(() => {}),
}));

jest.mock("@mobile/lib/tracking", () => ({
  requestTrackingPermission: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@mobile/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@mobile/lib/query-client", () => ({
  queryClient: {},
}));

jest.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }: { children: unknown }) => children,
}));

jest.mock("@mobile/stores/auth-store", () => ({
  useAuthStore: jest.fn(
    (
      selector: (s: {
        isAuthenticated: boolean;
        isLoading: boolean;
        checkSession: () => void;
      }) => unknown,
    ) => selector({ isAuthenticated: false, isLoading: false, checkSession: jest.fn() }),
  ),
}));

jest.mock("@mobile/stores/ui-store", () => ({
  useUIStore: jest.fn(
    (
      selector: (s: {
        hasSeenOnboarding: boolean;
        isOnboardingLoaded: boolean;
        loadOnboardingState: () => void;
      }) => unknown,
    ) =>
      selector({
        hasSeenOnboarding: true,
        isOnboardingLoaded: true,
        loadOnboardingState: jest.fn(),
      }),
  ),
}));

import { registerNativeBackgroundFetch } from "@mobile/lib/backgroundSync";
import { logger } from "@mobile/lib/logger";
import { configureRevenueCat } from "@mobile/lib/revenueCat";
import RootLayout from "@mobile-app/_layout";

const mockedConfigureRevenueCat = configureRevenueCat as jest.MockedFunction<
  typeof configureRevenueCat
>;

const mockedRegisterNativeBackgroundFetch = registerNativeBackgroundFetch as jest.MockedFunction<
  typeof registerNativeBackgroundFetch
>;

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe("RootLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConfigureRevenueCat.mockResolvedValue(undefined);
    mockedRegisterNativeBackgroundFetch.mockResolvedValue(undefined);
  });

  describe("RevenueCat初期化", () => {
    it("アプリ起動時にconfigureRevenueCatが呼ばれること", async () => {
      // Act
      await render(<RootLayout />);

      // Assert
      await waitFor(() => {
        expect(mockedConfigureRevenueCat).toHaveBeenCalledTimes(1);
      });
    });

    it("configureRevenueCatが失敗してもアプリがクラッシュしないこと", async () => {
      // Arrange
      mockedConfigureRevenueCat.mockRejectedValue(new Error("RevenueCat設定に失敗しました"));

      // Act
      await render(<RootLayout />);

      // Assert - エラーが発生してもconfigureRevenueCatが呼ばれること
      await waitFor(() => {
        expect(mockedConfigureRevenueCat).toHaveBeenCalledTimes(1);
      });
    });

    it("configureRevenueCatが失敗した場合にlogger.warnが呼ばれること", async () => {
      // Arrange
      const testError = new Error("RevenueCat設定に失敗しました");
      mockedConfigureRevenueCat.mockRejectedValue(testError);

      // Act
      await render(<RootLayout />);

      // Assert
      await waitFor(() => {
        expect(mockedLogger.warn).toHaveBeenCalledWith(
          "RevenueCat設定に失敗しました",
          expect.objectContaining({ error: testError }),
        );
      });
    });
  });

  describe("バックグラウンドフェッチ登録", () => {
    it("アプリ起動時にregisterNativeBackgroundFetchが呼ばれること", async () => {
      // Act
      await render(<RootLayout />);

      // Assert
      await waitFor(() => {
        expect(mockedRegisterNativeBackgroundFetch).toHaveBeenCalledTimes(1);
      });
    });

    it("registerNativeBackgroundFetchが失敗した場合にlogger.warnが呼ばれること", async () => {
      // Arrange
      const testError = new Error("バックグラウンドフェッチ登録失敗");
      mockedRegisterNativeBackgroundFetch.mockRejectedValue(testError);

      // Act
      await render(<RootLayout />);

      // Assert
      await waitFor(() => {
        expect(mockedLogger.warn).toHaveBeenCalledWith(
          "バックグラウンドフェッチの登録に失敗しました",
          expect.objectContaining({ error: testError }),
        );
      });
    });

    it("registerNativeBackgroundFetchが失敗してもアプリがクラッシュしないこと", async () => {
      // Arrange
      mockedRegisterNativeBackgroundFetch.mockRejectedValue(
        new Error("バックグラウンドフェッチ登録失敗"),
      );

      // Act & Assert - エラーが発生してもクラッシュしないこと
      await expect(render(<RootLayout />)).resolves.not.toThrow();
    });
  });
});
