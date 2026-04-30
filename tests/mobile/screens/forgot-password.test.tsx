import ForgotPasswordScreen from "@mobile-app/(auth)/forgot-password";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/api", () => ({
  getBaseUrl: jest.fn(() => "http://localhost:8787"),
  fetchWithTimeout: jest.fn((url: string, options: RequestInit) => fetch(url, options)),
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("ForgotPasswordScreen", () => {
  it("メールアドレス形式が不正な場合にバリデーションエラーを表示すること", async () => {
    // Arrange
    const { getByLabelText, findByLabelText } = await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(getByLabelText("メールアドレス"), "invalid-email");

    // Act
    await fireEvent.press(getByLabelText("リセットメールを送信"));

    // Assert
    expect(await findByLabelText("メールアドレスの形式が正しくありません。")).toBeDefined();
  });

  it("メールアドレス未入力時にバリデーションエラーを表示すること", async () => {
    // Arrange
    const { getByLabelText, findByLabelText } = await render(<ForgotPasswordScreen />);

    // Act
    await fireEvent.press(getByLabelText("リセットメールを送信"));

    // Assert
    expect(await findByLabelText("メールアドレスを入力してください。")).toBeDefined();
  });

  it("送信成功時に成功メッセージを表示すること", async () => {
    // Arrange
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          message: "パスワードリセットのメールを送信しました。メールをご確認ください。",
        },
      }),
    });
    const { getByLabelText, findByLabelText } = await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(getByLabelText("メールアドレス"), "test@example.com");

    // Act
    await fireEvent.press(getByLabelText("リセットメールを送信"));

    // Assert
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8787/api/auth/forgot-password",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(
      await findByLabelText("パスワードリセットのメールを送信しました。メールをご確認ください。"),
    ).toBeDefined();
  });

  it("成功レスポンスのJSON解析に失敗しても成功メッセージを表示すること", async () => {
    // Arrange
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("invalid json");
      },
    });
    const { getByLabelText, findByLabelText } = await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(getByLabelText("メールアドレス"), "test@example.com");

    // Act
    await fireEvent.press(getByLabelText("リセットメールを送信"));

    // Assert
    expect(
      await findByLabelText("パスワードリセットのメールを送信しました。メールをご確認ください。"),
    ).toBeDefined();
  });

  it("APIエラー時も成功メッセージを表示すること", async () => {
    // Arrange
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          message: "該当するメールアドレスが見つかりません",
        },
      }),
    });
    const { getByLabelText, findByLabelText, queryByLabelText } = await render(
      <ForgotPasswordScreen />,
    );

    await fireEvent.changeText(getByLabelText("メールアドレス"), "missing@example.com");

    // Act
    await fireEvent.press(getByLabelText("リセットメールを送信"));

    // Assert
    expect(
      await findByLabelText("パスワードリセットのメールを送信しました。メールをご確認ください。"),
    ).toBeDefined();
    expect(queryByLabelText("該当するメールアドレスが見つかりません")).toBeNull();
  });

  it("APIエラー時にJSONを読まずに成功メッセージを返すこと", async () => {
    // Arrange
    const mockJson = jest.fn(async () => {
      throw new Error("invalid json");
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: mockJson,
    });
    const { getByLabelText, findByLabelText } = await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(getByLabelText("メールアドレス"), "missing@example.com");

    // Act
    await fireEvent.press(getByLabelText("リセットメールを送信"));

    // Assert
    expect(
      await findByLabelText("パスワードリセットのメールを送信しました。メールをご確認ください。"),
    ).toBeDefined();
    expect(mockJson).not.toHaveBeenCalled();
  });

  it("ネットワークエラー時に共通エラーメッセージを表示すること", async () => {
    // Arrange
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network error"));
    const { getByLabelText, findByLabelText } = await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(getByLabelText("メールアドレス"), "test@example.com");

    // Act
    await fireEvent.press(getByLabelText("リセットメールを送信"));

    // Assert
    expect(await findByLabelText("エラーが発生しました。")).toBeDefined();
  });
});
