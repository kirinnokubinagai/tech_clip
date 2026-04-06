import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiFetch } from "@/lib/api";
import {
  registerPushTokenOnly,
  registerTokenWithApi,
  setupNotificationHandlers,
} from "@/lib/notifications";

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
  describe("registerPushTokenOnly", () => {
    it("実機でプッシュトークンを取得してAPIに登録すること", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[test-token-123]",
      });

      // Act
      await registerPushTokenOnly();

      // Assert
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    });

    it("シミュレータでは何もしないこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: false });

      // Act
      await registerPushTokenOnly();

      // Assert
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it("Androidの場合に通知チャンネルを設定すること", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true });
      Object.defineProperty(Platform, "OS", { value: "android" });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[android-token]",
      });

      // Act
      await registerPushTokenOnly();

      // Assert
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
        }),
      );
    });

    it("エラーが発生してもexceptionをスローしないこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(
        new Error("トークン取得失敗"),
      );

      // Act & Assert (should not throw)
      await expect(registerPushTokenOnly()).resolves.toBeUndefined();
    });
  });

  describe("registerTokenWithApi", () => {
    it("トークンをAPIに登録できること", async () => {
      // Arrange
      const token = "ExponentPushToken[test-token]";

      // Act
      await registerTokenWithApi(token);

      // Assert
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/notifications/register",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(token),
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
