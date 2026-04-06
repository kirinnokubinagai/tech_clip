import SettingsScreen from "@mobile-app/(tabs)/settings";
import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

const mockSignOut = jest.fn();
const mockDeleteAccount = jest.fn();
const mockSetLanguage = jest.fn();
const mockLoadLanguage = jest.fn().mockResolvedValue(undefined);
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
  LANGUAGE_LABEL_MAP: { ja: "日本語", en: "English" },
  useSettingsStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      language: "ja",
      isLanguageLoaded: true,
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
      fetchNotificationSettings: mockFetchNotificationSettings,
      updateNotificationEnabled: mockUpdateNotificationEnabled,
    }),
  ),
}));

jest.spyOn(Alert, "alert");

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadLanguage.mockResolvedValue(undefined);
  mockFetchNotificationSettings.mockResolvedValue(undefined);
  mockUpdateNotificationEnabled.mockResolvedValue(undefined);
});

describe("SettingsScreen", () => {
  describe("ログアウト", () => {
    it("ログアウトボタンを押すと確認ダイアログが表示されること", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);

      // Act
      await fireEvent.press(getByTestId("settings-logout-button"));

      // Assert
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith("ログアウト", expect.any(String), expect.any(Array));
    });

    it("確認ダイアログのキャンセルボタンを押してもサインアウトが実行されないこと", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);
      await fireEvent.press(getByTestId("settings-logout-button"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelButton = buttons.find((b: { style: string }) => b.style === "cancel");
      cancelButton.onPress?.();

      // Assert
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("確認ダイアログの確認ボタンを押すとサインアウトが実行されること", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);
      await fireEvent.press(getByTestId("settings-logout-button"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      confirmButton.onPress();

      // Assert
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it("確認ダイアログのボタンがdestructiveスタイルであること", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);

      // Act
      await fireEvent.press(getByTestId("settings-logout-button"));

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      expect(confirmButton).toBeDefined();
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
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith(
        "アカウントを削除する",
        expect.any(String),
        expect.any(Array),
      );
    });

    it("確認ダイアログのキャンセルボタンを押してもアカウント削除が実行されないこと", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);
      await fireEvent.press(getByTestId("settings-delete-account-button"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelButton = buttons.find((b: { style: string }) => b.style === "cancel");
      cancelButton.onPress?.();

      // Assert
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("確認ダイアログの確認ボタンを押すとアカウント削除が実行されること", async () => {
      // Arrange
      mockDeleteAccount.mockResolvedValue(undefined);
      const { getByTestId } = await render(<SettingsScreen />);
      await fireEvent.press(getByTestId("settings-delete-account-button"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      confirmButton.onPress();

      // Assert
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });

    it("確認ダイアログの確認ボタンがdestructiveスタイルであること", async () => {
      // Arrange
      const { getByTestId } = await render(<SettingsScreen />);

      // Act
      await fireEvent.press(getByTestId("settings-delete-account-button"));

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      expect(confirmButton).toBeDefined();
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

  it("言語選択ダイアログで日本語を選択するとsetLanguageが呼ばれること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);
    await fireEvent.press(getByTestId("settings-language-button"));

    // Act
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const jaButton = buttons.find((b: { text: string }) => b.text === "日本語");
    jaButton.onPress();

    // Assert
    expect(mockSetLanguage).toHaveBeenCalledWith("ja");
  });

  it("言語選択ダイアログでEnglishを選択するとsetLanguageが呼ばれること", async () => {
    // Arrange
    const { getByTestId } = await render(<SettingsScreen />);
    await fireEvent.press(getByTestId("settings-language-button"));

    // Act
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const enButton = buttons.find((b: { text: string }) => b.text === "English");
    enButton.onPress();

    // Assert
    expect(mockSetLanguage).toHaveBeenCalledWith("en");
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
