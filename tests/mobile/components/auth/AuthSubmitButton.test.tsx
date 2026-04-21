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
    it("ラベルテキストが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<AuthSubmitButton {...DEFAULT_PROPS} />);

      // Assert
      expect(getByText("ログイン")).toBeTruthy();
    });

    it("isLoading=trueのときラベルテキストが非表示になること", async () => {
      // Arrange & Act
      const { queryByText } = await render(
        <AuthSubmitButton {...DEFAULT_PROPS} isLoading={true} testID="submit-btn" />,
      );

      // Assert
      expect(queryByText("ログイン")).toBeNull();
    });

    it("isLoading=falseのときラベルが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<AuthSubmitButton {...DEFAULT_PROPS} isLoading={false} />);

      // Assert
      expect(getByText("ログイン")).toBeTruthy();
    });

    it("testIDが設定されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <AuthSubmitButton {...DEFAULT_PROPS} testID="submit-button" />,
      );

      // Assert
      expect(getByTestId("submit-button")).toBeTruthy();
    });
  });

  describe("インタラクション", () => {
    it("ボタンを押すとonPressが呼ばれること", async () => {
      // Arrange
      const onPress = jest.fn();
      const { getByRole } = await render(<AuthSubmitButton label="送信" onPress={onPress} />);

      // Act
      fireEvent.press(getByRole("button"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("disabled=trueのときonPressが呼ばれないこと", async () => {
      // Arrange
      const onPress = jest.fn();
      const { getByRole } = await render(
        <AuthSubmitButton label="送信" onPress={onPress} disabled={true} />,
      );

      // Act
      fireEvent.press(getByRole("button"));

      // Assert
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe("アクセシビリティ", () => {
    it("accessibilityRole='button'が設定されていること", async () => {
      // Arrange & Act
      const { getByRole } = await render(<AuthSubmitButton {...DEFAULT_PROPS} />);

      // Assert
      expect(getByRole("button")).toBeTruthy();
    });

    it("accessibilityLabelにラベルが設定されていること", async () => {
      // Arrange & Act
      const { getByLabelText } = await render(<AuthSubmitButton {...DEFAULT_PROPS} />);

      // Assert
      expect(getByLabelText("ログイン")).toBeTruthy();
    });
  });
});
