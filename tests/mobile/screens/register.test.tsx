import RegisterScreen from "@mobile-app/(auth)/register";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockSignUp = jest.fn();

jest.mock("@mobile/stores/auth-store", () => ({
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
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("名前"), "テストユーザー");
      await fireEvent.changeText(getByLabelText("メールアドレス"), "test@example.com");
      await fireEvent.changeText(getByLabelText("パスワード"), "Password123");

      // Act
      await fireEvent.press(getByLabelText("アカウントを作成"));

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
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("メールアドレス"), "test@example.com");
      await fireEvent.changeText(getByLabelText("パスワード"), "Password123");

      // Act
      await fireEvent.press(getByLabelText("アカウントを作成"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).not.toHaveBeenCalled();
      });
    });

    it("メールが空の場合signUpが呼ばれないこと", async () => {
      // Arrange
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("名前"), "テストユーザー");
      await fireEvent.changeText(getByLabelText("パスワード"), "Password123");

      // Act
      await fireEvent.press(getByLabelText("アカウントを作成"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).not.toHaveBeenCalled();
      });
    });

    it("パスワードが空の場合signUpが呼ばれないこと", async () => {
      // Arrange
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("名前"), "テストユーザー");
      await fireEvent.changeText(getByLabelText("メールアドレス"), "test@example.com");

      // Act
      await fireEvent.press(getByLabelText("アカウントを作成"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).not.toHaveBeenCalled();
      });
    });

    it("signUpが失敗した場合エラーメッセージが表示されること", async () => {
      // Arrange
      mockSignUp.mockRejectedValue(new Error("メールアドレスはすでに使用されています"));
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("名前"), "テストユーザー");
      await fireEvent.changeText(getByLabelText("メールアドレス"), "test@example.com");
      await fireEvent.changeText(getByLabelText("パスワード"), "Password123");

      // Act
      await act(async () => {
        await fireEvent.press(getByLabelText("アカウントを作成"));
      });

      // Assert: エラーメッセージがaccessibilityLabelとして表示されること
      expect(getByLabelText("メールアドレスはすでに使用されています")).toBeDefined();
    });
  });
});
