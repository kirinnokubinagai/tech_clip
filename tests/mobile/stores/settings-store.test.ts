jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [{ languageCode: "ja" }]),
}));

import { useSettingsStore } from "@mobile/stores/settings-store";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { apiFetch } from "@/lib/api";

/** モック型キャスト */
const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockGetLocales = getLocales as jest.MockedFunction<typeof getLocales>;

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
    mockGetLocales.mockReturnValue([{ languageCode: "ja" }] as ReturnType<typeof getLocales>);
    useSettingsStore.setState({
      language: "日本語",
      isLanguageLoaded: false,
      summaryLanguage: "ja",
      isSummaryLanguageLoaded: false,
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

      it("保存値がJSON不正の場合はデフォルト（日本語）にフォールバックすること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue("invalid{{{");

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("日本語");
        expect(state.isLanguageLoaded).toBe(true);
      });

      it("保存値が不正な言語の場合はデフォルト（日本語）にフォールバックすること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"French"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        expect(useSettingsStore.getState().language).toBe("日本語");
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

  describe("要約言語設定", () => {
    describe("loadSummaryLanguage", () => {
      it("保存済みの要約言語設定を読み込めること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"en"');

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.summaryLanguage).toBe("en");
        expect(state.isSummaryLanguageLoaded).toBe(true);
      });

      it("保存済みの設定がない場合はデバイス言語（ja）になること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue(null);
        mockGetLocales.mockReturnValue([{ languageCode: "ja" }] as ReturnType<typeof getLocales>);

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.summaryLanguage).toBe("ja");
        expect(state.isSummaryLanguageLoaded).toBe(true);
      });

      it("デバイス言語が非サポート言語の場合はデフォルト（ja）になること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue(null);
        mockGetLocales.mockReturnValue([{ languageCode: "fr" }] as ReturnType<typeof getLocales>);

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        expect(useSettingsStore.getState().summaryLanguage).toBe("ja");
      });

      it("デバイスのロケールが空の場合はデフォルト（ja）になること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue(null);
        mockGetLocales.mockReturnValue([]);

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        expect(useSettingsStore.getState().summaryLanguage).toBe("ja");
      });

      it("languageCodeがnullの場合デフォルト言語（ja）を返すこと", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue(null);
        mockGetLocales.mockReturnValue([{ languageCode: null }] as ReturnType<typeof getLocales>);

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        expect(useSettingsStore.getState().summaryLanguage).toBe("ja");
      });

      it("デバイス言語がenの場合はenになること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue(null);
        mockGetLocales.mockReturnValue([{ languageCode: "en" }] as ReturnType<typeof getLocales>);

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        expect(useSettingsStore.getState().summaryLanguage).toBe("en");
      });

      it("保存値がJSON不正の場合はデバイス言語にフォールバックすること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue("invalid-json{{{");
        mockGetLocales.mockReturnValue([{ languageCode: "ja" }] as ReturnType<typeof getLocales>);

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.summaryLanguage).toBe("ja");
        expect(state.isSummaryLanguageLoaded).toBe(true);
      });

      it("保存値が不正な言語コードの場合はデバイス言語にフォールバックすること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"fr"');
        mockGetLocales.mockReturnValue([{ languageCode: "en" }] as ReturnType<typeof getLocales>);

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        expect(useSettingsStore.getState().summaryLanguage).toBe("en");
      });
    });

    describe("setSummaryLanguage", () => {
      it("要約言語をzhに変更してSecureStoreに永続化できること", async () => {
        // Arrange
        const newLanguage = "zh" as const;

        // Act
        await useSettingsStore.getState().setSummaryLanguage(newLanguage);

        // Assert
        expect(useSettingsStore.getState().summaryLanguage).toBe("zh");
        expect(mockSetItemAsync).toHaveBeenCalledWith(
          "settings_summary_language",
          JSON.stringify("zh"),
        );
      });

      it("要約言語をkoに変更してSecureStoreに永続化できること", async () => {
        // Arrange
        const newLanguage = "ko" as const;

        // Act
        await useSettingsStore.getState().setSummaryLanguage(newLanguage);

        // Assert
        expect(useSettingsStore.getState().summaryLanguage).toBe("ko");
        expect(mockSetItemAsync).toHaveBeenCalledWith(
          "settings_summary_language",
          JSON.stringify("ko"),
        );
      });
    });
  });
});
