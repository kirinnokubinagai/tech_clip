jest.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ white: "#ffffff" }),
}));

import { AuthSubmitButton } from "@mobile/components/auth/AuthSubmitButton";
import { fireEvent, render } from "@testing-library/react-native";

describe("AuthSubmitButton", () => {
  const DEFAULT_PROPS = {
    label: "ログイン",
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("レンダリング", () => {
    it("ラベルを表示できること", async () => {
      const { getByText } = await render(<AuthSubmitButton {...DEFAULT_PROPS} />);

      expect(getByText("ログイン")).toBeTruthy();
    });

    it("isLoading 時にラベルが非表示になること", async () => {
      const { queryByText } = await render(
        <AuthSubmitButton {...DEFAULT_PROPS} isLoading testID="submit-btn" />,
      );

      expect(queryByText("ログイン")).toBeNull();
    });

    it("isLoading 時でもボタン自体は残ること", async () => {
      const { queryByText, getByRole } = await render(
        <AuthSubmitButton {...DEFAULT_PROPS} isLoading />,
      );

      expect(queryByText("ログイン")).toBeNull();
      expect(getByRole("button")).toBeTruthy();
    });

    it("textClassName をラベルへ適用できること", async () => {
      const { getByText } = await render(
        <AuthSubmitButton {...DEFAULT_PROPS} textClassName="text-success" />,
      );

      expect(getByText("ログイン").props.className).toContain("text-success");
    });

    it("testID が設定されること", async () => {
      const { getByTestId } = await render(
        <AuthSubmitButton {...DEFAULT_PROPS} testID="submit-button" />,
      );

      expect(getByTestId("submit-button")).toBeTruthy();
    });
  });

  describe("インタラクション", () => {
    it("押下時に onPress が呼ばれること", async () => {
      const onPress = jest.fn();
      const { getByTestId } = await render(
        <AuthSubmitButton label="送信" onPress={onPress} testID="submit-btn" />,
      );

      fireEvent.press(getByTestId("submit-btn"));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("disabled 時に onPress が呼ばれないこと", async () => {
      const onPress = jest.fn();
      const { getByTestId } = await render(
        <AuthSubmitButton label="送信" onPress={onPress} testID="submit-btn" disabled />,
      );

      fireEvent.press(getByTestId("submit-btn"));

      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe("アクセシビリティ", () => {
    it("accessibilityRole が button であること", async () => {
      const { getByRole } = await render(<AuthSubmitButton {...DEFAULT_PROPS} />);

      expect(getByRole("button")).toBeTruthy();
    });

    it("accessibilityLabel にラベルが設定されること", async () => {
      const { getByLabelText } = await render(<AuthSubmitButton {...DEFAULT_PROPS} />);

      expect(getByLabelText("ログイン")).toBeTruthy();
    });
  });
});
