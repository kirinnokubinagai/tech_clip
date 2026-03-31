import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  describe("レンダリング", () => {
    it("タイトルが正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <EmptyState icon={<Text>icon</Text>} title="データがありません" />,
      );

      // Assert
      expect(getByText("データがありません")).toBeTruthy();
    });

    it("アイコンが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<EmptyState icon={<Text>test-icon</Text>} title="タイトル" />);

      // Assert
      expect(getByText("test-icon")).toBeTruthy();
    });

    it("説明文が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <EmptyState icon={<Text>icon</Text>} title="タイトル" description="補足説明テキストです" />,
      );

      // Assert
      expect(getByText("補足説明テキストです")).toBeTruthy();
    });

    it("説明文が未指定の場合は表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = await render(<EmptyState icon={<Text>icon</Text>} title="タイトル" />);

      // Assert
      expect(queryByText("補足説明テキストです")).toBeNull();
    });
  });

  describe("アクションボタン", () => {
    it("actionLabelとonAction指定時にボタンが表示されること", async () => {
      // Arrange
      const onAction = jest.fn();

      // Act
      const { getByText } = await render(
        <EmptyState
          icon={<Text>icon</Text>}
          title="タイトル"
          actionLabel="記事を追加"
          onAction={onAction}
        />,
      );

      // Assert
      expect(getByText("記事を追加")).toBeTruthy();
    });

    it("ボタンタップ時にonActionが呼ばれること", async () => {
      // Arrange
      const onAction = jest.fn();
      const { getByTestId } = await render(
        <EmptyState
          icon={<Text>icon</Text>}
          title="タイトル"
          actionLabel="追加する"
          onAction={onAction}
        />,
      );

      // Act
      await fireEvent.press(getByTestId("button"));

      // Assert
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it("actionLabelのみ指定でonAction未指定の場合ボタンが表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = await render(
        <EmptyState icon={<Text>icon</Text>} title="タイトル" actionLabel="追加する" />,
      );

      // Assert
      expect(queryByText("追加する")).toBeNull();
    });

    it("actionLabelもonActionも未指定の場合ボタンが表示されないこと", async () => {
      // Arrange & Act
      const { toJSON } = await render(<EmptyState icon={<Text>icon</Text>} title="タイトル" />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });
});
