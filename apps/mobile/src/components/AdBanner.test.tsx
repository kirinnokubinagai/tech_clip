import { render } from "@testing-library/react-native";

import { AdBanner } from "./AdBanner";

jest.mock("react-native-google-mobile-ads", () => {
  const { View } = require("react-native");
  return {
    BannerAd: (props: Record<string, unknown>) => <View testID="banner-ad" {...props} />,
    BannerAdSize: {
      ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER",
    },
    TestIds: {
      ADAPTIVE_BANNER: "ca-app-pub-3940256099942544/9214589741",
    },
  };
});

jest.mock("@/hooks/use-subscription", () => ({
  useSubscription: jest.fn(),
}));

import { useSubscription } from "@/hooks/use-subscription";

const mockedUseSubscription = useSubscription as jest.MockedFunction<typeof useSubscription>;

describe("AdBanner", () => {
  beforeEach(() => {
    mockedUseSubscription.mockReturnValue({
      isSubscribed: false,
      currentPlan: null,
      isLoading: false,
      error: null,
      purchase: jest.fn(),
      restore: jest.fn(),
    });
  });

  describe("無料ユーザー", () => {
    it("バナー広告が表示されること", async () => {
      // Arrange
      mockedUseSubscription.mockReturnValue({
        isSubscribed: false,
        currentPlan: null,
        isLoading: false,
        error: null,
        purchase: jest.fn(),
        restore: jest.fn(),
      });

      // Act
      const { getByTestId } = await render(<AdBanner />);

      // Assert
      expect(getByTestId("ad-banner-container")).toBeDefined();
      expect(getByTestId("banner-ad")).toBeDefined();
    });
  });

  describe("プレミアムユーザー", () => {
    it("バナー広告が非表示になること", async () => {
      // Arrange
      mockedUseSubscription.mockReturnValue({
        isSubscribed: true,
        currentPlan: "premium_monthly",
        isLoading: false,
        error: null,
        purchase: jest.fn(),
        restore: jest.fn(),
      });

      // Act
      const { queryByTestId } = await render(<AdBanner />);

      // Assert
      expect(queryByTestId("ad-banner-container")).toBeNull();
      expect(queryByTestId("banner-ad")).toBeNull();
    });
  });

  describe("プロパティ", () => {
    it("カスタムtestIDが適用されること", async () => {
      // Arrange
      mockedUseSubscription.mockReturnValue({
        isSubscribed: false,
        currentPlan: null,
        isLoading: false,
        error: null,
        purchase: jest.fn(),
        restore: jest.fn(),
      });

      // Act
      const { getByTestId } = await render(<AdBanner testID="custom-ad" />);

      // Assert
      expect(getByTestId("custom-ad")).toBeDefined();
    });
  });

  describe("広告ユニットID", () => {
    it("環境変数が設定されている場合はその値を使用すること", async () => {
      // Arrange
      const originalEnv = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID;
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID = "ca-app-pub-1234567890/1234567890";

      // Act
      const { getByTestId } = await render(<AdBanner />);

      // Assert
      const bannerAd = getByTestId("banner-ad");
      expect(bannerAd).toBeDefined();

      // Cleanup
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID = originalEnv;
    });

    it("環境変数が未設定の場合はTestIdsにフォールバックすること", async () => {
      // Arrange
      const originalEnv = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID;
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID = undefined;

      // Act
      const { getByTestId } = await render(<AdBanner />);

      // Assert
      const bannerAd = getByTestId("banner-ad");
      expect(bannerAd).toBeDefined();
      expect(bannerAd.props.unitId).toBe("ca-app-pub-3940256099942544/9214589741");

      // Cleanup
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID = originalEnv;
    });
  });
});
