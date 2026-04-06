import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  checkNotificationPermission,
  registerPushTokenOnly,
  setupNotificationHandlers,
} from "@/lib/notifications";

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
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
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Device, "isDevice", { value: true, writable: true });
  Object.defineProperty(Platform, "OS", { value: "ios", writable: true });
});

describe("notifications", () => {
  describe("checkNotificationPermission", () => {
    it("実機で権限が許可済みの場合 granted を返すこと", async () => {
      // Arrange
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      // Act
      const result = await checkNotificationPermission();

      // Assert
      expect(result).toBe("granted");
    });

    it("実機で権限が未許可の場合 undetermined を返すこと", async () => {
      // Arrange
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });

      // Act
      const result = await checkNotificationPermission();

      // Assert
      expect(result).toBe("undetermined");
    });

    it("実機で権限が拒否済みの場合 denied を返すこと", async () => {
      // Arrange
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
      Object.defineProperty(Device, "isDevice", { value: false });

      // Act
      const result = await checkNotificationPermission();

      // Assert
      expect(result).toBe("undetermined");
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  describe("registerPushTokenOnly", () => {
    it("実機でプッシュトークンを取得してAPI登録できること", async () => {
      // Arrange
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[test-token-123]",
      });

      // Act
      await registerPushTokenOnly();

      // Assert
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    });

    it("シミュレータの場合は何もしないこと", async () => {
      // Arrange
      Object.defineProperty(Device, "isDevice", { value: false });

      // Act
      await registerPushTokenOnly();

      // Assert
      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
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

    it("許可URLへの通知タップでrouter.pushを呼ぶこと", () => {
      // Arrange
      const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock } };
      let capturedResponseListener: ((response: unknown) => void) | null = null;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (cb: (response: unknown) => void) => {
          capturedResponseListener = cb;
          return { remove: jest.fn() };
        },
      );

      setupNotificationHandlers();

      // Act
      capturedResponseListener?.({
        notification: { request: { content: { data: { url: "/articles/123" } } } },
      });

      // Assert
      expect(router.push).toHaveBeenCalledWith("/articles/123");
    });

    it("許可されていないURLへの通知タップでrouter.pushを呼ばないこと", () => {
      // Arrange
      const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock } };
      const { logger } = jest.requireMock("@/lib/logger") as {
        logger: { warn: jest.Mock };
      };
      let capturedResponseListener: ((response: unknown) => void) | null = null;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (cb: (response: unknown) => void) => {
          capturedResponseListener = cb;
          return { remove: jest.fn() };
        },
      );

      setupNotificationHandlers();

      // Act
      capturedResponseListener?.({
        notification: { request: { content: { data: { url: "https://evil.example.com" } } } },
      });

      // Assert
      expect(router.push).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "許可されていない通知URLをブロックしました",
        expect.objectContaining({ url: "https://evil.example.com" }),
      );
    });

    it("URLがない通知タップでrouter.pushを呼ばないこと", () => {
      // Arrange
      const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock } };
      let capturedResponseListener: ((response: unknown) => void) | null = null;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (cb: (response: unknown) => void) => {
          capturedResponseListener = cb;
          return { remove: jest.fn() };
        },
      );

      setupNotificationHandlers();

      // Act
      capturedResponseListener?.({
        notification: { request: { content: { data: {} } } },
      });

      // Assert
      expect(router.push).not.toHaveBeenCalled();
    });

    it("パストラバーサルを含むURLへの通知タップでrouter.pushを呼ばないこと", () => {
      // Arrange
      const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock } };
      let capturedResponseListener: ((response: unknown) => void) | null = null;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (cb: (response: unknown) => void) => {
          capturedResponseListener = cb;
          return { remove: jest.fn() };
        },
      );

      setupNotificationHandlers();

      // Act & Assert
      const traversalUrls = ["/articles/../../../secret", "/articles/%2e%2e/etc/passwd"];
      for (const url of traversalUrls) {
        capturedResponseListener?.({
          notification: { request: { content: { data: { url } } } },
        });
        expect(router.push).not.toHaveBeenCalled();
      }
    });
  });
});
