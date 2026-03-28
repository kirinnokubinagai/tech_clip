import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import ChangePasswordScreen, {
  validateChangePasswordForm,
} from "../../app/settings/change-password";

const mockBack = jest.fn();
const mockChangePassword = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("../../src/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      changePassword: mockChangePassword,
    }),
  ),
}));

jest.spyOn(Alert, "alert");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateChangePasswordForm", () => {
  describe("現在のパスワード", () => {
    it("空の場合エラーになること", () => {
      // Arrange
      const data = { currentPassword: "", newPassword: "NewPass123", confirmPassword: "NewPass123" };

      // Act
      const errors = validateChangePasswordForm(data);

      // Assert
      expect(errors.currentPassword).toBe("現在のパスワードを入力してください");
    });
  });

  describe("新しいパスワード", () => {
    it("空の場合エラーになること", () => {
      // Arrange
      const data = { currentPassword: "OldPass123", newPassword: "", confirmPassword: "" };

      // Act
      const errors = validateChangePasswordForm(data);

      // Assert
      expect(errors.newPassword).toBe("新しいパスワードを入力してください");
    });

    it("7文字の場合エラーになること", () => {
      // Arrange
      const data = { currentPassword: "OldPass123", newPassword: "Pass123", confirmPassword: "Pass123" };

      // Act
      const errors = validateChangePasswordForm(data);

      // Assert
      expect(errors.newPassword).toBe("パスワードは8文字以上で入力してください");
    });

    it("8文字の場合エラーにならないこと", () => {
      // Arrange
      const data = { currentPassword: "OldPass123", newPassword: "Pass1234", confirmPassword: "Pass1234" };

      // Act
      const errors = validateChangePasswordForm(data);

      // Assert
      expect(errors.newPassword).toBeUndefined();
    });
  });

  describe("確認用パスワード", () => {
    it("空の場合エラーになること", () => {
      // Arrange
      const data = { currentPassword: "OldPass123", newPassword: "NewPass123", confirmPassword: "" };

      // Act
      const errors = validateChangePasswordForm(data);

      // Assert
      expect(errors.confirmPassword).toBe("確認用パスワードを入力してください");
    });

    it("新しいパスワードと一致しない場合エラーになること", () => {
      // Arrange
      const data = { currentPassword: "OldPass123", newPassword: "NewPass123", confirmPassword: "Different123" };

      // Act
      const errors = validateChangePasswordForm(data);

      // Assert
      expect(errors.confirmPassword).toBe("パスワードが一致しません");
    });

    it("新しいパスワードと一致する場合エラーにならないこと", () => {
      // Arrange
      const data = { currentPassword: "OldPass123", newPassword: "NewPass123", confirmPassword: "NewPass123" };

      // Act
      const errors = validateChangePasswordForm(data);

      // Assert
      expect(errors.confirmPassword).toBeUndefined();
    });
  });

  describe("全フィールドが有効な場合", () => {
    it("エラーが空であること", () => {
      // Arrange
      const data = { currentPassword: "OldPass123", newPassword: "NewPass123", confirmPassword: "NewPass123" };

      // Act
      const errors = validateChangePasswordForm(data);

      // Assert
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});

describe("ChangePasswordScreen", () => {
  describe("画面表示", () => {
    it("パスワード変更画面が表示されること", () => {
      // Arrange
      render(<ChangePasswordScreen />);

      // Assert
      expect(screen.getByTestId("change-password-screen")).toBeTruthy();
    });

    it("現在のパスワード入力フィールドが表示されること", () => {
      // Arrange
      render(<ChangePasswordScreen />);

      // Assert
      expect(screen.getByPlaceholderText("現在のパスワードを入力")).toBeTruthy();
    });

    it("新しいパスワード入力フィールドが表示されること", () => {
      // Arrange
      render(<ChangePasswordScreen />);

      // Assert
      expect(screen.getByPlaceholderText("新しいパスワードを入力")).toBeTruthy();
    });

    it("確認用パスワード入力フィールドが表示されること", () => {
      // Arrange
      render(<ChangePasswordScreen />);

      // Assert
      expect(screen.getByPlaceholderText("新しいパスワードを再入力")).toBeTruthy();
    });

    it("変更するボタンが表示されること", () => {
      // Arrange
      render(<ChangePasswordScreen />);

      // Assert
      expect(screen.getByText("変更する")).toBeTruthy();
    });
  });

  describe("ナビゲーション", () => {
    it("戻るボタンを押すと前の画面に戻ること", () => {
      // Arrange
      render(<ChangePasswordScreen />);

      // Act
      fireEvent.press(screen.getByTestId("change-password-back-button"));

      // Assert
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("バリデーション", () => {
    it("現在のパスワードが空の場合エラーメッセージが表示されること", async () => {
      // Arrange
      render(<ChangePasswordScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを再入力"), "NewPass123");

      // Act
      fireEvent.press(screen.getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("現在のパスワードを入力してください")).toBeTruthy();
      });
    });

    it("新しいパスワードが空の場合エラーメッセージが表示されること", async () => {
      // Arrange
      render(<ChangePasswordScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("現在のパスワードを入力"), "OldPass123");

      // Act
      fireEvent.press(screen.getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("新しいパスワードを入力してください")).toBeTruthy();
      });
    });

    it("パスワードが一致しない場合エラーメッセージが表示されること", async () => {
      // Arrange
      render(<ChangePasswordScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("現在のパスワードを入力"), "OldPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを再入力"), "DifferentPass123");

      // Act
      fireEvent.press(screen.getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("パスワードが一致しません")).toBeTruthy();
      });
    });

    it("バリデーションエラーがある場合changePasswordが呼ばれないこと", async () => {
      // Arrange
      render(<ChangePasswordScreen />);

      // Act
      fireEvent.press(screen.getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(mockChangePassword).not.toHaveBeenCalled();
      });
    });
  });

  describe("パスワード変更成功", () => {
    it("成功時にchangePasswordが正しい引数で呼ばれること", async () => {
      // Arrange
      mockChangePassword.mockResolvedValue(undefined);
      render(<ChangePasswordScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("現在のパスワードを入力"), "OldPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを再入力"), "NewPass123");

      // Act
      fireEvent.press(screen.getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith("OldPass123", "NewPass123");
      });
    });

    it("成功後に前の画面に戻ること", async () => {
      // Arrange
      mockChangePassword.mockResolvedValue(undefined);
      render(<ChangePasswordScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("現在のパスワードを入力"), "OldPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを再入力"), "NewPass123");

      // Act
      fireEvent.press(screen.getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(mockBack).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("パスワード変更失敗", () => {
    it("変更失敗時にエラーアラートが表示されること", async () => {
      // Arrange
      mockChangePassword.mockRejectedValue(new Error("現在のパスワードが正しくありません"));
      render(<ChangePasswordScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("現在のパスワードを入力"), "WrongPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを再入力"), "NewPass123");

      // Act
      fireEvent.press(screen.getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith("エラー", expect.stringContaining("パスワードの変更に失敗しました"));
      });
    });

    it("変更失敗時に前の画面に戻らないこと", async () => {
      // Arrange
      mockChangePassword.mockRejectedValue(new Error("エラー"));
      render(<ChangePasswordScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("現在のパスワードを入力"), "WrongPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      fireEvent.changeText(screen.getByPlaceholderText("新しいパスワードを再入力"), "NewPass123");

      // Act
      fireEvent.press(screen.getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(mockBack).not.toHaveBeenCalled();
      });
    });
  });
});
