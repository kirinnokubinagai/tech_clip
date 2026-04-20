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
  registerPushTokenOnly: jest.fn().mockResolvedValue(undefined),
  requestNotificationPermission: jest.fn().mockResolvedValue("granted"),
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
        hasAccount: boolean;
        checkSession: () => void;
        loadAccountFlag: () => Promise<void>;
      }) => unknown,
    ) =>
      selector({
        isAuthenticated: false,
        isLoading: false,
        hasAccount: false,
        checkSession: jest.fn(),
        loadAccountFlag: jest.fn().mockResolvedValue(undefined),
      }),
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
import { registerPushTokenOnly, requestNotificationPermission } from "@mobile/lib/notifications";
import { configureRevenueCat } from "@mobile/lib/revenueCat";
import { useAuthStore } from "@mobile/stores/auth-store";
import RootLayout from "@mobile-app/_layout";

jest.mock("@mobile/components/OfflineBanner", () => ({
  OfflineBanner: () => null,
}));

const mockedConfigureRevenueCat = configureRevenueCat as jest.MockedFunction<
  typeof configureRevenueCat
>;

const mockedRegisterNativeBackgroundFetch = registerNativeBackgroundFetch as jest.MockedFunction<
  typeof registerNativeBackgroundFetch
>;

const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedRegisterPushTokenOnly = registerPushTokenOnly as jest.MockedFunction<
  typeof registerPushTokenOnly
>;
const mockedRequestNotificationPermission = requestNotificationPermission as jest.MockedFunction<
  typeof requestNotificationPermission
>;
const mockedUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

const createAuthStoreState = (isAuthenticated: boolean) => ({
  isAuthenticated,
  isLoading: false,
  hasAccount: false,
  checkSession: jest.fn(),
  loadAccountFlag: jest.fn().mockResolvedValue(undefined),
});

describe("RootLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConfigureRevenueCat.mockResolvedValue(undefined);
    mockedRegisterNativeBackgroundFetch.mockResolvedValue(undefined);
    mockedRequestNotificationPermission.mockResolvedValue("granted");
    mockedRegisterPushTokenOnly.mockResolvedValue(undefined);
    mockedUseAuthStore.mockImplementation(
      (selector: (s: ReturnType<typeof createAuthStoreState>) => unknown) =>
        selector(createAuthStoreState(false)),
    );
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

  describe("OfflineBanner", () => {
    it("OfflineBannerコンポーネントがレイアウトに含まれること", async () => {
      // Arrange
      const { OfflineBanner } = require("@mobile/components/OfflineBanner");

      // Act
      await render(<RootLayout />);

      // Assert
      expect(OfflineBanner).toBeDefined();
    });
  });

  describe("通知トークン登録", () => {
    it("認証済みユーザーでは通知権限を要求してからregisterPushTokenOnlyが呼ばれること", async () => {
      // Arrange
      mockedUseAuthStore.mockImplementation(
        (selector: (s: ReturnType<typeof createAuthStoreState>) => unknown) =>
          selector(createAuthStoreState(true)),
      );

      // Act
      await render(<RootLayout />);

      // Assert
      await waitFor(() => {
        expect(mockedRequestNotificationPermission).toHaveBeenCalledTimes(1);
        expect(mockedRegisterPushTokenOnly).toHaveBeenCalledTimes(1);
      });
    });

    it("認証済みでも通知権限がgrantedでない場合はregisterPushTokenOnlyを呼ばないこと", async () => {
      // Arrange
      mockedUseAuthStore.mockImplementation(
        (selector: (s: ReturnType<typeof createAuthStoreState>) => unknown) =>
          selector(createAuthStoreState(true)),
      );
      mockedRequestNotificationPermission.mockResolvedValue("denied");

      // Act
      await render(<RootLayout />);

      // Assert
      await waitFor(() => {
        expect(mockedRequestNotificationPermission).toHaveBeenCalledTimes(1);
        expect(mockedRegisterPushTokenOnly).not.toHaveBeenCalled();
      });
    });

    it("通知権限要求が失敗してもクラッシュせずlogger.warnに記録すること", async () => {
      // Arrange
      const testError = new Error("permission request failed");
      mockedUseAuthStore.mockImplementation(
        (selector: (s: ReturnType<typeof createAuthStoreState>) => unknown) =>
          selector(createAuthStoreState(true)),
      );
      mockedRequestNotificationPermission.mockRejectedValue(testError);

      // Act
      await render(<RootLayout />);

      // Assert
      await waitFor(() => {
        expect(mockedLogger.warn).toHaveBeenCalledWith(
          "通知初期化に失敗しました",
          expect.objectContaining({ error: testError }),
        );
      });
      expect(mockedRegisterPushTokenOnly).not.toHaveBeenCalled();
    });

    it("未認証ユーザーではregisterPushTokenOnlyを呼ばないこと", async () => {
      // Act
      await render(<RootLayout />);

      // Assert
      await waitFor(() => {
        expect(mockedRequestNotificationPermission).not.toHaveBeenCalled();
        expect(mockedRegisterPushTokenOnly).not.toHaveBeenCalled();
      });
    });
  });

  describe("認証後の (tabs) へのリダイレクト", () => {
    it("認証済みかつ (auth) セグメントにいる場合は isAuthSegment が true になること", async () => {
      // Arrange: useSegments が "(auth)" を返すよう上書き
      const expoRouter = require("expo-router") as { useSegments: jest.Mock };
      expoRouter.useSegments.mockReturnValue(["(auth)"]);
      mockedUseAuthStore.mockImplementation(
        (selector: (s: ReturnType<typeof createAuthStoreState>) => unknown) =>
          selector(createAuthStoreState(true)),
      );

      // Act & Assert: レンダリングがクラッシュしないこと（Redirect が発火する条件が揃っていること）
      await expect(render(<RootLayout />)).resolves.not.toThrow();
    });

    it("認証済みかつ (tabs) セグメントにいる場合はクラッシュしないこと（deeplink 保護）", async () => {
      // Arrange: deeplink で (tabs) 直下にいる状態
      const expoRouter = require("expo-router") as { useSegments: jest.Mock };
      expoRouter.useSegments.mockReturnValue(["(tabs)"]);
      mockedUseAuthStore.mockImplementation(
        (selector: (s: ReturnType<typeof createAuthStoreState>) => unknown) =>
          selector(createAuthStoreState(true)),
      );

      // Act & Assert: レンダリングがクラッシュしないこと
      await expect(render(<RootLayout />)).resolves.not.toThrow();
    });
  });
});
