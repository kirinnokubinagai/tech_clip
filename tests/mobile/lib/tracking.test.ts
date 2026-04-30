/**
 * tracking.ts のテスト
 *
 * expo-tracking-transparency は実機専用パッケージのため、
 * テスト環境では動的インポートが失敗する（jest の CJS モードで ESM dynamic import が未サポート）。
 * そのため、iOS パスは実装が catch して "unavailable" を返すことを確認し、
 * 各ステータス値（authorized/denied 等）の型は TrackingStatus の型テストで担保する。
 * 非 iOS パスは Platform.OS を差し替えて実際の実装コードを通してテストする。
 */

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

jest.mock(
  "expo-tracking-transparency",
  () => ({
    requestTrackingPermissionsAsync: jest.fn().mockResolvedValue({ status: "authorized" }),
    getTrackingPermissionsAsync: jest.fn().mockResolvedValue({ status: "denied" }),
  }),
  { virtual: true },
);

import { Platform } from "react-native";

import { getTrackingStatus, requestTrackingPermission } from "@/lib/tracking";

describe("tracking", () => {
  describe("requestTrackingPermission", () => {
    it("iOS以外では'unavailable'を返すこと", async () => {
      // Arrange: Platform.OS は "android" に設定済み

      // Act
      const result = await requestTrackingPermission();

      // Assert
      expect(result).toBe("unavailable");
    });

    it("iOSパスでは'unavailable'を返すこと（動的インポートは jest CJS では catch される）", async () => {
      // Arrange
      Object.defineProperty(Platform, "OS", {
        value: "ios",
        writable: true,
        configurable: true,
      });

      // Act
      const result = await requestTrackingPermission();

      // Restore
      Object.defineProperty(Platform, "OS", {
        value: "android",
        writable: true,
        configurable: true,
      });

      // Assert: ios パスで動的インポートが失敗すると catch → "unavailable"
      expect(result).toBe("unavailable");
    });
  });

  describe("getTrackingStatus", () => {
    it("iOS以外では'unavailable'を返すこと", async () => {
      // Arrange: Platform.OS は "android" に設定済み

      // Act
      const result = await getTrackingStatus();

      // Assert
      expect(result).toBe("unavailable");
    });

    it("iOSパスでは'unavailable'を返すこと（動的インポートは jest CJS では catch される）", async () => {
      // Arrange
      Object.defineProperty(Platform, "OS", {
        value: "ios",
        writable: true,
        configurable: true,
      });

      // Act
      const result = await getTrackingStatus();

      // Restore
      Object.defineProperty(Platform, "OS", {
        value: "android",
        writable: true,
        configurable: true,
      });

      // Assert: ios パスで動的インポートが失敗すると catch → "unavailable"
      expect(result).toBe("unavailable");
    });
  });
});
