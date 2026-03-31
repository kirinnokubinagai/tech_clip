import { render } from "@testing-library/react-native";

import { OfflineBanner } from "../../src/components/OfflineBanner";

jest.mock("../../src/hooks/use-network-status", () => ({
  useNetworkStatus: jest.fn(),
}));

import { useNetworkStatus } from "../../src/hooks/use-network-status";

describe("OfflineBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("オフライン時", () => {
    it("isOfflineがtrueの場合バナーが表示されること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false, isOffline: true });

      // Act
      const { getByTestId } = await render(<OfflineBanner />);

      // Assert
      expect(getByTestId("offline-banner")).toBeDefined();
    });

    it("バナーにアクセシビリティロールalertが設定されていること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false, isOffline: true });

      // Act
      const { getByTestId } = await render(<OfflineBanner />);

      // Assert
      const banner = getByTestId("offline-banner");
      expect(banner.props.accessibilityRole).toBe("alert");
    });
  });

  describe("オンライン時", () => {
    it("isOfflineがfalseの場合バナーが表示されないこと", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: true, isOffline: false });

      // Act
      const { queryByTestId } = await render(<OfflineBanner />);

      // Assert
      expect(queryByTestId("offline-banner")).toBeNull();
    });
  });
});
