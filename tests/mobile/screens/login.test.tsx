import LoginScreen from "@mobile-app/(auth)/login";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

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

const mockOpenUrl = jest.spyOn(Linking, "openURL").mockResolvedValue();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("LoginScreen", () => {
  it("パスワードリセット導線が表示されること", async () => {
    // Arrange & Act
    const { getByLabelText } = await render(<LoginScreen />);

    // Assert
    expect(getByLabelText("パスワードを忘れた方")).toBeDefined();
  });

  it("Google ログイン導線が表示されること", async () => {
    // Arrange & Act
    const { getByLabelText } = await render(<LoginScreen />);

    // Assert
    expect(getByLabelText("Google でログイン")).toBeDefined();
  });

  it("GitHub ログイン導線が表示されること", async () => {
    // Arrange & Act
    const { getByLabelText } = await render(<LoginScreen />);

    // Assert
    expect(getByLabelText("GitHub でログイン")).toBeDefined();
  });

  it("Google ログイン押下時に認可URLを開くこと", async () => {
    // Arrange
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ redirect: false, url: "https://accounts.google.com/o/oauth2/auth" }),
    });
    const { getByLabelText } = await render(<LoginScreen />);

    // Act
    await fireEvent.press(getByLabelText("Google でログイン"));

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

  it("ソーシャルログイン開始に失敗した場合エラーメッセージが表示されること", async () => {
    // Arrange
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ redirect: false }),
    });
    const { getByLabelText, findByLabelText } = await render(<LoginScreen />);

    // Act
    await fireEvent.press(getByLabelText("GitHub でログイン"));

    // Assert
    expect(
      await findByLabelText("ソーシャルログインの開始に失敗しました。もう一度お試しください。"),
    ).toBeDefined();
  });

  it("非OKレスポンス時はJSONを読まずにエラーメッセージを表示すること", async () => {
    // Arrange
    const json = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json,
    });
    const { getByLabelText, findByLabelText } = await render(<LoginScreen />);

    // Act
    await fireEvent.press(getByLabelText("GitHub でログイン"));

    // Assert
    expect(
      await findByLabelText("ソーシャルログインの開始に失敗しました。もう一度お試しください。"),
    ).toBeDefined();
    expect(json).not.toHaveBeenCalled();
  });

  it("https以外のURLが返された場合は遷移せずエラーメッセージを表示すること", async () => {
    // Arrange
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ url: "javascript:alert('xss')" }),
    });
    const { getByLabelText, findByLabelText } = await render(<LoginScreen />);

    // Act
    await fireEvent.press(getByLabelText("GitHub でログイン"));

    // Assert
    expect(
      await findByLabelText("ソーシャルログインの開始に失敗しました。もう一度お試しください。"),
    ).toBeDefined();
    expect(mockOpenUrl).not.toHaveBeenCalled();
  });

  it("ソーシャルログインでネットワークエラーが発生した場合エラーメッセージを表示すること", async () => {
    // Arrange
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network error"));
    const { getByLabelText, findByLabelText } = await render(<LoginScreen />);

    // Act
    await fireEvent.press(getByLabelText("Google でログイン"));

    // Assert
    expect(
      await findByLabelText("ソーシャルログインの開始に失敗しました。もう一度お試しください。"),
    ).toBeDefined();
  });

  it("ソーシャルログイン中はメール入力欄と全ログインボタンが無効化されること", async () => {
    // Arrange
    let resolveFetch: ((value: unknown) => void) | undefined;
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const { getByLabelText, getByTestId, getAllByText } = await render(<LoginScreen />);

    // Act
    fireEvent.press(getByLabelText("Google でログイン"));

    // Assert
    await waitFor(() => {
      expect(getByTestId("login-email-input").props.editable).toBe(false);
      expect(getByTestId("login-password-input").props.editable).toBe(false);
      expect(getByTestId("login-submit-button").props.accessibilityState.disabled).toBe(true);
      expect(getAllByText("ログイン").length).toBeGreaterThan(0);
      expect(getByLabelText("Google でログイン").props.accessibilityState.disabled).toBe(true);
      expect(getByLabelText("GitHub でログイン").props.accessibilityState.disabled).toBe(true);
    });

    resolveFetch?.({
      ok: true,
      json: async () => ({ url: "https://accounts.google.com/o/oauth2/auth" }),
    });

    await waitFor(() => {
      expect(mockOpenUrl).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth");
    });
  });

  it("メールアドレス未入力時にバリデーションエラーを表示すること", async () => {
    // Arrange
    const { getByTestId, findByLabelText } = await render(<LoginScreen />);

    // Act
    await fireEvent.press(getByTestId("login-submit-button"));

    // Assert
    expect(await findByLabelText("メールアドレスを入力してください")).toBeDefined();
  });

  it("メールアドレス形式が不正な場合にバリデーションエラーを表示すること", async () => {
    // Arrange
    const { getByTestId, findByLabelText } = await render(<LoginScreen />);
    await fireEvent.changeText(getByTestId("login-email-input"), "invalid-email");
    await fireEvent.changeText(getByTestId("login-password-input"), "password123");

    // Act
    await fireEvent.press(getByTestId("login-submit-button"));

    // Assert
    expect(await findByLabelText("メールアドレスの形式が正しくありません")).toBeDefined();
  });

  it("パスワードが短い場合にバリデーションエラーを表示すること", async () => {
    // Arrange
    const { getByTestId, findByLabelText } = await render(<LoginScreen />);
    await fireEvent.changeText(getByTestId("login-email-input"), "test@example.com");
    await fireEvent.changeText(getByTestId("login-password-input"), "1234");

    // Act
    await fireEvent.press(getByTestId("login-submit-button"));

    // Assert
    expect(await findByLabelText("パスワードは8文字以上で入力してください")).toBeDefined();
  });

  it("メールログイン成功時に認証ストアへ委譲すること", async () => {
    // Arrange
    mockSignIn.mockResolvedValue(undefined);
    const { getByTestId } = await render(<LoginScreen />);
    await fireEvent.changeText(getByTestId("login-email-input"), "test@example.com");
    await fireEvent.changeText(getByTestId("login-password-input"), "password123");

    // Act
    await fireEvent.press(getByTestId("login-submit-button"));

    // Assert
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("メールログイン失敗時にエラーメッセージを表示すること", async () => {
    // Arrange
    mockSignIn.mockRejectedValue(new Error("ログインに失敗しました"));
    const { getByTestId, findByLabelText } = await render(<LoginScreen />);
    await fireEvent.changeText(getByTestId("login-email-input"), "test@example.com");
    await fireEvent.changeText(getByTestId("login-password-input"), "password123");

    // Act
    await fireEvent.press(getByTestId("login-submit-button"));

    // Assert
    expect(await findByLabelText("ログインに失敗しました")).toBeDefined();
  });
});
