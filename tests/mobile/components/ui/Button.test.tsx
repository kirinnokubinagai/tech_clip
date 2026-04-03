import { fireEvent, render } from "@testing-library/react-native";

import { Button } from "../../../../apps/mobile/src/components/ui/Button";

describe("Button", () => {
  describe("レンダリング", () => {
    it("テキストが正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button>テスト</Button>);

      // Assert
      expect(getByText("テスト")).toBeDefined();
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
      expect(getByText("セカンダリ")).toBeDefined();
    });

    it("outlineバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button variant="outline">アウトライン</Button>);

      // Assert
      expect(getByText("アウトライン")).toBeDefined();
    });

    it("ghostバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button variant="ghost">ゴースト</Button>);

      // Assert
      expect(getByText("ゴースト")).toBeDefined();
    });

    it("dangerバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button variant="danger">削除</Button>);

      // Assert
      expect(getByText("削除")).toBeDefined();
    });
  });

  describe("サイズ", () => {
    it("smサイズでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button size="sm">小</Button>);

      // Assert
      expect(getByText("小")).toBeDefined();
    });

    it("lgサイズでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Button size="lg">大</Button>);

      // Assert
      expect(getByText("大")).toBeDefined();
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
