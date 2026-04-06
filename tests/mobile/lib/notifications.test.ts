import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkNotificationPermission,
  registerPushTokenOnly,
  registerTokenWithApi,
  requestNotificationPermission,
  setupNotificationHandlers,
} from "../../../apps/mobile/src/lib/notifications";

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
  addNotificationReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  addNotificationResponseReceivedListener: vi.fn(() => ({
    remove: vi.fn(),
  })),
  setNotificationChannelAsync: vi.fn(),
  AndroidImportance: { MAX: 5 },
}));

vi.mock("expo-device", () => ({
  isDevice: true,
}));

vi.mock("expo-router", () => ({
  router: {
    push: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/constants", () => ({
  LIGHT_COLORS: { accent: "#14b8a6" },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Device, "isDevice", "get").mockReturnValue(true);
  Object.defineProperty(Platform, "OS", { value: "ios", writable: true });
});

describe("checkNotificationPermission", () => {
  it("実機で権限がgrantedの場合grantedを返せること", async () => {
    // Arrange
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "granted",
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);

    // Act
    const result = await checkNotificationPermission();

    // Assert
    expect(result).toBe("granted");
    expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("実機で権限がdeniedの場合deniedを返せること", async () => {
    // Arrange
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "denied",
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);

    // Act
    const result = await checkNotificationPermission();

    // Assert
    expect(result).toBe("denied");
  });

  it("シミュレータの場合undeterminedを返せること", async () => {
    // Arrange
    vi.spyOn(Device, "isDevice", "get").mockReturnValue(false);

    // Act
    const result = await checkNotificationPermission();

    // Assert
    expect(result).toBe("undetermined");
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("requestNotificationPermission", () => {
  it("権限が未許可の場合requestPermissionsAsyncを呼ぶこと", async () => {
    // Arrange
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "undetermined",
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      status: "granted",
    } as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>);

    // Act
    const result = await requestNotificationPermission();

    // Assert
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(result).toBe("granted");
  });

  it("既にgrantedの場合requestPermissionsAsyncをスキップすること", async () => {
    // Arrange
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "granted",
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);

    // Act
    const result = await requestNotificationPermission();

    // Assert
    expect(result).toBe("granted");
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("権限が拒否された場合deniedを返せること", async () => {
    // Arrange
    vi.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "undetermined",
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
      status: "denied",
    } as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>);

    // Act
    const result = await requestNotificationPermission();

    // Assert
    expect(result).toBe("denied");
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it("シミュレータの場合undeterminedを返せること", async () => {
    // Arrange
    vi.spyOn(Device, "isDevice", "get").mockReturnValue(false);

    // Act
    const result = await requestNotificationPermission();

    // Assert
    expect(result).toBe("undetermined");
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("registerTokenWithApi", () => {
  it("トークンをAPIに登録できること", async () => {
    // Arrange
    const { apiFetch } = await import("@/lib/api");
    const token = "ExponentPushToken[test-token-123]";

    // Act
    await registerTokenWithApi(token);

    // Assert
    expect(apiFetch).toHaveBeenCalledWith("/api/notifications/register", {
      method: "POST",
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
  });
});

describe("registerPushTokenOnly", () => {
  it("実機でプッシュトークンを取得しAPIに登録できること", async () => {
    // Arrange
    vi.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
      data: "ExponentPushToken[test-token-123]",
      type: "expo",
    });

    // Act
    await registerPushTokenOnly();

    // Assert
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it("Androidの場合に通知チャンネルを設定すること", async () => {
    // Arrange
    Object.defineProperty(Platform, "OS", { value: "android", writable: true });
    vi.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
      data: "ExponentPushToken[android-token]",
      type: "expo",
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

  it("シミュレータの場合は何もしないこと", async () => {
    // Arrange
    vi.spyOn(Device, "isDevice", "get").mockReturnValue(false);

    // Act
    await registerPushTokenOnly();

    // Assert
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it("エラーが発生しても例外を伝播させないこと", async () => {
    // Arrange
    vi.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValue(new Error("Token取得失敗"));

    // Act & Assert
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
    const mockRemoveReceived = vi.fn();
    const mockRemoveResponse = vi.fn();
    vi.mocked(Notifications.addNotificationReceivedListener).mockReturnValue({
      remove: mockRemoveReceived,
    });
    vi.mocked(Notifications.addNotificationResponseReceivedListener).mockReturnValue({
      remove: mockRemoveResponse,
    });

    // Act
    const cleanup = setupNotificationHandlers();
    cleanup();

    // Assert
    expect(mockRemoveReceived).toHaveBeenCalledTimes(1);
    expect(mockRemoveResponse).toHaveBeenCalledTimes(1);
  });

  it("handleNotificationがshouldShowAlertを返すこと", async () => {
    // Arrange
    setupNotificationHandlers();
    const handler = vi.mocked(Notifications.setNotificationHandler).mock.calls[0][0];

    // Act
    const behavior = await handler.handleNotification({} as Notifications.Notification);

    // Assert
    expect(behavior.shouldShowAlert).toBe(true);
    expect(behavior.shouldPlaySound).toBe(true);
    expect(behavior.shouldSetBadge).toBe(true);
  });
});

describe("isAllowedRoute（setupNotificationHandlers経由）", () => {
  it("/articles/123 は許可されたルートとして認識されること", async () => {
    // Arrange
    const { router } = await import("expo-router");
    let responseHandler: ((response: Notifications.NotificationResponse) => void) | undefined;
    vi.mocked(Notifications.addNotificationResponseReceivedListener).mockImplementation(
      (handler) => {
        responseHandler = handler;
        return { remove: vi.fn() };
      },
    );

    setupNotificationHandlers();

    const mockResponse = {
      notification: {
        request: {
          content: {
            data: { url: "/articles/123" },
          },
        },
      },
    } as unknown as Notifications.NotificationResponse;

    // Act
    responseHandler?.(mockResponse);

    // Assert
    expect(router.push).toHaveBeenCalledWith("/articles/123");
  });

  it("/articles はトレイリングスラッシュなしで許可されること", async () => {
    // Arrange
    const { router } = await import("expo-router");
    let responseHandler: ((response: Notifications.NotificationResponse) => void) | undefined;
    vi.mocked(Notifications.addNotificationResponseReceivedListener).mockImplementation(
      (handler) => {
        responseHandler = handler;
        return { remove: vi.fn() };
      },
    );

    setupNotificationHandlers();

    const mockResponse = {
      notification: {
        request: {
          content: {
            data: { url: "/articles" },
          },
        },
      },
    } as unknown as Notifications.NotificationResponse;

    // Act
    responseHandler?.(mockResponse);

    // Assert
    expect(router.push).toHaveBeenCalledWith("/articles");
  });

  it("許可されていないURLはブロックされること", async () => {
    // Arrange
    const { router } = await import("expo-router");
    const { logger } = await import("@/lib/logger");
    let responseHandler: ((response: Notifications.NotificationResponse) => void) | undefined;
    vi.mocked(Notifications.addNotificationResponseReceivedListener).mockImplementation(
      (handler) => {
        responseHandler = handler;
        return { remove: vi.fn() };
      },
    );

    setupNotificationHandlers();

    const mockResponse = {
      notification: {
        request: {
          content: {
            data: { url: "/malicious/path" },
          },
        },
      },
    } as unknown as Notifications.NotificationResponse;

    // Act
    responseHandler?.(mockResponse);

    // Assert
    expect(router.push).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "許可されていない通知URLをブロックしました",
      expect.objectContaining({ url: "/malicious/path" }),
    );
  });
});
