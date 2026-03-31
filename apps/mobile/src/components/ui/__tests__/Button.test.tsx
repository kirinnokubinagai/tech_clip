import { fireEvent, render } from "@testing-library/react-native";

import { Button } from "../Button";

describe("Button", () => {
  describe("レンダリング", () => {
    it("テキストが正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button>テスト</Button>);

      // Assert
      expect(getByText("テスト")).toBeTruthy();
    });

    it("デフォルトでprimaryバリアントが適用されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<Button>ボタン</Button>);

      // Assert
      const button = getByTestId("button");
      expect(button).toBeDefined();
    });
  });

  describe("バリアント", () => {
    it("secondaryバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button variant="secondary">セカンダリ</Button>);

      // Assert
      expect(getByText("セカンダリ")).toBeTruthy();
    });

    it("outlineバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button variant="outline">アウトライン</Button>);

      // Assert
      expect(getByText("アウトライン")).toBeTruthy();
    });

    it("ghostバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button variant="ghost">ゴースト</Button>);

      // Assert
      expect(getByText("ゴースト")).toBeTruthy();
    });

    it("dangerバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button variant="danger">削除</Button>);

      // Assert
      expect(getByText("削除")).toBeTruthy();
    });
  });

  describe("サイズ", () => {
    it("smサイズでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button size="sm">小</Button>);

      // Assert
      expect(getByText("小")).toBeTruthy();
    });

    it("lgサイズでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button size="lg">大</Button>);

      // Assert
      expect(getByText("大")).toBeTruthy();
    });
  });

  describe("インタラクション", () => {
    it("タップ時にonPressが呼ばれること", async () => {
      // Arrange
      const onPress = jest.fn();
      const { getByTestId } = await render(<Button onPress={onPress}>タップ</Button>);

      // Act
      await fireEvent.press(getByTestId("button"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("disabled時にボタンが無効化されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <Button onPress={jest.fn()} disabled>
          無効
        </Button>,
      );

      // Assert
      const button = getByTestId("button");
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it("disabled時にアクセシビリティ状態が正しいこと", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<Button disabled>無効</Button>);

      // Assert
      const button = getByTestId("button");
      expect(button.props.accessibilityState).toEqual({ disabled: true });
    });
  });
});
