import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

import { containsText, findByTestId } from "@/test-helpers";

import SettingsScreen from "../../app/(tabs)/settings";

const mockSignOut = jest.fn();
const mockDeleteAccount = jest.fn();
const mockSetLanguage = jest.fn();
const mockLoadLanguage = jest.fn().mockResolvedValue(undefined);
const mockFetchNotificationSettings = jest.fn().mockResolvedValue(undefined);
const mockUpdateNotificationEnabled = jest.fn().mockResolvedValue(undefined);

jest.mock("../../src/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      signOut: mockSignOut,
      deleteAccount: mockDeleteAccount,
      user: { name: "テストユーザー", email: "test@example.com" },
    }),
  ),
}));

jest.mock("../../src/stores/settings-store", () => ({
  useSettingsStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      language: "日本語",
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
    it("ログアウトボタンを押すと確認ダイアログが表示されること", () => {
      // Arrange
      const { UNSAFE_root } = render(<SettingsScreen />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "settings-logout-button"));

      // Assert
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith("ログアウト", expect.any(String), expect.any(Array));
    });

    it("確認ダイアログのキャンセルボタンを押してもサインアウトが実行されないこと", () => {
      // Arrange
      const { UNSAFE_root } = render(<SettingsScreen />);
      fireEvent.press(findByTestId(UNSAFE_root, "settings-logout-button"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelButton = buttons.find((b: { style: string }) => b.style === "cancel");
      cancelButton.onPress?.();

      // Assert
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("確認ダイアログの確認ボタンを押すとサインアウトが実行されること", () => {
      // Arrange
      const { UNSAFE_root } = render(<SettingsScreen />);
      fireEvent.press(findByTestId(UNSAFE_root, "settings-logout-button"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      confirmButton.onPress();

      // Assert
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it("確認ダイアログのボタンがdestructiveスタイルであること", () => {
      // Arrange
      const { UNSAFE_root } = render(<SettingsScreen />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "settings-logout-button"));

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      expect(confirmButton).toBeDefined();
    });
  });

  describe("アカウント削除", () => {
    it("アカウント削除ボタンが表示されること", () => {
      // Arrange
      const { UNSAFE_root } = render(<SettingsScreen />);

      // Assert
      expect(containsText(UNSAFE_root, "アカウントを削除する")).toBe(true);
    });

    it("アカウント削除ボタンを押すと確認ダイアログが表示されること", () => {
      // Arrange
      const { UNSAFE_root } = render(<SettingsScreen />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "settings-delete-account-button"));

      // Assert
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith(
        "アカウントを削除する",
        expect.any(String),
        expect.any(Array),
      );
    });

    it("確認ダイアログのキャンセルボタンを押してもアカウント削除が実行されないこと", () => {
      // Arrange
      const { UNSAFE_root } = render(<SettingsScreen />);
      fireEvent.press(findByTestId(UNSAFE_root, "settings-delete-account-button"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelButton = buttons.find((b: { style: string }) => b.style === "cancel");
      cancelButton.onPress?.();

      // Assert
      expect(mockDeleteAccount).not.toHaveBeenCalled();
    });

    it("確認ダイアログの確認ボタンを押すとアカウント削除が実行されること", () => {
      // Arrange
      mockDeleteAccount.mockResolvedValue(undefined);
      const { UNSAFE_root } = render(<SettingsScreen />);
      fireEvent.press(findByTestId(UNSAFE_root, "settings-delete-account-button"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      confirmButton.onPress();

      // Assert
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });

    it("確認ダイアログの確認ボタンがdestructiveスタイルであること", () => {
      // Arrange
      const { UNSAFE_root } = render(<SettingsScreen />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "settings-delete-account-button"));

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      expect(confirmButton).toBeDefined();
    });
  });
});

describe("言語設定の永続化", () => {
  it("画面表示時にloadLanguageが呼ばれること", () => {
    // Arrange & Act
    render(<SettingsScreen />);

    // Assert
    expect(mockLoadLanguage).toHaveBeenCalledTimes(1);
  });

  it("言語選択ダイアログで日本語を選択するとsetLanguageが呼ばれること", () => {
    // Arrange
    const { UNSAFE_root } = render(<SettingsScreen />);
    fireEvent.press(findByTestId(UNSAFE_root, "settings-language-button"));

    // Act
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const jaButton = buttons.find((b: { text: string }) => b.text === "日本語");
    jaButton.onPress();

    // Assert
    expect(mockSetLanguage).toHaveBeenCalledWith("日本語");
  });

  it("言語選択ダイアログでEnglishを選択するとsetLanguageが呼ばれること", () => {
    // Arrange
    const { UNSAFE_root } = render(<SettingsScreen />);
    fireEvent.press(findByTestId(UNSAFE_root, "settings-language-button"));

    // Act
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const enButton = buttons.find((b: { text: string }) => b.text === "English");
    enButton.onPress();

    // Assert
    expect(mockSetLanguage).toHaveBeenCalledWith("English");
  });
});

describe("通知設定の永続化", () => {
  it("画面表示時にfetchNotificationSettingsが呼ばれること", () => {
    // Arrange & Act
    render(<SettingsScreen />);

    // Assert
    expect(mockFetchNotificationSettings).toHaveBeenCalledTimes(1);
  });

  it("通知スイッチをOFFにするとupdateNotificationEnabledが呼ばれること", () => {
    // Arrange
    const { UNSAFE_root } = render(<SettingsScreen />);

    // Act
    fireEvent(findByTestId(UNSAFE_root, "settings-notification-switch"), "valueChange", false);

    // Assert
    expect(mockUpdateNotificationEnabled).toHaveBeenCalledWith(false);
  });

  it("通知スイッチをONにするとupdateNotificationEnabledが呼ばれること", () => {
    // Arrange
    const { UNSAFE_root } = render(<SettingsScreen />);

    // Act
    fireEvent(findByTestId(UNSAFE_root, "settings-notification-switch"), "valueChange", true);

    // Assert
    expect(mockUpdateNotificationEnabled).toHaveBeenCalledWith(true);
  });
});
