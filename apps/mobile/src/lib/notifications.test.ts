import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerForPushNotifications, setupNotificationHandlers } from "@/lib/notifications";

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

jest.mock("expo-device", () => ({
  __esModule: true,
  isDevice: true,
}));

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn().mockResolvedValue({ success: true }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Device, "isDevice", { value: true, writable: true });
  Object.defineProperty(Platform, "OS", { value: "ios", writable: true });
});

describe("notifications", () => {
  describe("registerForPushNotifications", () => {
    it("実機でプッシュトークンを取得できること", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[test-token-123]",
      });

      // Act
      const token = await registerForPushNotifications();

      // Assert
      expect(token).toBe("ExponentPushToken[test-token-123]");
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    });

    it("権限が未許可の場合にrequestPermissionsAsyncを呼ぶこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[new-token]",
      });

      // Act
      const token = await registerForPushNotifications();

      // Assert
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(token).toBe("ExponentPushToken[new-token]");
    });

    it("権限が拒否された場合にnullを返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      // Act
      const token = await registerForPushNotifications();

      // Assert
      expect(token).toBeNull();
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it("シミュレータの場合にnullを返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: false });

      // Act
      const token = await registerForPushNotifications();

      // Assert
      expect(token).toBeNull();
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });

    it("Androidの場合に通知チャンネルを設定すること", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true });
      Object.defineProperty(Platform, "OS", { value: "android" });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[android-token]",
      });

      // Act
      await registerForPushNotifications();

      // Assert
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
        }),
      );
    });
  });

  describe("setupNotificationHandlers", () => {
    it("通知ハンドラーを設定すること", () => {
      // Act
      setupNotificationHandlers();

      // Assert
      expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          handleNotification: expect.any(Function),
        }),
      );
    });

    it("リスナーのクリーンアップ関数を返すこと", () => {
      // Act
      const cleanup = setupNotificationHandlers();

      // Assert
      expect(typeof cleanup).toBe("function");
      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledTimes(1);
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    it("クリーンアップ関数がリスナーを解除すること", () => {
      // Arrange
      const mockRemoveReceived = jest.fn();
      const mockRemoveResponse = jest.fn();
      (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({
        remove: mockRemoveReceived,
      });
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
        remove: mockRemoveResponse,
      });

      // Act
      const cleanup = setupNotificationHandlers();
      cleanup();

      // Assert
      expect(mockRemoveReceived).toHaveBeenCalledTimes(1);
      expect(mockRemoveResponse).toHaveBeenCalledTimes(1);
    });
  });
});
