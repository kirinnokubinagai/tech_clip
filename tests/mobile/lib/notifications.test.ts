import {
  checkNotificationPermission,
  registerPushTokenOnly,
  requestNotificationPermission,
  setupNotificationHandlers,
} from "@mobile/lib/notifications";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";
import { apiFetch } from "@/lib/api";
import { logger } from "@/lib/logger";

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

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/constants", () => ({
  LIGHT_COLORS: { accent: "#FF0000" },
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Device, "isDevice", { value: true, writable: true });
  Object.defineProperty(Platform, "OS", { value: "ios", writable: true });
});

describe("notifications", () => {
  describe("checkNotificationPermission", () => {
    it("実機で権限がgrantedの場合 'granted' を返すこと", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      const result = await checkNotificationPermission();

      expect(result).toBe("granted");
      expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it("実機で権限がdeniedの場合 'denied' を返すこと", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      const result = await checkNotificationPermission();

      expect(result).toBe("denied");
    });

    it("シミュレータの場合 'undetermined' を返すこと", async () => {
      Object.defineProperty(Device, "isDevice", { value: false });

      const result = await checkNotificationPermission();

      expect(result).toBe("undetermined");
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });

    it("不明なステータスの場合 'undetermined' を返すこと", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "unknown-status",
      });

      const result = await checkNotificationPermission();

      expect(result).toBe("undetermined");
    });
  });

  describe("requestNotificationPermission", () => {
    it("既に権限がgrantedの場合はリクエストをスキップして 'granted' を返すこと", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      const result = await requestNotificationPermission();

      expect(result).toBe("granted");
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it("既に権限がdeniedの場合はリクエストをスキップして 'denied' を返すこと", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      const result = await requestNotificationPermission();

      expect(result).toBe("denied");
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it("権限が未決定の場合はリクエストを行い結果を返すこと", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      const result = await requestNotificationPermission();

      expect(result).toBe("granted");
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it("権限リクエストが拒否された場合 'denied' を返すこと", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      const result = await requestNotificationPermission();

      expect(result).toBe("denied");
    });

    it("シミュレータの場合 'undetermined' を返すこと", async () => {
      Object.defineProperty(Device, "isDevice", { value: false });

      const result = await requestNotificationPermission();

      expect(result).toBe("undetermined");
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  describe("registerPushTokenOnly", () => {
    it("実機でトークンを取得してAPIに登録できること", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[test-token-123]",
      });

      await registerPushTokenOnly();

      expect(apiFetch).toHaveBeenCalledWith(
        "/api/notifications/register",
        expect.objectContaining({ method: "POST" }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        "プッシュトークンのAPI登録に成功しました（権限確認済み）",
        expect.objectContaining({ tokenPrefix: "Expone..." }),
      );
    });

    it("権限が付与されていない場合はトークン登録をスキップすること", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      await registerPushTokenOnly();

      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(apiFetch).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "通知権限が付与されていないためトークン登録をスキップします",
        expect.objectContaining({ permission: "denied" }),
      );
    });

    it("Androidの場合に通知チャンネルを設定すること", async () => {
      Object.defineProperty(Platform, "OS", { value: "android" });
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[android-token]",
      });

      await registerPushTokenOnly();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
        }),
      );
    });

    it("シミュレータの場合は何もしないこと", async () => {
      Object.defineProperty(Device, "isDevice", { value: false });

      await registerPushTokenOnly();

      expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it("API登録が失敗してもエラーを伝播させないこと", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[test-token]",
      });
      (apiFetch as jest.Mock).mockRejectedValue(new Error("ネットワークエラー"));

      await expect(registerPushTokenOnly()).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        "プッシュトークンのAPI登録に失敗しました",
        expect.anything(),
      );
    });
  });

  describe("setupNotificationHandlers", () => {
    it("通知ハンドラーを設定すること", () => {
      setupNotificationHandlers();

      expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          handleNotification: expect.any(Function),
        }),
      );
    });

    it("リスナーのクリーンアップ関数を返すこと", () => {
      const cleanup = setupNotificationHandlers();

      expect(typeof cleanup).toBe("function");
      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledTimes(1);
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    it("クリーンアップ関数がリスナーを解除すること", () => {
      const mockRemoveReceived = jest.fn();
      const mockRemoveResponse = jest.fn();
      (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({
        remove: mockRemoveReceived,
      });
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
        remove: mockRemoveResponse,
      });

      const cleanup = setupNotificationHandlers();
      cleanup();

      expect(mockRemoveReceived).toHaveBeenCalledTimes(1);
      expect(mockRemoveResponse).toHaveBeenCalledTimes(1);
    });

    it("フォアグラウンド通知受信時に logger.info を呼び出すこと", () => {
      let receivedCallback: ((notification: Notifications.Notification) => void) | undefined;
      (Notifications.addNotificationReceivedListener as jest.Mock).mockImplementation((handler) => {
        receivedCallback = handler;
        return { remove: jest.fn() };
      });

      setupNotificationHandlers();
      receivedCallback?.({
        request: { content: { title: "テスト通知" } },
      } as unknown as Notifications.Notification);

      expect(logger.info).toHaveBeenCalledWith(
        "フォアグラウンド通知を受信しました",
        expect.objectContaining({ title: "テスト通知" }),
      );
    });

    it("個別記事URLが許可されること", () => {
      let capturedResponseHandler: ((response: unknown) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (handler) => {
          capturedResponseHandler = handler;
          return { remove: jest.fn() };
        },
      );

      setupNotificationHandlers();
      capturedResponseHandler?.({
        notification: {
          request: { content: { data: { url: "/articles/123" } } },
        },
      });

      expect(router.push).toHaveBeenCalledWith("/articles/123");
    });

    it("/articles そのもののURLが許可されること", () => {
      let capturedResponseHandler: ((response: unknown) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (handler) => {
          capturedResponseHandler = handler;
          return { remove: jest.fn() };
        },
      );

      setupNotificationHandlers();
      capturedResponseHandler?.({
        notification: {
          request: { content: { data: { url: "/articles" } } },
        },
      });

      expect(router.push).toHaveBeenCalledWith("/articles");
    });

    it("URLエンコードされた許可ルートは正規化されたパスで router.push を呼び出すこと", () => {
      let capturedResponseHandler: ((response: unknown) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (handler) => {
          capturedResponseHandler = handler;
          return { remove: jest.fn() };
        },
      );

      setupNotificationHandlers();
      capturedResponseHandler?.({
        notification: {
          request: { content: { data: { url: "/articles%2F123" } } },
        },
      });

      expect(router.push).toHaveBeenCalledWith("/articles/123");
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("許可されていないURLはブロックされること", () => {
      let capturedResponseHandler: ((response: unknown) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (handler) => {
          capturedResponseHandler = handler;
          return { remove: jest.fn() };
        },
      );

      setupNotificationHandlers();
      capturedResponseHandler?.({
        notification: {
          request: { content: { data: { url: "/malicious/path" } } },
        },
      });

      expect(router.push).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "許可されていない通知URLをブロックしました",
        expect.objectContaining({ url: "/malicious/path" }),
      );
    });

    it("URLエンコードされたパストラバーサル（%2e%2e）をブロックすること", () => {
      let capturedResponseHandler: ((response: unknown) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (handler) => {
          capturedResponseHandler = handler;
          return { remove: jest.fn() };
        },
      );

      setupNotificationHandlers();
      capturedResponseHandler?.({
        notification: {
          request: { content: { data: { url: "/%2e%2e/%2e%2e/admin" } } },
        },
      });

      expect(router.push).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "許可されていない通知URLをブロックしました",
        expect.objectContaining({ url: "/%2e%2e/%2e%2e/admin" }),
      );
    });

    it("URLがない通知はrouter.pushを呼ばないこと", () => {
      let capturedResponseHandler: ((response: unknown) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation(
        (handler) => {
          capturedResponseHandler = handler;
          return { remove: jest.fn() };
        },
      );

      setupNotificationHandlers();
      capturedResponseHandler?.({
        notification: {
          request: { content: { data: {} } },
        },
      });

      expect(router.push).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
