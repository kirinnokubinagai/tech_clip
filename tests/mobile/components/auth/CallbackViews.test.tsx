import { CallbackErrorView, CallbackLoadingView } from "@mobile/components/auth/CallbackViews";
import { fireEvent, render } from "@testing-library/react-native";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("CallbackErrorView", () => {
  const DEFAULT_PROPS = {
    message: "認証に失敗しました",
    errorTestId: "error-text",
    backButtonTestId: "back-button",
    onBackToLogin: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("レンダリング", () => {
    it("エラーメッセージが表示されること", async () => {
      const { getByText } = await render(<CallbackErrorView {...DEFAULT_PROPS} />);

      expect(getByText("認証に失敗しました")).toBeTruthy();
    });

    it("errorTestId が設定されること", async () => {
      const { getByTestId } = await render(<CallbackErrorView {...DEFAULT_PROPS} />);

      expect(getByTestId("error-text")).toBeTruthy();
    });

    it("backButtonTestId が設定されること", async () => {
      const { getByTestId } = await render(<CallbackErrorView {...DEFAULT_PROPS} />);

      expect(getByTestId("back-button")).toBeTruthy();
    });

    it("翻訳された戻るボタンラベルを使うこと", async () => {
      const { getByLabelText } = await render(<CallbackErrorView {...DEFAULT_PROPS} />);

      expect(getByLabelText("auth.callback.backToLogin")).toBeTruthy();
    });
  });

  describe("インタラクション", () => {
    it("戻るボタンを押すと onBackToLogin が呼ばれること", async () => {
      const onBackToLogin = jest.fn();
      const { getByTestId } = await render(
        <CallbackErrorView {...DEFAULT_PROPS} onBackToLogin={onBackToLogin} />,
      );

      fireEvent.press(getByTestId("back-button"));

      expect(onBackToLogin).toHaveBeenCalledTimes(1);
    });
  });

  describe("アクセシビリティ", () => {
    it("エラーテキストに accessibilityRole='alert' が設定されていること", async () => {
      const { getByRole } = await render(<CallbackErrorView {...DEFAULT_PROPS} />);

      expect(getByRole("alert")).toBeTruthy();
    });
  });
});

describe("CallbackLoadingView", () => {
  const DEFAULT_PROPS = {
    loadingTestId: "loading-indicator",
    message: "認証処理中...",
  };

  describe("レンダリング", () => {
    it("ローディングメッセージが表示されること", async () => {
      const { getByText } = await render(<CallbackLoadingView {...DEFAULT_PROPS} />);

      expect(getByText("認証処理中...")).toBeTruthy();
    });

    it("ActivityIndicator が testID 付きで表示されること", async () => {
      const { getByTestId } = await render(<CallbackLoadingView {...DEFAULT_PROPS} />);

      expect(getByTestId("loading-indicator")).toBeTruthy();
    });

    it("ActivityIndicator の accessibilityLabel にメッセージが設定されること", async () => {
      const { getByTestId } = await render(<CallbackLoadingView {...DEFAULT_PROPS} />);

      expect(getByTestId("loading-indicator").props.accessibilityLabel).toBe("認証処理中...");
    });
  });
});
