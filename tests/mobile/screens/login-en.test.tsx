/**
 * ログイン画面 英語ロケールテスト
 *
 * en ロケール設定時に主要 UI 文言が英語で表示されることを確認する。
 */
import LoginScreen from "@mobile-app/(auth)/login";
import { render } from "@testing-library/react-native";

import { setMockLocale } from "../helpers/i18n-test-utils";

const mockSignIn = jest.fn();

jest.mock("@mobile/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      signIn: mockSignIn,
    }),
  ),
}));

jest.mock("@/lib/api", () => ({
  getBaseUrl: jest.fn(() => "http://localhost:8787"),
  fetchWithTimeout: jest.fn((url: string, options: RequestInit) => fetch(url, options)),
}));

beforeEach(() => {
  setMockLocale("en");
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

afterEach(() => {
  setMockLocale("ja");
});

// NOTE: @testing-library/react-native v13+ では render() が Promise を返す
describe("LoginScreen（英語ロケール）", () => {
  describe("ページタイトル・タグライン", () => {
    it("アプリタグラインが英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<LoginScreen />);

      // Assert
      expect(getByText("Tech news summarized by AI")).toBeTruthy();
    });
  });

  describe("フォームラベル", () => {
    it("メールアドレスラベルが英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<LoginScreen />);

      // Assert
      expect(getByText("Email")).toBeTruthy();
    });

    it("パスワードラベルが英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<LoginScreen />);

      // Assert
      expect(getByText("Password")).toBeTruthy();
    });
  });

  describe("ボタン・リンク", () => {
    it("ログインボタンが英語で表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<LoginScreen />);

      // Assert
      expect(getByTestId("login-submit-button")).toBeTruthy();
    });

    it("パスワードリセット導線が英語で表示されること", async () => {
      // Arrange & Act
      const { getByLabelText } = await render(<LoginScreen />);

      // Assert
      expect(getByLabelText("Forgot password?")).toBeTruthy();
    });

    it("Googleログイン導線が英語で表示されること", async () => {
      // Arrange & Act
      const { getByLabelText } = await render(<LoginScreen />);

      // Assert
      expect(getByLabelText("Continue with Google")).toBeTruthy();
    });

    it("GitHubログイン導線が英語で表示されること", async () => {
      // Arrange & Act
      const { getByLabelText } = await render(<LoginScreen />);

      // Assert
      expect(getByLabelText("Continue with GitHub")).toBeTruthy();
    });
  });

  describe("日本語ハードコードの不在確認", () => {
    it("「ログイン」という日本語テキストが表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = await render(<LoginScreen />);

      // Assert
      expect(queryByText("ログイン")).toBeNull();
    });

    it("「メールアドレス」という日本語テキストが表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = await render(<LoginScreen />);

      // Assert
      expect(queryByText("メールアドレス")).toBeNull();
    });

    it("「パスワード」という日本語テキストが表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = await render(<LoginScreen />);

      // Assert
      expect(queryByText("パスワード")).toBeNull();
    });
  });
});
