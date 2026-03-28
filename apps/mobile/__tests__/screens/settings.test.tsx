import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import SettingsScreen from "../../app/(tabs)/settings";

const mockSignOut = jest.fn();
const mockDeleteAccount = jest.fn();

jest.mock("../../src/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      signOut: mockSignOut,
      deleteAccount: mockDeleteAccount,
      user: { name: "テストユーザー", email: "test@example.com" },
    }),
  ),
}));

jest.spyOn(Alert, "alert");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SettingsScreen", () => {
  describe("ログアウト", () => {
    it("ログアウトボタンを押すと確認ダイアログが表示されること", () => {
      // Arrange
      render(<SettingsScreen />);

      // Act
      fireEvent.press(screen.getByText("ログアウト"));

      // Assert
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith("ログアウト", expect.any(String), expect.any(Array));
    });

    it("確認ダイアログのキャンセルボタンを押してもサインアウトが実行されないこと", () => {
      // Arrange
      render(<SettingsScreen />);
      fireEvent.press(screen.getByText("ログアウト"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelButton = buttons.find((b: { style: string }) => b.style === "cancel");
      cancelButton.onPress?.();

      // Assert
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("確認ダイアログの確認ボタンを押すとサインアウトが実行されること", () => {
      // Arrange
      render(<SettingsScreen />);
      fireEvent.press(screen.getByText("ログアウト"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      confirmButton.onPress();

      // Assert
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it("確認ダイアログのボタンがdestructiveスタイルであること", () => {
      // Arrange
      render(<SettingsScreen />);

      // Act
      fireEvent.press(screen.getByText("ログアウト"));

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      expect(confirmButton).toBeDefined();
    });
  });

  describe("アカウント削除", () => {
    it("アカウント削除ボタンが表示されること", () => {
      // Arrange
      render(<SettingsScreen />);

      // Assert
      expect(screen.getByText("アカウントを削除する")).toBeTruthy();
    });

    it("アカウント削除ボタンを押すと確認ダイアログが表示されること", () => {
      // Arrange
      render(<SettingsScreen />);

      // Act
      fireEvent.press(screen.getByText("アカウントを削除する"));

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
      render(<SettingsScreen />);
      fireEvent.press(screen.getByText("アカウントを削除する"));

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
      render(<SettingsScreen />);
      fireEvent.press(screen.getByText("アカウントを削除する"));

      // Act
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      confirmButton.onPress();

      // Assert
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });

    it("確認ダイアログの確認ボタンがdestructiveスタイルであること", () => {
      // Arrange
      render(<SettingsScreen />);

      // Act
      fireEvent.press(screen.getByText("アカウントを削除する"));

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { style: string }) => b.style === "destructive");
      expect(confirmButton).toBeDefined();
    });
  });
});
