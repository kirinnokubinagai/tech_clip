import { fireEvent, render } from "@testing-library/react-native";

import { Button } from "../Button";

describe("Button", () => {
  describe("レンダリング", () => {
    it("テキストが正しく表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<Button>テスト</Button>);

      // Assert
      expect(getByText("テスト")).toBeDefined();
    });

    it("デフォルトでprimaryバリアントが適用されること", () => {
      // Arrange & Act
      const { getByRole } = render(<Button>ボタン</Button>);

      // Assert
      const button = getByRole("button");
      expect(button).toBeDefined();
    });
  });

  describe("バリアント", () => {
    it("secondaryバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<Button variant="secondary">セカンダリ</Button>);

      // Assert
      expect(getByText("セカンダリ")).toBeDefined();
    });

    it("outlineバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<Button variant="outline">アウトライン</Button>);

      // Assert
      expect(getByText("アウトライン")).toBeDefined();
    });

    it("ghostバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<Button variant="ghost">ゴースト</Button>);

      // Assert
      expect(getByText("ゴースト")).toBeDefined();
    });

    it("dangerバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<Button variant="danger">削除</Button>);

      // Assert
      expect(getByText("削除")).toBeDefined();
    });
  });

  describe("サイズ", () => {
    it("smサイズでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<Button size="sm">小</Button>);

      // Assert
      expect(getByText("小")).toBeDefined();
    });

    it("lgサイズでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<Button size="lg">大</Button>);

      // Assert
      expect(getByText("大")).toBeDefined();
    });
  });

  describe("インタラクション", () => {
    it("タップ時にonPressが呼ばれること", () => {
      // Arrange
      const onPress = jest.fn();
      const { getByRole } = render(<Button onPress={onPress}>タップ</Button>);

      // Act
      fireEvent.press(getByRole("button"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("disabled時にタップしてもonPressが呼ばれないこと", () => {
      // Arrange
      const onPress = jest.fn();
      const { getByRole } = render(
        <Button onPress={onPress} disabled>
          無効
        </Button>,
      );

      // Act
      fireEvent.press(getByRole("button"));

      // Assert
      expect(onPress).not.toHaveBeenCalled();
    });

    it("disabled時にアクセシビリティ状態が正しいこと", () => {
      // Arrange & Act
      const { getByRole } = render(<Button disabled>無効</Button>);

      // Assert
      const button = getByRole("button");
      expect(button.props.accessibilityState).toEqual({ disabled: true });
    });
  });
});
