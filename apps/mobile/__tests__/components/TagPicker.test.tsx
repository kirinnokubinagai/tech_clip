import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { TagPicker } from "../../src/components/TagPicker";

/**
 * testIDでReactTestInstanceを検索するヘルパー
 */
function findByTestId(root: ReactTestInstance, testId: string): ReactTestInstance {
  return root.findByProps({ testID: testId });
}

function queryByTestId(root: ReactTestInstance, testId: string): ReactTestInstance | null {
  const results = root.findAllByProps({ testID: testId });
  return results.length > 0 ? results[0] : null;
}

describe("TagPicker", () => {
  describe("レンダリング", () => {
    it("タグピッカーが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker tags={["TypeScript", "React"]} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "tag-picker")).toBeDefined();
    });

    it("タグ一覧が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <TagPicker tags={["TypeScript", "React"]} selectedTags={[]} onToggleTag={jest.fn()} />,
      );
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert
      expect(texts).toContain("TypeScript");
      expect(texts).toContain("React");
    });

    it("onAddTagが未指定の場合入力欄が表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker tags={["TypeScript"]} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      expect(queryByTestId(UNSAFE_root, "tag-add-input")).toBeNull();
    });

    it("onAddTagが指定された場合入力欄が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker
          tags={["TypeScript"]}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={jest.fn()}
        />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "tag-add-input")).toBeDefined();
    });
  });

  describe("タグ選択", () => {
    it("タグをタップするとonToggleTagが呼ばれること", () => {
      // Arrange
      const onToggleTag = jest.fn();
      const { UNSAFE_root } = render(
        <TagPicker tags={["TypeScript"]} selectedTags={[]} onToggleTag={onToggleTag} />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "tag-TypeScript"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("TypeScript");
    });

    it("選択済みタグにはa11yState.selectedがtrueになっていること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker
          tags={["TypeScript"]}
          selectedTags={["TypeScript"]}
          onToggleTag={jest.fn()}
        />,
      );

      // Assert
      const tag = findByTestId(UNSAFE_root, "tag-TypeScript");
      expect(tag.props.accessibilityState?.selected).toBe(true);
    });

    it("未選択タグにはa11yState.selectedがfalseになっていること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker tags={["TypeScript"]} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      const tag = findByTestId(UNSAFE_root, "tag-TypeScript");
      expect(tag.props.accessibilityState?.selected).toBe(false);
    });
  });

  describe("最大タグ数制限", () => {
    it("maxTagsに達した場合タグ上限メッセージが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker
          tags={["TypeScript", "React", "Node"]}
          selectedTags={["TypeScript", "React"]}
          onToggleTag={jest.fn()}
          maxTags={2}
        />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "tag-limit-message")).toBeDefined();
    });

    it("maxTagsに達していない場合タグ上限メッセージが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker
          tags={["TypeScript", "React"]}
          selectedTags={["TypeScript"]}
          onToggleTag={jest.fn()}
          maxTags={5}
        />,
      );

      // Assert
      expect(queryByTestId(UNSAFE_root, "tag-limit-message")).toBeNull();
    });

    it("上限に達した未選択タグはdisabledになること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker
          tags={["TypeScript", "React", "Node"]}
          selectedTags={["TypeScript", "React"]}
          onToggleTag={jest.fn()}
          maxTags={2}
        />,
      );

      // Assert
      const nodeTag = findByTestId(UNSAFE_root, "tag-Node");
      expect(nodeTag.props.disabled).toBe(true);
    });
  });

  describe("新規タグ追加", () => {
    it("テキスト入力後に追加ボタンをタップするとonAddTagが呼ばれること", () => {
      // Arrange
      const onAddTag = jest.fn();
      const { UNSAFE_root } = render(
        <TagPicker
          tags={[]}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      fireEvent.changeText(findByTestId(UNSAFE_root, "tag-input"), "新しいタグ");
      fireEvent.press(findByTestId(UNSAFE_root, "tag-add-button"));

      // Assert
      expect(onAddTag).toHaveBeenCalledWith("新しいタグ");
    });

    it("空白のみの入力ではonAddTagが呼ばれないこと", () => {
      // Arrange
      const onAddTag = jest.fn();
      const { UNSAFE_root } = render(
        <TagPicker
          tags={[]}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      fireEvent.changeText(findByTestId(UNSAFE_root, "tag-input"), "   ");
      fireEvent.press(findByTestId(UNSAFE_root, "tag-add-button"));

      // Assert
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it("既存タグと重複する場合onAddTagが呼ばれないこと", () => {
      // Arrange
      const onAddTag = jest.fn();
      const { UNSAFE_root } = render(
        <TagPicker
          tags={["TypeScript"]}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      fireEvent.changeText(findByTestId(UNSAFE_root, "tag-input"), "TypeScript");
      fireEvent.press(findByTestId(UNSAFE_root, "tag-add-button"));

      // Assert
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it("タグ追加後に入力欄がクリアされること", () => {
      // Arrange
      const { UNSAFE_root } = render(
        <TagPicker
          tags={[]}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={jest.fn()}
        />,
      );

      // Act
      fireEvent.changeText(findByTestId(UNSAFE_root, "tag-input"), "新しいタグ");
      fireEvent.press(findByTestId(UNSAFE_root, "tag-add-button"));

      // Assert
      const input = findByTestId(UNSAFE_root, "tag-input");
      expect(input.props.value).toBe("");
    });
  });
});
