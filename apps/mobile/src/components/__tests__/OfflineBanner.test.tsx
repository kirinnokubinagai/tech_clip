import { render } from "@testing-library/react-native";

jest.mock("lucide-react-native", () => ({
  WifiOff: "WifiOff",
}));

jest.mock("../../hooks/use-network-status", () => ({
  useNetworkStatus: jest.fn(),
}));

import { useNetworkStatus } from "../../hooks/use-network-status";
import { OfflineBanner } from "../OfflineBanner";

describe("OfflineBanner", () => {
  describe("オフライン時", () => {
    it("オフラインのときバナーが表示されること", () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      // Act
      const { UNSAFE_getByProps } = render(<OfflineBanner />);

      // Assert
      expect(UNSAFE_getByProps({ testID: "offline-banner" })).toBeDefined();
    });

    it("オフライン時にオフラインメッセージが表示されること", () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      // Act
      const { UNSAFE_getByProps } = render(<OfflineBanner />);

      // Assert
      expect(UNSAFE_getByProps({ accessibilityLabel: "オフライン状態です" })).toBeDefined();
    });
  });

  describe("オンライン時", () => {
    it("オンラインのときバナーが表示されないこと", () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: true,
        isOffline: false,
      });

      // Act
      const { UNSAFE_queryByProps } = render(<OfflineBanner />);

      // Assert
      expect(UNSAFE_queryByProps({ testID: "offline-banner" })).toBeNull();
    });
  });
});
