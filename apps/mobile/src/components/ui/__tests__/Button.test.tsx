import { fireEvent, render } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { containsText, findByTestId } from "@/test-helpers";

import { Button } from "../Button";

describe("Button", () => {
  describe("レンダリング", () => {
    it("テキストが正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Button>テスト</Button>);

      // Assert
      expect(containsText(UNSAFE_root, "テスト")).toBe(true);
    });

    it("デフォルトでprimaryバリアントが適用されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Button>ボタン</Button>);

      // Assert
      const button = findByTestId(UNSAFE_root, "button");
      expect(button).toBeDefined();
    });
  });

  describe("バリアント", () => {
    it("secondaryバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Button variant="secondary">セカンダリ</Button>);

      // Assert
      expect(containsText(UNSAFE_root, "セカンダリ")).toBe(true);
    });

    it("outlineバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Button variant="outline">アウトライン</Button>);

      // Assert
      expect(containsText(UNSAFE_root, "アウトライン")).toBe(true);
    });

    it("ghostバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Button variant="ghost">ゴースト</Button>);

      // Assert
      expect(containsText(UNSAFE_root, "ゴースト")).toBe(true);
    });

    it("dangerバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Button variant="danger">削除</Button>);

      // Assert
      expect(containsText(UNSAFE_root, "削除")).toBe(true);
    });
  });

  describe("サイズ", () => {
    it("smサイズでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Button size="sm">小</Button>);

      // Assert
      expect(containsText(UNSAFE_root, "小")).toBe(true);
    });

    it("lgサイズでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Button size="lg">大</Button>);

      // Assert
      expect(containsText(UNSAFE_root, "大")).toBe(true);
    });
  });

  describe("インタラクション", () => {
    it("タップ時にonPressが呼ばれること", () => {
      // Arrange
      const onPress = jest.fn();
      const { UNSAFE_root } = render(<Button onPress={onPress}>タップ</Button>);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "button"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("disabled時にボタンが無効化されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Button onPress={jest.fn()} disabled>
          無効
        </Button>,
      );

      // Assert
      const button = findByTestId(UNSAFE_root, "button");
      expect(button.props.disabled).toBe(true);
    });

    it("disabled時にアクセシビリティ状態が正しいこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Button disabled>無効</Button>);

      // Assert
      const button = findByTestId(UNSAFE_root, "button");
      expect(button.props.accessibilityState).toEqual({ disabled: true });
    });
  });
});
