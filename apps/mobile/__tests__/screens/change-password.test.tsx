import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

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

/**
 * propsでReactTestInstanceを検索するヘルパー
 */
function findByProps(root: ReactTestInstance, props: Record<string, unknown>): ReactTestInstance {
  return root.findByProps(props);
}

/**
 * placeholder属性でTextInputを検索するヘルパー
 */
function findInputByPlaceholder(root: ReactTestInstance, placeholder: string): ReactTestInstance {
  return root.findByProps({ placeholder });
}

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
      const data = {
        currentPassword: "OldPass123",
        newPassword: "Pass123",
        confirmPassword: "Pass123",
      };

      // Act
      const errors = validateChangePasswordForm(data);

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
      const errors = validateChangePasswordForm(data);

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
      const errors = validateChangePasswordForm(data);

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
      const errors = validateChangePasswordForm(data);

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
      const errors = validateChangePasswordForm(data);

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
      const errors = validateChangePasswordForm(data);

      // Assert
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});

describe("ChangePasswordScreen", () => {
  describe("画面表示", () => {
    it("パスワード変更画面が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ChangePasswordScreen />);

      // Assert
      expect(findByProps(UNSAFE_root, { testID: "change-password-screen" })).toBeDefined();
    });

    it("現在のパスワード入力フィールドが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ChangePasswordScreen />);

      // Assert
      expect(findInputByPlaceholder(UNSAFE_root, "現在のパスワードを入力")).toBeDefined();
    });

    it("新しいパスワード入力フィールドが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ChangePasswordScreen />);

      // Assert
      expect(findInputByPlaceholder(UNSAFE_root, "新しいパスワードを入力")).toBeDefined();
    });

    it("確認用パスワード入力フィールドが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ChangePasswordScreen />);

      // Assert
      expect(findInputByPlaceholder(UNSAFE_root, "新しいパスワードを再入力")).toBeDefined();
    });

    it("変更するボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ChangePasswordScreen />);

      // Assert
      expect(findByProps(UNSAFE_root, { children: "変更する" })).toBeDefined();
    });
  });

  describe("ナビゲーション", () => {
    it("戻るボタンを押すと前の画面に戻ること", () => {
      // Arrange
      const { UNSAFE_root } = render(<ChangePasswordScreen />);

      // Act
      fireEvent.press(findByProps(UNSAFE_root, { testID: "change-password-back-button" }));

      // Assert
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("バリデーション", () => {
    it("現在のパスワードが空の場合エラーメッセージが表示されること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<ChangePasswordScreen />);
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを入力"),
        "NewPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを再入力"),
        "NewPass123",
      );

      // Act
      fireEvent.press(UNSAFE_root.findAllByProps({ children: "変更する" })[0]);

      // Assert
      await waitFor(() => {
        expect(
          UNSAFE_root.findByProps({ children: "現在のパスワードを入力してください" }),
        ).toBeDefined();
      });
    });

    it("新しいパスワードが空の場合エラーメッセージが表示されること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<ChangePasswordScreen />);
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "現在のパスワードを入力"),
        "OldPass123",
      );

      // Act
      fireEvent.press(UNSAFE_root.findAllByProps({ children: "変更する" })[0]);

      // Assert
      await waitFor(() => {
        expect(
          UNSAFE_root.findByProps({ children: "新しいパスワードを入力してください" }),
        ).toBeDefined();
      });
    });

    it("パスワードが一致しない場合エラーメッセージが表示されること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<ChangePasswordScreen />);
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "現在のパスワードを入力"),
        "OldPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを入力"),
        "NewPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを再入力"),
        "DifferentPass123",
      );

      // Act
      fireEvent.press(UNSAFE_root.findAllByProps({ children: "変更する" })[0]);

      // Assert
      await waitFor(() => {
        expect(UNSAFE_root.findByProps({ children: "パスワードが一致しません" })).toBeDefined();
      });
    });

    it("バリデーションエラーがある場合changePasswordが呼ばれないこと", async () => {
      // Arrange
      const { UNSAFE_root } = render(<ChangePasswordScreen />);

      // Act
      fireEvent.press(UNSAFE_root.findAllByProps({ children: "変更する" })[0]);

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
      const { UNSAFE_root } = render(<ChangePasswordScreen />);
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "現在のパスワードを入力"),
        "OldPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを入力"),
        "NewPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを再入力"),
        "NewPass123",
      );

      // Act
      fireEvent.press(UNSAFE_root.findAllByProps({ children: "変更する" })[0]);

      // Assert
      await waitFor(() => {
        expect(mockChangePassword).toHaveBeenCalledWith("OldPass123", "NewPass123");
      });
    });

    it("成功後に前の画面に戻ること", async () => {
      // Arrange
      mockChangePassword.mockResolvedValue(undefined);
      const { UNSAFE_root } = render(<ChangePasswordScreen />);
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "現在のパスワードを入力"),
        "OldPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを入力"),
        "NewPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを再入力"),
        "NewPass123",
      );

      // Act
      fireEvent.press(UNSAFE_root.findAllByProps({ children: "変更する" })[0]);

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
      const { UNSAFE_root } = render(<ChangePasswordScreen />);
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "現在のパスワードを入力"),
        "WrongPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを入力"),
        "NewPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを再入力"),
        "NewPass123",
      );

      // Act
      fireEvent.press(UNSAFE_root.findAllByProps({ children: "変更する" })[0]);

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
      const { UNSAFE_root } = render(<ChangePasswordScreen />);
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "現在のパスワードを入力"),
        "WrongPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを入力"),
        "NewPass123",
      );
      fireEvent.changeText(
        findInputByPlaceholder(UNSAFE_root, "新しいパスワードを再入力"),
        "NewPass123",
      );

      // Act
      fireEvent.press(UNSAFE_root.findAllByProps({ children: "変更する" })[0]);

      // Assert
      await waitFor(() => {
        expect(mockBack).not.toHaveBeenCalled();
      });
    });
  });
});
