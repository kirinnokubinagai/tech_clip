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
      const { getByLabelText } = render(<OfflineBanner />);

      // Assert
      expect(getByLabelText("オフライン状態です")).toBeDefined();
    });

    it("オフライン時にオフラインメッセージが表示されること", () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      // Act
      const { getByLabelText } = render(<OfflineBanner />);

      // Assert
      expect(getByLabelText("オフライン状態です")).toBeDefined();
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
      const { queryByLabelText } = render(<OfflineBanner />);

      // Assert
      expect(queryByLabelText("オフライン状態です")).toBeNull();
    });
  });
});
