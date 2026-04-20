import RegisterScreen from "@mobile-app/(auth)/register";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

const mockSignUp = jest.fn();

jest.mock("@mobile/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      signUp: mockSignUp,
    }),
  ),
}));

jest.mock("@/lib/api", () => ({
  getBaseUrl: jest.fn(() => "http://localhost:8787"),
  fetchWithTimeout: jest.fn((url: string, options: RequestInit) => fetch(url, options)),
}));

const mockOpenUrl = jest.spyOn(Linking, "openURL").mockResolvedValue();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("RegisterScreen", () => {
  describe("新規登録フォーム送信", () => {
    it("有効な入力でsignUpが呼ばれること", async () => {
      // Arrange
      mockSignUp.mockResolvedValue(undefined);
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("お名前（任意）"), "テストユーザー");
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

    it("名前が空でもsignUpがname=undefinedで呼ばれること", async () => {
      // Arrange
      mockSignUp.mockResolvedValue(undefined);
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("メールアドレス"), "test@example.com");
      await fireEvent.changeText(getByLabelText("パスワード"), "Password123");

      // Act
      await fireEvent.press(getByLabelText("アカウントを作成"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledTimes(1);
        expect(mockSignUp).toHaveBeenCalledWith({
          name: undefined,
          email: "test@example.com",
          password: "Password123",
        });
      });
    });

    it("メールが空の場合signUpが呼ばれないこと", async () => {
      // Arrange
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("お名前（任意）"), "テストユーザー");
      await fireEvent.changeText(getByLabelText("パスワード"), "Password123");

      // Act
      await fireEvent.press(getByLabelText("アカウントを作成"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).not.toHaveBeenCalled();
      });
    });

    it("メールアドレス形式が不正な場合signUpが呼ばれないこと", async () => {
      // Arrange
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("お名前（任意）"), "テストユーザー");
      await fireEvent.changeText(getByLabelText("メールアドレス"), "invalid-email");
      await fireEvent.changeText(getByLabelText("パスワード"), "Password123");

      // Act
      await fireEvent.press(getByLabelText("アカウントを作成"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).not.toHaveBeenCalled();
      });
      expect(getByLabelText("メールアドレスの形式が正しくありません。")).toBeDefined();
    });

    it("パスワードが空の場合signUpが呼ばれないこと", async () => {
      // Arrange
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("お名前（任意）"), "テストユーザー");
      await fireEvent.changeText(getByLabelText("メールアドレス"), "test@example.com");

      // Act
      await fireEvent.press(getByLabelText("アカウントを作成"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).not.toHaveBeenCalled();
      });
    });

    it("パスワードが最小文字数未満の場合signUpが呼ばれないこと", async () => {
      // Arrange
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("お名前（任意）"), "テストユーザー");
      await fireEvent.changeText(getByLabelText("メールアドレス"), "test@example.com");
      await fireEvent.changeText(getByLabelText("パスワード"), "1234567");

      // Act
      await fireEvent.press(getByLabelText("アカウントを作成"));

      // Assert
      await waitFor(() => {
        expect(mockSignUp).not.toHaveBeenCalled();
      });
      expect(getByLabelText("パスワードは8文字以上で入力してください。")).toBeDefined();
    });

    it("signUpが失敗した場合エラーメッセージが表示されること", async () => {
      // Arrange
      mockSignUp.mockRejectedValue(new Error("メールアドレスはすでに使用されています"));
      const { getByLabelText } = await render(<RegisterScreen />);

      await fireEvent.changeText(getByLabelText("お名前（任意）"), "テストユーザー");
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

  describe("OAuthボタン表示", () => {
    it("Google で登録ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByLabelText } = await render(<RegisterScreen />);

      // Assert
      expect(getByLabelText("Google で登録")).toBeDefined();
    });

    it("GitHub で登録ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByLabelText } = await render(<RegisterScreen />);

      // Assert
      expect(getByLabelText("GitHub で登録")).toBeDefined();
    });

    it("Apple で登録ボタンがiOS環境で表示されること", async () => {
      // Arrange & Act (jest-expo はデフォルトで iOS 環境)
      const { getByLabelText } = await render(<RegisterScreen />);

      // Assert
      expect(getByLabelText("Apple で登録")).toBeDefined();
    });

    it("Google で登録押下時に認可URLを開くこと", async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://accounts.google.com/o/oauth2/auth" }),
      });
      const { getByLabelText } = await render(<RegisterScreen />);

      // Act
      await fireEvent.press(getByLabelText("Google で登録"));

      // Assert
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "http://localhost:8787/api/auth/sign-in/social",
          expect.objectContaining({
            method: "POST",
          }),
        );
        expect(mockOpenUrl).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth");
      });
    });

    it("OAuthソーシャル登録開始に失敗した場合エラーメッセージが表示されること", async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({}),
      });
      const { getByLabelText, findByLabelText } = await render(<RegisterScreen />);

      // Act
      await fireEvent.press(getByLabelText("GitHub で登録"));

      // Assert
      expect(
        await findByLabelText("ソーシャルログインの開始に失敗しました。もう一度お試しください。"),
      ).toBeDefined();
    });

    it("https以外のURLが返された場合は遷移せずエラーメッセージを表示すること", async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ url: "javascript:alert('xss')" }),
      });
      const { getByLabelText, findByLabelText } = await render(<RegisterScreen />);

      // Act
      await fireEvent.press(getByLabelText("GitHub で登録"));

      // Assert
      expect(
        await findByLabelText("ソーシャルログインの開始に失敗しました。もう一度お試しください。"),
      ).toBeDefined();
      expect(mockOpenUrl).not.toHaveBeenCalled();
    });
  });
});
