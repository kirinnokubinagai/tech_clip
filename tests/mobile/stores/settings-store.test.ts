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

jest.mock("i18next", () => ({
  changeLanguage: jest.fn().mockResolvedValue(undefined),
}));

import { LANGUAGE_LABEL_MAP, useSettingsStore } from "@mobile/stores/settings-store";
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
      language: "ja",
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
      it("保存済みのlocaleコード（en）を読み込めること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"en"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("en");
        expect(state.isLanguageLoaded).toBe(true);
      });

      it("保存済みのlocaleコード（ja）を読み込めること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"ja"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("ja");
        expect(state.isLanguageLoaded).toBe(true);
      });

      it("保存済みの言語設定がない場合はデフォルト値（ja）になること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue(null);

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("ja");
        expect(state.isLanguageLoaded).toBe(true);
      });

      it("旧形式の日本語表示名（日本語）をjaに移行できること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"日本語"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("ja");
        expect(state.isLanguageLoaded).toBe(true);
      });

      it("旧形式の英語表示名（English）をenに移行できること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"English"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("en");
        expect(state.isLanguageLoaded).toBe(true);
      });

      it("不正なJSON文字列の場合はデフォルト値（ja）にフォールバックすること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue("not-json");

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("ja");
        expect(state.isLanguageLoaded).toBe(true);
      });

      it("旧形式検出時にSecureStoreにlocaleコードで書き戻すこと", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"日本語"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        expect(mockSetItemAsync).toHaveBeenCalledWith("settings_language", JSON.stringify("ja"));
      });

      it("有効なlocaleコードの場合はSecureStoreへの書き戻しをしないこと", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"ja"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        expect(mockSetItemAsync).not.toHaveBeenCalled();
      });
    });

    describe("setLanguage", () => {
      it("localeコード（en）を設定してSecureStoreに永続化できること", async () => {
        // Arrange
        const newLanguage = "en" as const;

        // Act
        await useSettingsStore.getState().setLanguage(newLanguage);

        // Assert
        expect(useSettingsStore.getState().language).toBe("en");
        expect(mockSetItemAsync).toHaveBeenCalledWith("settings_language", JSON.stringify("en"));
      });

      it("localeコード（ja）を設定してSecureStoreに永続化できること", async () => {
        // Arrange
        useSettingsStore.setState({ language: "en" });

        // Act
        await useSettingsStore.getState().setLanguage("ja");

        // Assert
        expect(useSettingsStore.getState().language).toBe("ja");
        expect(mockSetItemAsync).toHaveBeenCalledWith("settings_language", JSON.stringify("ja"));
      });
    });

    describe("LANGUAGE_LABEL_MAP", () => {
      it("jaの表示名が日本語であること", () => {
        // Arrange
        useSettingsStore.setState({ language: "ja" });

        // Act
        const label = LANGUAGE_LABEL_MAP[useSettingsStore.getState().language];

        // Assert
        expect(label).toBe("日本語");
      });

      it("enの表示名がEnglishであること", () => {
        // Arrange
        useSettingsStore.setState({ language: "en" });

        // Act
        const label = LANGUAGE_LABEL_MAP[useSettingsStore.getState().language];

        // Assert
        expect(label).toBe("English");
      });

      it("zh-CNの表示名が简体中文であること", () => {
        // Arrange
        useSettingsStore.setState({ language: "zh-CN" });

        // Act
        const label = LANGUAGE_LABEL_MAP[useSettingsStore.getState().language];

        // Assert
        expect(label).toBe("简体中文");
      });

      it("zh-TWの表示名が繁體中文であること", () => {
        // Arrange
        useSettingsStore.setState({ language: "zh-TW" });

        // Act
        const label = LANGUAGE_LABEL_MAP[useSettingsStore.getState().language];

        // Assert
        expect(label).toBe("繁體中文");
      });

      it("koの表示名が한국어であること", () => {
        // Arrange
        useSettingsStore.setState({ language: "ko" });

        // Act
        const label = LANGUAGE_LABEL_MAP[useSettingsStore.getState().language];

        // Assert
        expect(label).toBe("한국어");
      });
    });

    describe("setLanguage（新言語）", () => {
      it("zh-CNを設定してSecureStoreに永続化できること", async () => {
        // Act
        await useSettingsStore.getState().setLanguage("zh-CN");

        // Assert
        expect(useSettingsStore.getState().language).toBe("zh-CN");
        expect(mockSetItemAsync).toHaveBeenCalledWith("settings_language", JSON.stringify("zh-CN"));
      });

      it("zh-TWを設定してSecureStoreに永続化できること", async () => {
        // Act
        await useSettingsStore.getState().setLanguage("zh-TW");

        // Assert
        expect(useSettingsStore.getState().language).toBe("zh-TW");
        expect(mockSetItemAsync).toHaveBeenCalledWith("settings_language", JSON.stringify("zh-TW"));
      });

      it("koを設定してSecureStoreに永続化できること", async () => {
        // Act
        await useSettingsStore.getState().setLanguage("ko");

        // Assert
        expect(useSettingsStore.getState().language).toBe("ko");
        expect(mockSetItemAsync).toHaveBeenCalledWith("settings_language", JSON.stringify("ko"));
      });
    });

    describe("loadLanguage（新言語）", () => {
      it("保存済みのlocaleコード（zh-CN）を読み込めること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"zh-CN"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("zh-CN");
        expect(state.isLanguageLoaded).toBe(true);
      });

      it("保存済みのlocaleコード（zh-TW）を読み込めること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"zh-TW"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("zh-TW");
        expect(state.isLanguageLoaded).toBe(true);
      });

      it("保存済みのlocaleコード（ko）を読み込めること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"ko"');

        // Act
        await useSettingsStore.getState().loadLanguage();

        // Assert
        const state = useSettingsStore.getState();
        expect(state.language).toBe("ko");
        expect(state.isLanguageLoaded).toBe(true);
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

      it("保存値が文字列でないJSONの場合デバイス言語にフォールバックしSecureStoreを修復すること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue("123");
        mockGetLocales.mockReturnValue([{ languageCode: "ja" }] as ReturnType<typeof getLocales>);

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        const { summaryLanguage } = useSettingsStore.getState();
        expect(summaryLanguage).toBe("ja");
        expect(mockSetItemAsync).toHaveBeenCalledWith(
          "settings_summary_language",
          JSON.stringify("ja"),
        );
      });

      it("保存値が不正な言語コードの場合SecureStoreを修復すること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"fr"');
        mockGetLocales.mockReturnValue([{ languageCode: "en" }] as ReturnType<typeof getLocales>);

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        expect(mockSetItemAsync).toHaveBeenCalledWith(
          "settings_summary_language",
          JSON.stringify("en"),
        );
      });

      it("保存値がJSON不正の場合SecureStoreを修復すること", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue("invalid-json{{{");
        mockGetLocales.mockReturnValue([{ languageCode: "ja" }] as ReturnType<typeof getLocales>);

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        expect(mockSetItemAsync).toHaveBeenCalledWith(
          "settings_summary_language",
          JSON.stringify("ja"),
        );
      });

      it("有効な言語コードの場合SecureStoreへの書き戻しをしないこと", async () => {
        // Arrange
        mockGetItemAsync.mockResolvedValue('"ja"');

        // Act
        await useSettingsStore.getState().loadSummaryLanguage();

        // Assert
        expect(mockSetItemAsync).not.toHaveBeenCalled();
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
