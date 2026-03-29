import { render } from "@testing-library/react-native";

import { useSubscriptionStore } from "@/stores";
import { findByTestId, queryByTestId } from "@/test-helpers";

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
      const { UNSAFE_root } = render(<AdBanner />);

      // Assert
      expect(findByTestId(UNSAFE_root, "ad-banner-container")).toBeDefined();
      expect(findByTestId(UNSAFE_root, "banner-ad")).toBeDefined();
    });
  });

  describe("プレミアムユーザー", () => {
    it("バナー広告が非表��になること", () => {
      // Arrange
      useSubscriptionStore.setState({ isPremium: true });

      // Act
      const { UNSAFE_root } = render(<AdBanner />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "ad-banner-container")).toBeNull();
      expect(queryByTestId(UNSAFE_root, "banner-ad")).toBeNull();
    });
  });

  describe("プロパティ", () => {
    it("カスタムtestIDが適用される���と", () => {
      // Arrange
      useSubscriptionStore.setState({ isPremium: false });

      // Act
      const { UNSAFE_root } = render(<AdBanner testID="custom-ad" />);

      // Assert
      expect(findByTestId(UNSAFE_root, "custom-ad")).toBeDefined();
    });
  });
});
