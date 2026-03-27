import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { act, renderHook } from "@testing-library/react-native";

import { useNetworkStatus } from "../use-network-status";

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

/** オンライン状態のNetInfoState */
const ONLINE_STATE: NetInfoState = {
  type: "wifi",
  isConnected: true,
  isInternetReachable: true,
  details: {
    isConnectionExpensive: false,
    ssid: null,
    bssid: null,
    strength: null,
    ipAddress: null,
    subnet: null,
    frequency: null,
    linkSpeed: null,
    rxLinkSpeed: null,
    txLinkSpeed: null,
  },
};

/** オフライン状態のNetInfoState */
const OFFLINE_STATE: NetInfoState = {
  type: "none",
  isConnected: false,
  isInternetReachable: false,
  details: null,
};

describe("useNetworkStatus", () => {
  let mockUnsubscribe: jest.Mock;
  let capturedCallback: ((state: NetInfoState) => void) | null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnsubscribe = jest.fn();
    capturedCallback = null;

    (NetInfo.fetch as jest.Mock).mockResolvedValue(ONLINE_STATE);
    (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
      capturedCallback = callback;
      return mockUnsubscribe;
    });
  });

  describe("初期状態", () => {
    it("初期状態ではisOnlineがtrueであること", async () => {
      // Arrange & Act
      const { result } = renderHook(() => useNetworkStatus());

      await act(async () => {});

      // Assert
      expect(result.current.isOnline).toBe(true);
    });

    it("初期状態ではisOfflineがfalseであること", async () => {
      // Arrange & Act
      const { result } = renderHook(() => useNetworkStatus());

      await act(async () => {});

      // Assert
      expect(result.current.isOffline).toBe(false);
    });

    it("マウント時にNetInfo.addEventListenerが呼ばれること", async () => {
      // Arrange & Act
      renderHook(() => useNetworkStatus());

      await act(async () => {});

      // Assert
      expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("ネットワーク状態変化", () => {
    it("オフラインになるとisOfflineがtrueになること", async () => {
      // Arrange
      const { result } = renderHook(() => useNetworkStatus());
      await act(async () => {});

      // Act
      act(() => {
        capturedCallback?.(OFFLINE_STATE);
      });

      // Assert
      expect(result.current.isOffline).toBe(true);
      expect(result.current.isOnline).toBe(false);
    });

    it("オンラインに復帰するとisOnlineがtrueになること", async () => {
      // Arrange
      (NetInfo.fetch as jest.Mock).mockResolvedValue(OFFLINE_STATE);
      const { result } = renderHook(() => useNetworkStatus());
      await act(async () => {});

      act(() => {
        capturedCallback?.(OFFLINE_STATE);
      });

      // Act
      act(() => {
        capturedCallback?.(ONLINE_STATE);
      });

      // Assert
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it("isConnectedがnullの場合はオフラインと判定されること", async () => {
      // Arrange
      const { result } = renderHook(() => useNetworkStatus());
      await act(async () => {});

      // Act
      act(() => {
        capturedCallback?.({ ...OFFLINE_STATE, isConnected: null });
      });

      // Assert
      expect(result.current.isOffline).toBe(true);
    });
  });

  describe("クリーンアップ", () => {
    it("アンマウント時にリスナーが解除されること", async () => {
      // Arrange
      const { unmount } = renderHook(() => useNetworkStatus());
      await act(async () => {});

      // Act
      unmount();

      // Assert
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
