import { fireEvent, render } from "@testing-library/react-native";

import { TagPicker } from "../../src/components/TagPicker";

describe("TagPicker", () => {
  describe("レンダリング", () => {
    it("タグピッカーが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker tags={["TypeScript", "React"]} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      expect(getByTestId("tag-picker")).toBeDefined();
    });

    it("タグ一覧が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <TagPicker tags={["TypeScript", "React"]} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      expect(getByText("TypeScript")).toBeDefined();
      expect(getByText("React")).toBeDefined();
    });

    it("onAddTagが未指定の場合入力欄が表示されないこと", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(
        <TagPicker tags={["TypeScript"]} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      expect(queryByTestId("tag-add-input")).toBeNull();
    });

    it("onAddTagが指定された場合入力欄が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker
          tags={["TypeScript"]}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={jest.fn()}
        />,
      );

      // Assert
      expect(getByTestId("tag-add-input")).toBeDefined();
    });
  });

  describe("タグ選択", () => {
    it("タグをタップするとonToggleTagが呼ばれること", async () => {
      // Arrange
      const onToggleTag = jest.fn();
      const { getByTestId } = await render(
        <TagPicker tags={["TypeScript"]} selectedTags={[]} onToggleTag={onToggleTag} />,
      );

      // Act
      await fireEvent.press(getByTestId("tag-TypeScript"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("TypeScript");
    });

    it("選択済みタグにはa11yState.selectedがtrueになっていること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker tags={["TypeScript"]} selectedTags={["TypeScript"]} onToggleTag={jest.fn()} />,
      );

      // Assert
      const tag = getByTestId("tag-TypeScript");
      expect(tag.props.accessibilityState?.selected).toBe(true);
    });

    it("未選択タグにはa11yState.selectedがfalseになっていること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker tags={["TypeScript"]} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      const tag = getByTestId("tag-TypeScript");
      expect(tag.props.accessibilityState?.selected).toBe(false);
    });
  });

  describe("最大タグ数制限", () => {
    it("maxTagsに達した場合タグ上限メッセージが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker
          tags={["TypeScript", "React", "Node"]}
          selectedTags={["TypeScript", "React"]}
          onToggleTag={jest.fn()}
          maxTags={2}
        />,
      );

      // Assert
      expect(getByTestId("tag-limit-message")).toBeDefined();
    });

    it("maxTagsに達していない場合タグ上限メッセージが表示されないこと", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(
        <TagPicker
          tags={["TypeScript", "React"]}
          selectedTags={["TypeScript"]}
          onToggleTag={jest.fn()}
          maxTags={5}
        />,
      );

      // Assert
      expect(queryByTestId("tag-limit-message")).toBeNull();
    });

    it("上限に達した未選択タグはdisabledになること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker
          tags={["TypeScript", "React", "Node"]}
          selectedTags={["TypeScript", "React"]}
          onToggleTag={jest.fn()}
          maxTags={2}
        />,
      );

      // Assert
      const nodeTag = getByTestId("tag-Node");
      expect(nodeTag.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe("新規タグ追加", () => {
    it("テキスト入力後に追加ボタンをタップするとonAddTagが呼ばれること", async () => {
      // Arrange
      const onAddTag = jest.fn();
      const { getByTestId } = await render(
        <TagPicker tags={[]} selectedTags={[]} onToggleTag={jest.fn()} onAddTag={onAddTag} />,
      );

      // Act
      await fireEvent.changeText(getByTestId("tag-input"), "新しいタグ");
      await fireEvent.press(getByTestId("tag-add-button"));

      // Assert
      expect(onAddTag).toHaveBeenCalledWith("新しいタグ");
    });

    it("空白のみの入力ではonAddTagが呼ばれないこと", async () => {
      // Arrange
      const onAddTag = jest.fn();
      const { getByTestId } = await render(
        <TagPicker tags={[]} selectedTags={[]} onToggleTag={jest.fn()} onAddTag={onAddTag} />,
      );

      // Act
      await fireEvent.changeText(getByTestId("tag-input"), "   ");
      await fireEvent.press(getByTestId("tag-add-button"));

      // Assert
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it("既存タグと重複する場合onAddTagが呼ばれないこと", async () => {
      // Arrange
      const onAddTag = jest.fn();
      const { getByTestId } = await render(
        <TagPicker
          tags={["TypeScript"]}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      await fireEvent.changeText(getByTestId("tag-input"), "TypeScript");
      await fireEvent.press(getByTestId("tag-add-button"));

      // Assert
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it("タグ追加後に入力欄がクリアされること", async () => {
      // Arrange
      const { getByTestId } = await render(
        <TagPicker tags={[]} selectedTags={[]} onToggleTag={jest.fn()} onAddTag={jest.fn()} />,
      );

      // Act
      await fireEvent.changeText(getByTestId("tag-input"), "新しいタグ");
      await fireEvent.press(getByTestId("tag-add-button"));

      // Assert
      const input = getByTestId("tag-input");
      expect(input.props.value).toBe("");
    });
  });
});
