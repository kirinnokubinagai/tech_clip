import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  checkNotificationPermission,
  registerPushTokenOnly,
  requestNotificationPermission,
  setupNotificationHandlers,
} from "../../../apps/mobile/src/lib/notifications";

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

jest.mock("../../../apps/mobile/src/lib/api", () => ({
  apiFetch: jest.fn().mockResolvedValue({ success: true }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Device, "isDevice", { value: true, writable: true });
  Object.defineProperty(Platform, "OS", { value: "ios", writable: true });
});

describe("notifications", () => {
  describe("checkNotificationPermission", () => {
    it("実機で権限が granted の場合に granted を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true, writable: true });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      // Act
      const result = await checkNotificationPermission();

      // Assert
      expect(result).toBe("granted");
      expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it("実機で権限が denied の場合に denied を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true, writable: true });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      // Act
      const result = await checkNotificationPermission();

      // Assert
      expect(result).toBe("denied");
    });

    it("シミュレータの場合に undetermined を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: false, writable: true });

      // Act
      const result = await checkNotificationPermission();

      // Assert
      expect(result).toBe("undetermined");
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });

    it("不明なステータスの場合に undetermined を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true, writable: true });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "unknown_status",
      });

      // Act
      const result = await checkNotificationPermission();

      // Assert
      expect(result).toBe("undetermined");
    });
  });

  describe("requestNotificationPermission", () => {
    it("シミュレータの場合に undetermined を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: false, writable: true });

      // Act
      const result = await requestNotificationPermission();

      // Assert
      expect(result).toBe("undetermined");
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });

    it("既に granted の場合にリクエストをスキップして granted を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true, writable: true });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      // Act
      const result = await requestNotificationPermission();

      // Assert
      expect(result).toBe("granted");
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it("未許可の場合に権限をリクエストして granted を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true, writable: true });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      // Act
      const result = await requestNotificationPermission();

      // Assert
      expect(result).toBe("granted");
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it("権限が拒否された場合に denied を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true, writable: true });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      // Act
      const result = await requestNotificationPermission();

      // Assert
      expect(result).toBe("denied");
    });

    it("不明なステータスが返った場合に undetermined を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true, writable: true });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "unknown",
      });

      // Act
      const result = await requestNotificationPermission();

      // Assert
      expect(result).toBe("undetermined");
    });
  });

  describe("registerPushTokenOnly", () => {
    it("シミュレータの場合に何もせず終了すること", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: false, writable: true });

      // Act
      await registerPushTokenOnly();

      // Assert
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    });

    it("実機でトークンを取得してAPIに登録できること", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true, writable: true });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[test-token-123]",
      });
      const { apiFetch } = require("../../../apps/mobile/src/lib/api");

      // Act
      await registerPushTokenOnly();

      // Assert
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/notifications/register",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("Androidの場合に通知チャンネルを設定すること", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true, writable: true });
      Object.defineProperty(Platform, "OS", { value: "android", writable: true });
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

    it("エラーが発生しても例外を伝播させないこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: true, writable: true });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(
        new Error("トークン取得エラー"),
      );

      // Act & Assert（例外が投げられないこと）
      await expect(registerPushTokenOnly()).resolves.toBeUndefined();
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
