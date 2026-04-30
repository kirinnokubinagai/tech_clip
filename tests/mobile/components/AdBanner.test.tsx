import { AdBanner } from "@mobile/components/AdBanner";
import { act, render, screen } from "@testing-library/react-native";

import { apiFetch } from "@/lib/api";

jest.mock("react-native-google-mobile-ads", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  return {
    BannerAd: ({ testID, ...props }: { testID?: string; unitId: string; size: string }) =>
      createElement(View, { testID: testID ?? "banner-ad", ...props }),
    BannerAdSize: {
      ANCHORED_ADAPTIVE_BANNER: "ANCHORED_ADAPTIVE_BANNER",
    },
    TestIds: {
      ADAPTIVE_BANNER: "ca-app-pub-3940256099942544/9214589741",
    },
  };
});

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("AdBanner", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("無料ユーザー", () => {
    it("バナー広告が表示されること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue({ success: true, data: { isPremium: false } } as never);

      // Act
      await act(async () => {
        render(<AdBanner />);
      });

      // Assert
      expect(screen.getByTestId("ad-banner-container")).toBeDefined();
      expect(screen.getByTestId("banner-ad")).toBeDefined();
    });
  });

  describe("プレミアムユーザー", () => {
    it("バナー広告が非表示になること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue({ success: true, data: { isPremium: true } } as never);

      // Act
      await act(async () => {
        render(<AdBanner />);
      });

      // Assert
      expect(screen.queryByTestId("ad-banner-container")).toBeNull();
      expect(screen.queryByTestId("banner-ad")).toBeNull();
    });
  });

  describe("プロパティ", () => {
    it("カスタムtestIDが適用されること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue({ success: true, data: { isPremium: false } } as never);

      // Act
      await act(async () => {
        render(<AdBanner testID="custom-ad" />);
      });

      // Assert
      expect(screen.getByTestId("custom-ad")).toBeDefined();
    });
  });

  describe("広告ユニットID", () => {
    it("環境変数が設定されている場合はその値を使用すること", async () => {
      // Arrange
      const originalEnv = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID;
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID = "ca-app-pub-1234567890/1234567890";
      mockedApiFetch.mockResolvedValue({ success: true, data: { isPremium: false } } as never);

      // Act
      await act(async () => {
        render(<AdBanner />);
      });

      // Assert
      expect(screen.getByTestId("banner-ad")).toBeDefined();

      // Cleanup
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID = originalEnv;
    });

    it("環境変数が未設定の場合はTestIdsにフォールバックすること", async () => {
      // Arrange
      const originalEnv = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID;
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID = undefined;
      mockedApiFetch.mockResolvedValue({ success: true, data: { isPremium: false } } as never);

      // Act
      await act(async () => {
        render(<AdBanner />);
      });

      // Assert
      const bannerAd = screen.getByTestId("banner-ad");
      expect(bannerAd).toBeDefined();
      expect(bannerAd.props.unitId).toBe("ca-app-pub-3940256099942544/9214589741");

      // Cleanup
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID = originalEnv;
    });

    it("APIエラー時はデフォルト（無料）状態で広告を表示すること", async () => {
      // Arrange
      mockedApiFetch.mockRejectedValue(new Error("ネットワークエラー"));

      // Act
      await act(async () => {
        render(<AdBanner />);
      });

      // Assert — エラー時は isPremium=false のまま広告を表示する
      expect(screen.getByTestId("ad-banner-container")).toBeDefined();
    });
  });
});
