/**
 * 設定画面 英語ロケールテスト
 *
 * en ロケール設定時に主要 UI 文言が英語で表示されることを確認する。
 */
import SettingsScreen from "@mobile-app/(tabs)/settings";
import { render } from "@testing-library/react-native";

/** en.json から実際の英語翻訳を解決するモック */
jest.mock("react-i18next", () => {
  const { i18nEnMockFactory } = jest.requireActual("../helpers/i18n-en-mock") as {
    i18nEnMockFactory: () => unknown;
  };
  return (i18nEnMockFactory as () => unknown)();
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@mobile/hooks/use-subscription", () => ({
  useSubscription: () => ({ isSubscribed: false }),
}));

jest.mock("@mobile/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      signOut: jest.fn(),
      deleteAccount: jest.fn(),
      user: { name: "Test User", email: "test@example.com" },
    }),
  ),
}));

jest.mock("@mobile/stores/settings-store", () => ({
  LANGUAGE_LABEL_MAP: {
    ja: "日本語",
    en: "English",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    ko: "한국어",
  },
  SUMMARY_LANGUAGE_LABELS: {
    ja: "日本語",
    en: "English",
    zh: "中文",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    ko: "한국어",
  },
  useSettingsStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      language: "en",
      isLanguageLoaded: true,
      summaryLanguage: "en",
      isSummaryLanguageLoaded: true,
      notificationSettings: {
        id: "ns_01",
        newArticle: true,
        aiComplete: true,
        follow: true,
        system: true,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
      isNotificationSettingsLoaded: true,
      setLanguage: jest.fn(),
      loadLanguage: jest.fn().mockResolvedValue(undefined),
      setSummaryLanguage: jest.fn().mockResolvedValue(undefined),
      loadSummaryLanguage: jest.fn().mockResolvedValue(undefined),
      fetchNotificationSettings: jest.fn().mockResolvedValue(undefined),
      updateNotificationEnabled: jest.fn().mockResolvedValue(undefined),
    }),
  ),
}));

describe("SettingsScreen（英語ロケール）", () => {
  describe("セクションタイトル", () => {
    it("アカウントセクションが英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = render(<SettingsScreen />);

      // Assert
      expect(getByText("Account")).toBeTruthy();
    });

    it("サブスクリプションセクションが英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = render(<SettingsScreen />);

      // Assert
      expect(getByText("Subscription")).toBeTruthy();
    });

    it("一般セクションが英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = render(<SettingsScreen />);

      // Assert
      expect(getByText("General")).toBeTruthy();
    });
  });

  describe("設定項目", () => {
    it("言語設定項目が英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = render(<SettingsScreen />);

      // Assert
      expect(getByText("Language")).toBeTruthy();
    });

    it("通知設定項目が英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = render(<SettingsScreen />);

      // Assert
      expect(getByText("Notifications")).toBeTruthy();
    });

    it("パスワード変更項目が英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = render(<SettingsScreen />);

      // Assert
      expect(getByText("Change Password")).toBeTruthy();
    });

    it("ログアウト項目が英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = render(<SettingsScreen />);

      // Assert
      expect(getByText("Log Out")).toBeTruthy();
    });
  });

  describe("日本語ハードコードの不在確認", () => {
    it("「アカウント」という日本語テキストが表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = render(<SettingsScreen />);

      // Assert
      expect(queryByText("アカウント")).toBeNull();
    });

    it("「ログアウト」という日本語テキストが表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = render(<SettingsScreen />);

      // Assert
      expect(queryByText("ログアウト")).toBeNull();
    });

    it("「言語」という日本語テキストが表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = render(<SettingsScreen />);

      // Assert
      expect(queryByText("言語")).toBeNull();
    });
  });
});
