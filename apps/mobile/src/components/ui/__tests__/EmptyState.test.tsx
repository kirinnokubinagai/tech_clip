import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { containsText, findByTestId, queryByTestId } from "@/test-helpers";

import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  describe("レンダリング", () => {
    it("タイトルが正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <EmptyState icon={<Text>icon</Text>} title="データがありません" />,
      );

      // Assert
      expect(containsText(UNSAFE_root, "データがありません")).toBe(true);
    });

    it("アイコンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<EmptyState icon={<Text>test-icon</Text>} title="タイトル" />);

      // Assert
      expect(containsText(UNSAFE_root, "test-icon")).toBe(true);
    });

    it("説明文が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <EmptyState icon={<Text>icon</Text>} title="タイトル" description="補足説明テキストです" />,
      );

      // Assert
      expect(containsText(UNSAFE_root, "補足説明テキストです")).toBe(true);
    });

    it("説明文が未指定の場合は表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<EmptyState icon={<Text>icon</Text>} title="タイトル" />);

      // Assert
      expect(containsText(UNSAFE_root, "補足説明テキストです")).toBe(false);
    });
  });

  describe("アクションボタン", () => {
    it("actionLabelとonAction指定時にボタンが表示されること", () => {
      // Arrange
      const onAction = jest.fn();

      // Act
      const { UNSAFE_root } = render(
        <EmptyState
          icon={<Text>icon</Text>}
          title="タイトル"
          actionLabel="記事を追加"
          onAction={onAction}
        />,
      );

      // Assert
      expect(containsText(UNSAFE_root, "記事を追加")).toBe(true);
    });

    it("ボタンタップ時にonActionが呼ばれること", () => {
      // Arrange
      const onAction = jest.fn();
      const { UNSAFE_root } = render(
        <EmptyState
          icon={<Text>icon</Text>}
          title="タイトル"
          actionLabel="追加する"
          onAction={onAction}
        />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "button"));

      // Assert
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it("actionLabelのみ指定でonAction未指定の場合ボタンが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <EmptyState icon={<Text>icon</Text>} title="タイトル" actionLabel="追加する" />,
      );

      // Assert
      expect(containsText(UNSAFE_root, "追加する")).toBe(false);
    });

    it("actionLabelもonActionも未指定の場合ボタンが表示されないこと", () => {
      // Arrange & Act
      const { toJSON } = render(<EmptyState icon={<Text>icon</Text>} title="タイトル" />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });
});
