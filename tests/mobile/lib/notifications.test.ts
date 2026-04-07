import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

import { logger } from "@/lib/logger";
import {
  checkNotificationPermission,
  registerPushTokenOnly,
  requestNotificationPermission,
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

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Device, "isDevice", { value: true, writable: true });
  Object.defineProperty(Platform, "OS", { value: "ios", writable: true });
});

describe("notifications", () => {
  describe("checkNotificationPermission", () => {
    it("実機で granted の場合に granted を返すこと", async () => {
      // Arrange
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      // Act
      const status = await checkNotificationPermission();

      // Assert
      expect(status).toBe("granted");
      expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it("実機で denied の場合に denied を返すこと", async () => {
      // Arrange
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      // Act
      const status = await checkNotificationPermission();

      // Assert
      expect(status).toBe("denied");
    });

    it("シミュレータの場合に undetermined を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: false });

      // Act
      const status = await checkNotificationPermission();

      // Assert
      expect(status).toBe("undetermined");
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  describe("requestNotificationPermission", () => {
    it("未許可の場合にrequestPermissionsAsyncを呼ぶこと", async () => {
      // Arrange
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      // Act
      const status = await requestNotificationPermission();

      // Assert
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(status).toBe("granted");
    });

    it("既に granted の場合はrequestPermissionsAsyncを呼ばないこと", async () => {
      // Arrange
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      // Act
      const status = await requestNotificationPermission();

      // Assert
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(status).toBe("granted");
    });

    it("権限が拒否された場合に denied を返すこと", async () => {
      // Arrange
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      // Act
      const status = await requestNotificationPermission();

      // Assert
      expect(status).toBe("denied");
    });

    it("シミュレータの場合に undetermined を返すこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: false });

      // Act
      const status = await requestNotificationPermission();

      // Assert
      expect(status).toBe("undetermined");
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  describe("registerPushTokenOnly", () => {
    it("実機でトークンを取得してAPIに登録すること", async () => {
      // Arrange
      const { apiFetch } = jest.requireMock("@/lib/api") as {
        apiFetch: jest.Mock;
      };
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[test-token-123]",
      });

      // Act
      await registerPushTokenOnly();

      // Assert
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/notifications/register",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("シミュレータの場合は何もしないこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: false });
      const { apiFetch } = jest.requireMock("@/lib/api") as {
        apiFetch: jest.Mock;
      };

      // Act
      await registerPushTokenOnly();

      // Assert
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it("Androidの場合に通知チャンネルを設定すること", async () => {
      // Arrange
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

    it("APIエラーが発生しても例外を外部に伝播させないこと", async () => {
      // Arrange
      const { apiFetch } = jest.requireMock("@/lib/api") as {
        apiFetch: jest.Mock;
      };
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[test]",
      });
      apiFetch.mockRejectedValue(new Error("API Error"));

      // Act
      const result = registerPushTokenOnly();

      // Assert
      await expect(result).resolves.toBeUndefined();
    });
  });

  describe("setupNotificationHandlers", () => {
    it("通知ハンドラーを設定すること", () => {
      // Arrange（前提条件なし）

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
      // Arrange（前提条件なし）

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

    it("フォアグラウンド通知受信時に logger.info を呼び出すこと", () => {
      // Arrange
      let receivedCallback: ((notification: Notifications.Notification) => void) | null = null;
      (Notifications.addNotificationReceivedListener as jest.Mock).mockImplementation((cb) => {
        receivedCallback = cb;
        return { remove: jest.fn() };
      });

      // Act
      setupNotificationHandlers();
      receivedCallback?.({
        request: { content: { title: "テスト通知" } },
      } as unknown as Notifications.Notification);

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        "フォアグラウンド通知を受信しました",
        expect.objectContaining({ title: "テスト通知" }),
      );
    });

    it("許可されたURLの通知タップで router.push を呼び出すこと", () => {
      // Arrange
      let tapCallback: ((response: Notifications.NotificationResponse) => void) | null = null;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
        tapCallback = cb;
        return { remove: jest.fn() };
      });

      // Act
      setupNotificationHandlers();
      tapCallback?.({
        notification: { request: { content: { data: { url: "/articles/123" } } } },
      } as unknown as Notifications.NotificationResponse);

      // Assert
      expect(router.push).toHaveBeenCalledWith("/articles/123");
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("許可されていないURLの通知タップで logger.warn を呼び出しrouter.pushは呼ばないこと", () => {
      // Arrange
      let tapCallback: ((response: Notifications.NotificationResponse) => void) | null = null;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
        tapCallback = cb;
        return { remove: jest.fn() };
      });

      // Act
      setupNotificationHandlers();
      tapCallback?.({
        notification: { request: { content: { data: { url: "/../../admin" } } } },
      } as unknown as Notifications.NotificationResponse);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        "許可されていない通知URLをブロックしました",
        expect.objectContaining({ url: "/../../admin" }),
      );
      expect(router.push).not.toHaveBeenCalled();
    });
  });
});
