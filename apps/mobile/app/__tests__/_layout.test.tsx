import { render, waitFor } from "@testing-library/react-native";

jest.mock("../../src/lib/revenueCat", () => ({
  configureRevenueCat: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/lib/notifications", () => ({
  registerForPushNotifications: jest.fn().mockResolvedValue(null),
  registerTokenWithApi: jest.fn(),
  setupNotificationHandlers: jest.fn().mockReturnValue(() => {}),
}));

jest.mock("../../src/lib/tracking", () => ({
  requestTrackingPermission: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/lib/query-client", () => ({
  queryClient: {},
}));

jest.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }: { children: unknown }) => children,
}));

jest.mock("../../src/stores/auth-store", () => ({
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

jest.mock("../../src/stores/ui-store", () => ({
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

import { configureRevenueCat } from "../../src/lib/revenueCat";
import RootLayout from "../_layout";

const mockedConfigureRevenueCat = configureRevenueCat as jest.MockedFunction<
  typeof configureRevenueCat
>;

describe("RootLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConfigureRevenueCat.mockResolvedValue(undefined);
  });

  describe("RevenueCat初期化", () => {
    it("アプリ起動時にconfigureRevenueCatが呼ばれること", async () => {
      // Act
      render(<RootLayout />);

      // Assert
      await waitFor(() => {
        expect(mockedConfigureRevenueCat).toHaveBeenCalledTimes(1);
      });
    });

    it("configureRevenueCatが失敗してもアプリがクラッシュしないこと", async () => {
      // Arrange
      mockedConfigureRevenueCat.mockRejectedValue(new Error("RevenueCat設定に失敗しました"));

      // Act
      render(<RootLayout />);

      // Assert - エラーが発生してもconfigureRevenueCatが呼ばれること
      await waitFor(() => {
        expect(mockedConfigureRevenueCat).toHaveBeenCalledTimes(1);
      });
    });
  });
});
