import { render } from "@testing-library/react-native";

jest.mock("lucide-react-native", () => ({
  WifiOff: "WifiOff",
}));

jest.mock("@/hooks/use-network-status", () => ({
  useNetworkStatus: jest.fn(),
}));

import { OfflineBanner } from "@mobile/components/OfflineBanner";
import { useNetworkStatus } from "@mobile/hooks/use-network-status";

describe("OfflineBanner", () => {
  describe("オフライン時", () => {
    it("オフラインのときバナーが表示されること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      // Act
      const { getByLabelText } = await render(<OfflineBanner />);

      // Assert
      expect(getByLabelText("オフライン状態です。")).toBeDefined();
    });

    it("オフライン時にオフラインメッセージが表示されること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      // Act
      const { getByLabelText } = await render(<OfflineBanner />);

      // Assert
      expect(getByLabelText("オフライン状態です。")).toBeDefined();
    });
  });

  describe("オンライン時", () => {
    it("オンラインのときバナーが表示されないこと", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: true,
        isOffline: false,
      });

      // Act
      const { queryByLabelText } = await render(<OfflineBanner />);

      // Assert
      expect(queryByLabelText("オフライン状態です。")).toBeNull();
    });
  });
});
