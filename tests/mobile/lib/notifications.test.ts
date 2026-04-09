import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  checkNotificationPermission,
  registerPushTokenOnly,
  registerTokenWithApi,
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

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("@/lib/constants", () => ({
  LIGHT_COLORS: { accent: "#14b8a6" },
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
  Object.defineProperty(Device, "isDevice", { value: true, writable: true, configurable: true });
  Object.defineProperty(Platform, "OS", { value: "ios", writable: true, configurable: true });
});

describe("checkNotificationPermission", () => {
  it("実機で権限がgrantedの場合grantedを返せること", async () => {
    // Arrange
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
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
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "denied",
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);

    // Act
    const result = await checkNotificationPermission();

    // Assert
    expect(result).toBe("denied");
  });

  it("シミュレータの場合undeterminedを返せること", async () => {
    // Arrange
    Object.defineProperty(Device, "isDevice", { value: false, writable: true, configurable: true });

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
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "undetermined",
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
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
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
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
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      status: "undetermined",
    } as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
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
    Object.defineProperty(Device, "isDevice", { value: false, writable: true, configurable: true });

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
    const { apiFetch } = jest.requireMock<{ apiFetch: jest.Mock }>("@/lib/api");
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
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
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
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
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
    Object.defineProperty(Device, "isDevice", { value: false, writable: true, configurable: true });

    // Act
    await registerPushTokenOnly();

    // Assert
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it("エラーが発生しても例外を伝播させないこと", async () => {
    // Arrange
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValue(new Error("Token取得失敗"));

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
    const mockRemoveReceived = jest.fn();
    const mockRemoveResponse = jest.fn();
    jest.mocked(Notifications.addNotificationReceivedListener).mockReturnValue({
      remove: mockRemoveReceived,
    });
    jest.mocked(Notifications.addNotificationResponseReceivedListener).mockReturnValue({
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
    const handler = jest.mocked(Notifications.setNotificationHandler).mock.calls[0][0];

    // Act
    const behavior = await handler.handleNotification({} as Notifications.Notification);

    // Assert
    expect(behavior.shouldShowAlert).toBe(true);
    expect(behavior.shouldPlaySound).toBe(true);
    expect(behavior.shouldSetBadge).toBe(true);
  });
});

describe("isAllowedRoute（setupNotificationHandlers経由）", () => {
  it("/articles/123 は許可されたルートとして認識されること", () => {
    // Arrange
    const { router } = jest.requireMock<{ router: { push: jest.Mock } }>("expo-router");
    let responseHandler: ((response: Notifications.NotificationResponse) => void) | undefined;
    jest.mocked(Notifications.addNotificationResponseReceivedListener).mockImplementation(
      (handler) => {
        responseHandler = handler;
        return { remove: jest.fn() };
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

  it("/articles はトレイリングスラッシュなしで許可されること", () => {
    // Arrange
    const { router } = jest.requireMock<{ router: { push: jest.Mock } }>("expo-router");
    let responseHandler: ((response: Notifications.NotificationResponse) => void) | undefined;
    jest.mocked(Notifications.addNotificationResponseReceivedListener).mockImplementation(
      (handler) => {
        responseHandler = handler;
        return { remove: jest.fn() };
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

  it("許可されていないURLはブロックされること", () => {
    // Arrange
    const { router } = jest.requireMock<{ router: { push: jest.Mock } }>("expo-router");
    const { logger } = jest.requireMock<{ logger: { warn: jest.Mock } }>("@/lib/logger");
    let responseHandler: ((response: Notifications.NotificationResponse) => void) | undefined;
    jest.mocked(Notifications.addNotificationResponseReceivedListener).mockImplementation(
      (handler) => {
        responseHandler = handler;
        return { remove: jest.fn() };
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
