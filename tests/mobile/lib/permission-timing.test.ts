import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiFetch } from "@/lib/api";
import {
  registerForPushNotificationsWithLogging,
  requestNotificationPermission,
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

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from "@/lib/logger";

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Device, "isDevice", { value: true, writable: true });
  Object.defineProperty(Platform, "OS", { value: "ios", writable: true });
});

describe("requestNotificationPermission", () => {
  it("権限が既に許可済みの場合にリクエストをスキップすること", async () => {
    // Arrange
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });

    // Act
    const status = await requestNotificationPermission();

    // Assert
    expect(status).toBe("granted");
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("権限が未決定の場合にリクエストダイアログを表示すること", async () => {
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
    expect(status).toBe("granted");
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("権限が拒否された場合にdeniedを返すこと", async () => {
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

  it("シミュレータの場合にundeterminedを返すこと", async () => {
    // Arrange
    Object.defineProperty(Device, "isDevice", { value: false });

    // Act
    const status = await requestNotificationPermission();

    // Assert
    expect(status).toBe("undetermined");
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("registerForPushNotificationsWithLogging", () => {
  it("トークン登録成功時にinfoログを記録すること", async () => {
    // Arrange
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: "ExponentPushToken[test]",
    });
    (apiFetch as jest.Mock).mockResolvedValue({ success: true });

    // Act
    await registerForPushNotificationsWithLogging();

    // Assert
    expect(logger.info).toHaveBeenCalledWith(
      "プッシュトークンのAPI登録に成功しました",
      expect.objectContaining({ tokenPrefix: expect.stringContaining("ExponentPushToken") }),
    );
  });

  it("トークン登録失敗時にerrorログを記録すること", async () => {
    // Arrange
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: "ExponentPushToken[test]",
    });
    (apiFetch as jest.Mock).mockRejectedValue(new Error("ネットワークエラー"));

    // Act
    await registerForPushNotificationsWithLogging();

    // Assert
    expect(logger.error).toHaveBeenCalledWith(
      "プッシュトークンのAPI登録に失敗しました",
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it("権限が拒否された場合にトークン登録を試みないこと", async () => {
    // Arrange
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "undetermined",
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });

    // Act
    await registerForPushNotificationsWithLogging();

    // Assert
    expect(apiFetch).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("シミュレータの場合にトークン登録を試みないこと", async () => {
    // Arrange
    Object.defineProperty(Device, "isDevice", { value: false });

    // Act
    await registerForPushNotificationsWithLogging();

    // Assert
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
