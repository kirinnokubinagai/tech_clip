import { render } from "@testing-library/react-native";

import { useSubscriptionStore } from "@/stores";

import { AdBanner } from "../AdBanner";

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

describe("AdBanner", () => {
  beforeEach(() => {
    useSubscriptionStore.setState({ isPremium: false });
  });

  describe("無料ユーザー", () => {
    it("バナー広告が表示されること", () => {
      // Arrange
      useSubscriptionStore.setState({ isPremium: false });

      // Act
      const { getByTestId } = render(<AdBanner />);

      // Assert
      expect(getByTestId("ad-banner-container")).toBeDefined();
      expect(getByTestId("banner-ad")).toBeDefined();
    });
  });

  describe("プレミアムユーザー", () => {
    it("バナー広告が非表示になること", () => {
      // Arrange
      useSubscriptionStore.setState({ isPremium: true });

      // Act
      const { queryByTestId } = render(<AdBanner />);

      // Assert
      expect(queryByTestId("ad-banner-container")).toBeNull();
      expect(queryByTestId("banner-ad")).toBeNull();
    });
  });

  describe("プロパティ", () => {
    it("カスタムtestIDが適用されること", () => {
      // Arrange
      useSubscriptionStore.setState({ isPremium: false });

      // Act
      const { getByTestId } = render(<AdBanner testID="custom-ad" />);

      // Assert
      expect(getByTestId("custom-ad")).toBeDefined();
    });
  });
});
