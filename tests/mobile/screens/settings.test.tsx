import SettingsScreen from "@mobile-app/(tabs)/settings";
import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

const mockPush = jest.fn();
const mockConfirm = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@mobile/components/ConfirmDialog", () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
  ConfirmDialogHost: () => null,
}));

const mockSignOut = jest.fn();
const mockDeleteAccount = jest.fn();
const mockSetLanguage = jest.fn();
const mockLoadLanguage = jest.fn().mockResolvedValue(undefined);
const mockSetSummaryLanguage = jest.fn().mockResolvedValue(undefined);
const mockLoadSummaryLanguage = jest.fn().mockResolvedValue(undefined);
const mockFetchNotificationSettings = jest.fn().mockResolvedValue(undefined);
const mockUpdateNotificationEnabled = jest.fn().mockResolvedValue(undefined);

jest.mock("@mobile/hooks/use-subscription", () => ({
  useSubscription: () => ({ isSubscribed: false }),
}));

jest.mock("@mobile/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      signOut: mockSignOut,
      deleteAccount: mockDeleteAccount,
      user: { name: "テストユーザー", email: "test@example.com" },
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
      language: "ja",
      isLanguageLoaded: true,
      summaryLanguage: "ja",
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
      setLanguage: mockSetLanguage,
      loadLanguage: mockLoadLanguage,
      setSummaryLanguage: mockSetSummaryLanguage,
      loadSummaryLanguage: mockLoadSummaryLanguage,
      fetchNotificationSettings: mockFetchNotificationSettings,
      updateNotificationEnabled: mockUpdateNotificationEnabled,
    }),
  ),
}));

jest.spyOn(Alert, "alert");

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockReset();
  mockLoadLanguage.mockResolvedValue(undefined);
  mockLoadSummaryLanguage.mockResolvedValue(undefined);
  mockFetchNotificationSettings.mockResolvedValue(undefined);
  mockUpdateNotificationEnabled.mockResolvedValue(undefined);
  mockSetSummaryLanguage.mockResolvedValue(undefined);
});

describe("SettingsScreen", () => {
  describe("ログアウト", () => {
    it("ログアウトボタンを押すと確認ダイアログが表示されること", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);

      // Act
      await fireEvent.press(getByTestId("settings-logout-button"));

      // Assert
      expect(mockConfirm).toHaveBeenCalledTimes(1);
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "ログアウト", message: expect.any(String) }),
      );
    });

    it("確認ダイアログのキャンセルでサインアウトが実行されないこと", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);
      await fireEvent.press(getByTestId("settings-logout-button"));

      // Act: confirm に渡された onCancel を呼ぶ (なければ no-op = 何もしない)
      const callArg = mockConfirm.mock.calls[0][0] as { onCancel?: () => void };
      callArg.onCancel?.();

      // Assert
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("確認ダイアログの確認ボタンでサインアウトが実行されること", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);
      await fireEvent.press(getByTestId("settings-logout-button"));

      // Act
      const callArg = mockConfirm.mock.calls[0][0] as { onConfirm: () => void };
      callArg.onConfirm();

      // Assert
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it("確認ダイアログが danger バリアントで呼ばれること", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);

      // Act
      await fireEvent.press(getByTestId("settings-logout-button"));

      // Assert
      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ variant: "danger" }));
    });
  });

  describe("アカウント削除", () => {
    it("アカウント削除ボタンが表示されること", async () => {
      // Arrange
      const { getByText } = await render(<SettingsScreen />);

      // Assert
      expect(getByText("アカウントを削除する")).toBeDefined();
    });

    it("アカウント削除ボタンを押すと確認ダイアログが表示されること", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);

      // Act
      await fireEvent.press(getByTestId("settings-delete-account-button"));

      // Assert
      expect(mockConfirm).toHaveBeenCalledTimes(1);
      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "アカウントを削除する",
          message: expect.any(String),
        }),
      );
    });

    it("確認ダイアログのキャンセルでアカウント削除が実行されないこと", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);
      await fireEvent.press(getByTestId("settings-delete-account-button"));

      // Act
      const callArg = mockConfirm.mock.calls[0][0] as { onCancel?: () => void };
      callArg.onCancel?.();

      // Assert
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("確認ダイアログの確認ボタンでアカウント削除が実行されること", async () => {
      // Arrange
      mockDeleteAccount.mockResolvedValue(undefined);
      const { getByTestId } = await render(<SettingsScreen />);
      await fireEvent.press(getByTestId("settings-delete-account-button"));

      // Act
      const callArg = mockConfirm.mock.calls[0][0] as { onConfirm: () => void };
      callArg.onConfirm();

      // Assert
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });

    it("確認ダイアログが danger バリアントで呼ばれること", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);

      // Act
      await fireEvent.press(getByTestId("settings-delete-account-button"));

      // Assert
      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ variant: "danger" }));
    });
  });
});

describe("言語設定の永続化", () => {
  it("画面表示時にloadLanguageが呼ばれること", async () => {
    // Arrange & Act
    await render(<SettingsScreen />);

    // Assert
    expect(mockLoadLanguage).toHaveBeenCalledTimes(1);
  });

  it("言語設定ボタンを押すと/settings/languageに遷移すること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);

    // Act
    await fireEvent.press(getByTestId("settings-language-button"));

    // Assert
    expect(mockPush).toHaveBeenCalledWith("/settings/language");
  });
});

describe("通知設定の永続化", () => {
  it("画面表示時にfetchNotificationSettingsが呼ばれること", async () => {
    // Arrange & Act
    await render(<SettingsScreen />);

    // Assert
    expect(mockFetchNotificationSettings).toHaveBeenCalledTimes(1);
  });

  it("通知スイッチをOFFにするとupdateNotificationEnabledが呼ばれること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);

    // Act
    await fireEvent(getByTestId("settings-notification-switch"), "valueChange", false);

    // Assert
    expect(mockUpdateNotificationEnabled).toHaveBeenCalledWith(false);
  });

  it("通知スイッチをONにするとupdateNotificationEnabledが呼ばれること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);

    // Act
    await fireEvent(getByTestId("settings-notification-switch"), "valueChange", true);

    // Assert
    expect(mockUpdateNotificationEnabled).toHaveBeenCalledWith(true);
  });
});

describe("要約言語設定", () => {
  it("画面表示時にloadSummaryLanguageが呼ばれること", async () => {
    // Arrange & Act
    await render(<SettingsScreen />);

    // Assert
    expect(mockLoadSummaryLanguage).toHaveBeenCalledTimes(1);
  });

  it("要約言語選択ボタンが表示されること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);

    // Assert
    expect(getByTestId("settings-summary-language-button")).toBeDefined();
  });

  it("要約言語選択ダイアログで日本語を選択するとsetSummaryLanguageが呼ばれること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);
    await fireEvent.press(getByTestId("settings-summary-language-button"));

    // Act
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const jaButton = buttons.find((b: { text: string }) => b.text === "日本語");
    jaButton.onPress();

    // Assert
    expect(mockSetSummaryLanguage).toHaveBeenCalledWith("ja");
  });

  it("要約言語選択ダイアログでEnglishを選択するとsetSummaryLanguageが呼ばれること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);
    await fireEvent.press(getByTestId("settings-summary-language-button"));

    // Act
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const enButton = buttons.find((b: { text: string }) => b.text === "English");
    enButton.onPress();

    // Assert
    expect(mockSetSummaryLanguage).toHaveBeenCalledWith("en");
  });

  it("要約言語選択ダイアログで中文を選択するとsetSummaryLanguageが呼ばれること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);
    await fireEvent.press(getByTestId("settings-summary-language-button"));

    // Act
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const zhButton = buttons.find((b: { text: string }) => b.text === "中文");
    zhButton.onPress();

    // Assert
    expect(mockSetSummaryLanguage).toHaveBeenCalledWith("zh");
  });

  it("要約言語選択ダイアログで한국어を選択するとsetSummaryLanguageが呼ばれること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);
    await fireEvent.press(getByTestId("settings-summary-language-button"));

    // Act
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const koButton = buttons.find((b: { text: string }) => b.text === "한국어");
    koButton.onPress();

    // Assert
    expect(mockSetSummaryLanguage).toHaveBeenCalledWith("ko");
  });

  it("要約言語選択ダイアログで简体中文を選択するとsetSummaryLanguageが呼ばれること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);
    await fireEvent.press(getByTestId("settings-summary-language-button"));

    // Act
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const zhCNButton = buttons.find((b: { text: string }) => b.text === "简体中文");
    zhCNButton.onPress();

    // Assert
    expect(mockSetSummaryLanguage).toHaveBeenCalledWith("zh-CN");
  });

  it("要約言語選択ダイアログで繁體中文を選択するとsetSummaryLanguageが呼ばれること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);
    await fireEvent.press(getByTestId("settings-summary-language-button"));

    // Act
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const zhTWButton = buttons.find((b: { text: string }) => b.text === "繁體中文");
    zhTWButton.onPress();

    // Assert
    expect(mockSetSummaryLanguage).toHaveBeenCalledWith("zh-TW");
  });

  it("setSummaryLanguageが失敗した場合にAlert.alertでエラーが表示されること", async () => {
    // Arrange
    mockSetSummaryLanguage.mockRejectedValue(new Error("要約言語の保存に失敗しました"));
    const { getByTestId } = await render(<SettingsScreen />);
    await fireEvent.press(getByTestId("settings-summary-language-button"));
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const jaButton = buttons.find((b: { text: string }) => b.text === "日本語");

    // Act
    await jaButton.onPress();

    // Assert
    expect(Alert.alert).toHaveBeenCalledTimes(2);
    expect(Alert.alert).toHaveBeenNthCalledWith(2, expect.any(String), expect.any(String));
  });
});
