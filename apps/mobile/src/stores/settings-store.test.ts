jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { useSettingsStore } from "./settings-store";

/** モック型キャスト */
const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

/** テスト用通知設定データ */
const TEST_NOTIFICATION_SETTINGS = {
  id: "ns_01HXYZ",
  newArticle: true,
  aiComplete: true,
  follow: true,
  system: true,
  createdAt: "2024-01-15T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

describe("useSettingsStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({
      language: "日本語",
      isLanguageLoaded: false,
      notificationSettings: null,
      isNotificationSettingsLoaded: false,
    });
    mockSetItemAsync.mockResolvedValue(undefined);
  });

  describe("言語設定", () => {
    describe("loadLanguage", () => {
      it("保存済みの言語設定を読み込めること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"English"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("English");
        expect(state.isLanguageLoaded).toBe(true);
      });

      it("保存済みの言語設定がない場合はデフォルト値（日本語）になること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue(null);

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("日本語");
        expect(state.isLanguageLoaded).toBe(true);
      });
    });

    describe("setLanguage", () => {
      it("言語設定を変更してSecureStoreに永続化できること", async () => {
        // Arrange
        const newLanguage = "English" as const;

        // Act
        await useSettingsStore.getState().setLanguage(newLanguage);

        // Assert
        expect(useSettingsStore.getState().language).toBe("English");
        expect(mockSetItemAsync).toHaveBeenCalledWith(
          "settings_language",
          JSON.stringify("English"),
        );
      });

      it("日本語に変更してSecureStoreに永続化できること", async () => {
        // Arrange
        useSettingsStore.setState({ language: "English" });

        // Act
        await useSettingsStore.getState().setLanguage("日本語");

        // Assert
        expect(useSettingsStore.getState().language).toBe("日本語");
        expect(mockSetItemAsync).toHaveBeenCalledWith(
          "settings_language",
          JSON.stringify("日本語"),
        );
      });
    });
  });

  describe("通知設定", () => {
    describe("fetchNotificationSettings", () => {
      it("APIから通知設定を取得できること", async () => {
        // Arrange
        mockApiFetch.mockResolvedValue({
          success: true,
          data: TEST_NOTIFICATION_SETTINGS,
        });

        // Act
        await useSettingsStore.getState().fetchNotificationSettings();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.notificationSettings).toEqual(TEST_NOTIFICATION_SETTINGS);
        expect(state.isNotificationSettingsLoaded).toBe(true);
      });

      it("APIが失敗した場合でもisNotificationSettingsLoadedがtrueになること", async () => {
        // Arrange
        mockApiFetch.mockRejectedValue(new Error("ネットワークエラー"));

        // Act
        await useSettingsStore.getState().fetchNotificationSettings();

        // Assert
        expect(useSettingsStore.getState().isNotificationSettingsLoaded).toBe(true);
      });
    });

    describe("updateNotificationEnabled", () => {
      it("通知をOFFにしてAPIに保存できること", async () => {
        // Arrange
        useSettingsStore.setState({ notificationSettings: TEST_NOTIFICATION_SETTINGS });
        mockApiFetch.mockResolvedValue({
          success: true,
          data: { ...TEST_NOTIFICATION_SETTINGS, newArticle: false },
        });

        // Act
        await useSettingsStore.getState().updateNotificationEnabled(false);

        // Assert
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/api/users/me/notification-settings",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({
              newArticle: false,
              aiComplete: false,
              follow: false,
              system: false,
            }),
          }),
        );
        expect(useSettingsStore.getState().notificationSettings?.newArticle).toBe(false);
      });

      it("通知をONにしてAPIに保存できること", async () => {
        // Arrange
        const offSettings = {
          ...TEST_NOTIFICATION_SETTINGS,
          newArticle: false,
          aiComplete: false,
          follow: false,
          system: false,
        };
        useSettingsStore.setState({ notificationSettings: offSettings });
        mockApiFetch.mockResolvedValue({
          success: true,
          data: { ...TEST_NOTIFICATION_SETTINGS },
        });

        // Act
        await useSettingsStore.getState().updateNotificationEnabled(true);

        // Assert
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/api/users/me/notification-settings",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({
              newArticle: true,
              aiComplete: true,
              follow: true,
              system: true,
            }),
          }),
        );
      });

      it("API失敗時にローカルの楽観的更新がロールバックされること", async () => {
        // Arrange
        useSettingsStore.setState({ notificationSettings: TEST_NOTIFICATION_SETTINGS });
        mockApiFetch.mockRejectedValue(new Error("ネットワークエラー"));

        // Act & Assert
        await expect(useSettingsStore.getState().updateNotificationEnabled(false)).rejects.toThrow(
          "通知設定の更新に失敗しました",
        );
        expect(useSettingsStore.getState().notificationSettings?.newArticle).toBe(true);
      });
    });
  });
});
