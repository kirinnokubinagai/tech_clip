import NetInfo, { type NetInfoState, NetInfoStateType } from "@react-native-community/netinfo";
import { act, renderHook } from "@testing-library/react-native";

import { useNetworkStatus } from "../../../apps/mobile/src/hooks/use-network-status";

jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(),
  NetInfoStateType: {
    unknown: "unknown",
    none: "none",
    cellular: "cellular",
    wifi: "wifi",
    bluetooth: "bluetooth",
    ethernet: "ethernet",
    wimax: "wimax",
    vpn: "vpn",
    other: "other",
  },
}));

/** オンライン状態のNetInfoState */
const ONLINE_STATE: NetInfoState = {
  type: NetInfoStateType.wifi,
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
  type: NetInfoStateType.none,
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

    (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
      capturedCallback = callback;
      return mockUnsubscribe;
    });
  });

  describe("初期状態", () => {
    it("初期状態ではisOnlineがtrueであること", async () => {
      // Arrange & Act
      const { result } = await renderHook(() => useNetworkStatus());

      // Assert
      expect(result.current.isOnline).toBe(true);
    });

    it("初期状態ではisOfflineがfalseであること", async () => {
      // Arrange & Act
      const { result } = await renderHook(() => useNetworkStatus());

      // Assert
      expect(result.current.isOffline).toBe(false);
    });

    it("マウント時にNetInfo.addEventListenerが呼ばれること", async () => {
      // Arrange & Act
      await renderHook(() => useNetworkStatus());

      // Assert
      expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("ネットワーク状態変化", () => {
    it("オフラインになるとisOfflineがtrueになること", async () => {
      // Arrange
      const { result } = await renderHook(() => useNetworkStatus());

      // Act
      await act(async () => {
        capturedCallback?.(OFFLINE_STATE);
      });

      // Assert
      expect(result.current).not.toBeNull();
      expect(result.current.isOffline).toBe(true);
      expect(result.current.isOnline).toBe(false);
    });

    it("オンラインに復帰するとisOnlineがtrueになること", async () => {
      // Arrange
      const { result } = await renderHook(() => useNetworkStatus());

      await act(async () => {
        capturedCallback?.(OFFLINE_STATE);
      });

      // Act
      await act(async () => {
        capturedCallback?.(ONLINE_STATE);
      });

      // Assert
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it("isConnectedがnullの場合はオフラインと判定されること", async () => {
      // Arrange
      const { result } = await renderHook(() => useNetworkStatus());

      // Act
      await act(async () => {
        capturedCallback?.({ ...OFFLINE_STATE, isConnected: null } as unknown as NetInfoState);
      });

      // Assert
      expect(result.current.isOffline).toBe(true);
    });
  });

  describe("クリーンアップ", () => {
    it("アンマウント時にリスナーが解除されること", async () => {
      // Arrange
      const { unmount } = await renderHook(() => useNetworkStatus());

      // Act
      await unmount();

      // Assert
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
