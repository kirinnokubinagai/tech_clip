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
});
