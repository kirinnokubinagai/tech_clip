import { fireEvent, render, waitFor } from "@testing-library/react-native";

import RegisterScreen from "../../app/(auth)/register";

const mockSignUp = jest.fn();

jest.mock("../../src/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      signUp: mockSignUp,
    }),
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RegisterScreen", () => {
  describe("新規登録フォーム送信", () => {
    it("有効な入力でsignUpが呼ばれること", async () => {
      // Arrange
      mockSignUp.mockResolvedValue(undefined);
      const { getByDisplayValue, getByAccessibilityHint } = render(<RegisterScreen />);

      fireEvent.changeText(getByAccessibilityHint("お名前を入力してください"), "テストユーザー");
      fireEvent.changeText(getByAccessibilityHint("メールアドレスを入力してください"), "test@example.com");
      fireEvent.changeText(getByAccessibilityHint("8文字以上のパスワードを入力してください"), "Password123");

      // Act
      fireEvent.press(getByAccessibilityHint("入力した情報で新規アカウントを作成します"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledTimes(1);
        expect(mockSignUp).toHaveBeenCalledWith({
          name: "テストユーザー",
          email: "test@example.com",
          password: "Password123",
        });
      });
    });

    it("名前が空の場合signUpが呼ばれないこと", async () => {
      // Arrange
      const { getByAccessibilityHint } = render(<RegisterScreen />);

      fireEvent.changeText(getByAccessibilityHint("メールアドレスを入力してください"), "test@example.com");
      fireEvent.changeText(getByAccessibilityHint("8文字以上のパスワードを入力してください"), "Password123");

      // Act
      fireEvent.press(getByAccessibilityHint("入力した情報で新規アカウントを作成します"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).not.toHaveBeenCalled();
      });
    });

    it("メールが空の場合signUpが呼ばれないこと", async () => {
      // Arrange
      const { getByAccessibilityHint } = render(<RegisterScreen />);

      fireEvent.changeText(getByAccessibilityHint("お名前を入力してください"), "テストユーザー");
      fireEvent.changeText(getByAccessibilityHint("8文字以上のパスワードを入力してください"), "Password123");

      // Act
      fireEvent.press(getByAccessibilityHint("入力した情報で新規アカウントを作成します"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).not.toHaveBeenCalled();
      });
    });

    it("パスワードが空の場合signUpが呼ばれないこと", async () => {
      // Arrange
      const { getByAccessibilityHint } = render(<RegisterScreen />);

      fireEvent.changeText(getByAccessibilityHint("お名前を入力してください"), "テストユーザー");
      fireEvent.changeText(getByAccessibilityHint("メールアドレスを入力してください"), "test@example.com");

      // Act
      fireEvent.press(getByAccessibilityHint("入力した情報で新規アカウントを作成します"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).not.toHaveBeenCalled();
      });
    });

    it("signUpが失敗した場合エラーメッセージが表示されること", async () => {
      // Arrange
      mockSignUp.mockRejectedValue(new Error("メールアドレスはすでに使用されています"));
      const { getByAccessibilityHint, findByText } = render(<RegisterScreen />);

      fireEvent.changeText(getByAccessibilityHint("お名前を入力してください"), "テストユーザー");
      fireEvent.changeText(getByAccessibilityHint("メールアドレスを入力してください"), "test@example.com");
      fireEvent.changeText(getByAccessibilityHint("8文字以上のパスワードを入力してください"), "Password123");

      // Act
      fireEvent.press(getByAccessibilityHint("入力した情報で新規アカウントを作成します"));

      // Assert
      const errorText = await findByText("メールアドレスはすでに使用されています");
      expect(errorText).toBeTruthy();
    });
  });
});
