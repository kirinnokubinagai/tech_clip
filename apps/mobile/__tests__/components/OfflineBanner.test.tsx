import { render } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { OfflineBanner } from "../../src/components/OfflineBanner";

jest.mock("../../src/hooks/use-network-status", () => ({
  useNetworkStatus: jest.fn(),
}));

import { useNetworkStatus } from "../../src/hooks/use-network-status";

/**
 * testIDでReactTestInstanceを検索するヘルパー
 */
function queryByTestId(root: ReactTestInstance, testId: string): ReactTestInstance | null {
  const results = root.findAllByProps({ testID: testId });
  return results.length > 0 ? results[0] : null;
}

describe("OfflineBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("オフライン時", () => {
    it("isOfflineがtrueの場合バナーが表示されること", () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false, isOffline: true });

      // Act
      const { UNSAFE_root } = render(<OfflineBanner />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "offline-banner")).not.toBeNull();
    });

    it("バナーにアクセシビリティロールalertが設定されていること", () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false, isOffline: true });

      // Act
      const { UNSAFE_root } = render(<OfflineBanner />);

      // Assert
      const banner = queryByTestId(UNSAFE_root, "offline-banner");
      expect(banner?.props.accessibilityRole).toBe("alert");
    });
  });

  describe("オンライン時", () => {
    it("isOfflineがfalseの場合バナーが表示されないこと", () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: true, isOffline: false });

      // Act
      const { UNSAFE_root } = render(<OfflineBanner />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "offline-banner")).toBeNull();
    });
  });
});
