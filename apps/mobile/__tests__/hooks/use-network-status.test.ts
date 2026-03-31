import { act, renderHook } from "@testing-library/react-native";

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(),
}));

import NetInfo from "@react-native-community/netinfo";

import { useNetworkStatus } from "../../src/hooks/use-network-status";

const mockAddEventListener = NetInfo.addEventListener as jest.Mock;

describe("useNetworkStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddEventListener.mockReturnValue(jest.fn());
  });

  describe("初期状態", () => {
    it("初期状態ではオンラインになっていること", async () => {
      // Arrange & Act
      const { result } = await renderHook(() => useNetworkStatus());

      // Assert
      expect(result.current.isOnline).toBe(true);
    });

    it("初期状態ではオフラインでないこと", async () => {
      // Arrange & Act
      const { result } = await renderHook(() => useNetworkStatus());

      // Assert
      expect(result.current.isOffline).toBe(false);
    });
  });

  describe("接続状態の変化", () => {
    it("NetInfoがオフラインを通知するとisOfflineがtrueになること", async () => {
      // Arrange
      let capturedCallback: ((state: { isConnected: boolean }) => void) | null = null;
      mockAddEventListener.mockImplementation((callback) => {
        capturedCallback = callback;
        return jest.fn();
      });

      const { result } = await renderHook(() => useNetworkStatus());

      // Act
      await act(async () => {
        capturedCallback?.({ isConnected: false });
      });

      // Assert
      expect(result.current.isOffline).toBe(true);
      expect(result.current.isOnline).toBe(false);
    });

    it("NetInfoがオンラインを通知するとisOnlineがtrueになること", async () => {
      // Arrange
      let capturedCallback: ((state: { isConnected: boolean }) => void) | null = null;
      mockAddEventListener.mockImplementation((callback) => {
        capturedCallback = callback;
        return jest.fn();
      });

      const { result } = await renderHook(() => useNetworkStatus());

      // まずオフラインにする
      await act(async () => {
        capturedCallback?.({ isConnected: false });
      });

      // Act: オンラインに戻す
      await act(async () => {
        capturedCallback?.({ isConnected: true });
      });

      // Assert
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });
  });

  describe("クリーンアップ", () => {
    it("アンマウント時にイベントリスナーが解除されること", async () => {
      // Arrange
      const unsubscribe = jest.fn();
      mockAddEventListener.mockReturnValue(unsubscribe);

      const { unmount } = await renderHook(() => useNetworkStatus());

      // Act
      await unmount();

      // Assert
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe("addEventListenerの呼び出し", () => {
    it("マウント時にNetInfo.addEventListenerが呼ばれること", async () => {
      // Arrange & Act
      await renderHook(() => useNetworkStatus());

      // Assert
      expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    });
  });
});
