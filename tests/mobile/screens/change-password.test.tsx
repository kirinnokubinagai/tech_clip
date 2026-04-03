import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import ChangePasswordScreen, {
  validateChangePasswordForm,
} from "../../../apps/mobile/app/settings/change-password";
import jaTranslations from "../../../apps/mobile/src/locales/ja.json";

/**
 * テスト用翻訳関数（ja.jsonから実際の日本語テキストを解決する）
 */
function resolveKey(obj: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return key;
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (current !== undefined && current !== null) {
    return String(current);
  }
  return key;
}

function t(key: string, opts?: Record<string, unknown>): string {
  const value = resolveKey(jaTranslations as unknown as Record<string, unknown>, key);
  if (opts && typeof value === "string") {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      opts[k] !== undefined ? String(opts[k]) : `{{${k}}}`,
    );
  }
  return value;
}

const mockBack = jest.fn();
const mockChangePassword = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("../../../apps/mobile/src/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      changePassword: mockChangePassword,
    }),
  ),
}));

jest.mock("@/components/ui/Toast", () => ({
  Toast: () => null,
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: { message: "", variant: "info", visible: false },
    show: jest.fn(),
    dismiss: jest.fn(),
  }),
}));

jest.spyOn(Alert, "alert");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateChangePasswordForm", () => {
  describe("現在のパスワード", () => {
    it("空の場合エラーになること", () => {
      // Arrange
      const data = {
        currentPassword: "",
        newPassword: "NewPass123",
        confirmPassword: "NewPass123",
      };

      // Act
      const errors = validateChangePasswordForm(data, t);

      // Assert
      expect(errors.currentPassword).toBe("現在のパスワードを入力してください");
    });
  });

  describe("新しいパスワード", () => {
    it("空の場合エラーになること", () => {
      // Arrange
      const data = { currentPassword: "OldPass123", newPassword: "", confirmPassword: "" };

      // Act
      const errors = validateChangePasswordForm(data, t);

      // Assert
      expect(errors.newPassword).toBe("新しいパスワードを入力してください");
    });

    it("7文字の場合エラーになること", () => {
      // Arrange
      const data = {
        currentPassword: "OldPass123",
        newPassword: "Pass123",
        confirmPassword: "Pass123",
      };

      // Act
      const errors = validateChangePasswordForm(data, t);

      // Assert
      expect(errors.newPassword).toBe("パスワードは8文字以上で入力してください");
    });

    it("8文字の場合エラーにならないこと", () => {
      // Arrange
      const data = {
        currentPassword: "OldPass123",
        newPassword: "Pass1234",
        confirmPassword: "Pass1234",
      };

      // Act
      const errors = validateChangePasswordForm(data, t);

      // Assert
      expect(errors.newPassword).toBeUndefined();
    });
  });

  describe("確認用パスワード", () => {
    it("空の場合エラーになること", () => {
      // Arrange
      const data = {
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "",
      };

      // Act
      const errors = validateChangePasswordForm(data, t);

      // Assert
      expect(errors.confirmPassword).toBe("確認用パスワードを入力してください");
    });

    it("新しいパスワードと一致しない場合エラーになること", () => {
      // Arrange
      const data = {
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "Different123",
      };

      // Act
      const errors = validateChangePasswordForm(data, t);

      // Assert
      expect(errors.confirmPassword).toBe("パスワードが一致しません");
    });

    it("新しいパスワードと一致する場合エラーにならないこと", () => {
      // Arrange
      const data = {
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "NewPass123",
      };

      // Act
      const errors = validateChangePasswordForm(data, t);

      // Assert
      expect(errors.confirmPassword).toBeUndefined();
    });
  });

  describe("全フィールドが有効な場合", () => {
    it("エラーが空であること", () => {
      // Arrange
      const data = {
        currentPassword: "OldPass123",
        newPassword: "NewPass123",
        confirmPassword: "NewPass123",
      };

      // Act
      const errors = validateChangePasswordForm(data, t);

      // Assert
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});

describe("ChangePasswordScreen", () => {
  describe("画面表示", () => {
    it("パスワード変更画面が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ChangePasswordScreen />);

      // Assert
      expect(getByTestId("change-password-screen")).toBeDefined();
    });

    it("現在のパスワード入力フィールドが表示されること", async () => {
      // Arrange & Act
      const { getByPlaceholderText } = await render(<ChangePasswordScreen />);

      // Assert
      expect(getByPlaceholderText("現在のパスワードを入力")).toBeDefined();
    });

    it("新しいパスワード入力フィールドが表示されること", async () => {
      // Arrange & Act
      const { getByPlaceholderText } = await render(<ChangePasswordScreen />);

      // Assert
      expect(getByPlaceholderText("新しいパスワードを入力")).toBeDefined();
    });

    it("確認用パスワード入力フィールドが表示されること", async () => {
      // Arrange & Act
      const { getByPlaceholderText } = await render(<ChangePasswordScreen />);

      // Assert
      expect(getByPlaceholderText("新しいパスワードを再入力")).toBeDefined();
    });

    it("変更するボタンが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ChangePasswordScreen />);

      // Assert
      expect(getByText("変更する")).toBeDefined();
    });
  });

  describe("ナビゲーション", () => {
    it("戻るボタンを押すと前の画面に戻ること", async () => {
      // Arrange
      const { getByTestId } = await render(<ChangePasswordScreen />);

      // Act
      await fireEvent.press(getByTestId("change-password-back-button"));

      // Assert
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("バリデーション", () => {
    it("現在のパスワードが空の場合エラーメッセージが表示されること", async () => {
      // Arrange
      const { getByPlaceholderText, getByText } = await render(<ChangePasswordScreen />);
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを再入力"), "NewPass123");

      // Act
      await fireEvent.press(getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(getByText("現在のパスワードを入力してください")).toBeDefined();
      });
    });

    it("新しいパスワードが空の場合エラーメッセージが表示されること", async () => {
      // Arrange
      const { getByPlaceholderText, getByText } = await render(<ChangePasswordScreen />);
      await fireEvent.changeText(getByPlaceholderText("現在のパスワードを入力"), "OldPass123");

      // Act
      await fireEvent.press(getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(getByText("新しいパスワードを入力してください")).toBeDefined();
      });
    });

    it("パスワードが一致しない場合エラーメッセージが表示されること", async () => {
      // Arrange
      const { getByPlaceholderText, getByText } = await render(<ChangePasswordScreen />);
      await fireEvent.changeText(getByPlaceholderText("現在のパスワードを入力"), "OldPass123");
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      await fireEvent.changeText(
        getByPlaceholderText("新しいパスワードを再入力"),
        "DifferentPass123",
      );

      // Act
      await fireEvent.press(getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(getByText("パスワードが一致しません")).toBeDefined();
      });
    });

    it("バリデーションエラーがある場合changePasswordが呼ばれないこと", async () => {
      // Arrange
      const { getByText } = await render(<ChangePasswordScreen />);

      // Act
      await fireEvent.press(getByText("変更する"));

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
      const { getByPlaceholderText, getByText } = await render(<ChangePasswordScreen />);
      await fireEvent.changeText(getByPlaceholderText("現在のパスワードを入力"), "OldPass123");
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを再入力"), "NewPass123");

      // Act
      await fireEvent.press(getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith("OldPass123", "NewPass123");
      });
    });

    it("成功後に前の画面に戻ること", async () => {
      // Arrange
      mockChangePassword.mockResolvedValue(undefined);
      const { getByPlaceholderText, getByText } = await render(<ChangePasswordScreen />);
      await fireEvent.changeText(getByPlaceholderText("現在のパスワードを入力"), "OldPass123");
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを再入力"), "NewPass123");

      // Act
      await fireEvent.press(getByText("変更する"));

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
      const { getByPlaceholderText, getByText } = await render(<ChangePasswordScreen />);
      await fireEvent.changeText(getByPlaceholderText("現在のパスワードを入力"), "WrongPass123");
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを再入力"), "NewPass123");

      // Act
      await fireEvent.press(getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          "エラー",
          expect.stringContaining("パスワードの変更に失敗しました"),
        );
      });
    });

    it("変更失敗時に前の画面に戻らないこと", async () => {
      // Arrange
      mockChangePassword.mockRejectedValue(new Error("エラー"));
      const { getByPlaceholderText, getByText } = await render(<ChangePasswordScreen />);
      await fireEvent.changeText(getByPlaceholderText("現在のパスワードを入力"), "WrongPass123");
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを入力"), "NewPass123");
      await fireEvent.changeText(getByPlaceholderText("新しいパスワードを再入力"), "NewPass123");

      // Act
      await fireEvent.press(getByText("変更する"));

      // Assert
      await waitFor(() => {
        expect(mockBack).not.toHaveBeenCalled();
      });
    });
  });
});
