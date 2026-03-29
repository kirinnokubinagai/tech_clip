import { fireEvent, render } from "@testing-library/react-native";

import { containsText, findByTestId, queryByTestId } from "@/test-helpers";

import { TagPicker } from "../TagPicker";

describe("TagPicker", () => {
  const defaultTags = ["React", "TypeScript", "Expo", "NativeWind"];

  describe("表示", () => {
    it("すべてのタグが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker tags={defaultTags} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "tag-React")).toBeDefined();
      expect(findByTestId(UNSAFE_root, "tag-TypeScript")).toBeDefined();
      expect(findByTestId(UNSAFE_root, "tag-Expo")).toBeDefined();
      expect(findByTestId(UNSAFE_root, "tag-NativeWind")).toBeDefined();
    });

    it("選択済みタグが視覚的に区別されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker tags={defaultTags} selectedTags={["React"]} onToggleTag={jest.fn()} />,
      );

      // Assert
      const reactTag = findByTestId(UNSAFE_root, "tag-React");
      expect(reactTag).toBeDefined();
    });

    it("未選択タグが非選択状態である��と", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker tags={defaultTags} selectedTags={["React"]} onToggleTag={jest.fn()} />,
      );

      // Assert
      const tsTag = findByTestId(UNSAFE_root, "tag-TypeScript");
      expect(tsTag).toBeDefined();
    });
  });

  describe("タグ選択・解除", () => {
    it("タグをタップするとonToggleTagが���ばれるこ���", () => {
      // Arrange
      const onToggleTag = jest.fn();
      const { UNSAFE_root } = render(
        <TagPicker tags={defaultTags} selectedTags={[]} onToggleTag={onToggleTag} />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "tag-React"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("React");
      expect(onToggleTag).toHaveBeenCalledTimes(1);
    });

    it("選択済みタグをタップするとonToggleTagが呼ばれること", () => {
      // Arrange
      const onToggleTag = jest.fn();
      const { UNSAFE_root } = render(
        <TagPicker tags={defaultTags} selectedTags={["React"]} onToggleTag={onToggleTag} />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "tag-React"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("React");
    });
  });

  describe("最大タグ数制限", () => {
    it("上限に達すると未選択タグが無効化されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker
          tags={defaultTags}
          selectedTags={["React", "TypeScript"]}
          onToggleTag={jest.fn()}
          maxTags={2}
        />,
      );

      // Assert
      const expoTag = findByTestId(UNSAFE_root, "tag-Expo");
      expect(expoTag).toBeDefined();
    });

    it("上限に達すると制限メッセージが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker
          tags={defaultTags}
          selectedTags={["React", "TypeScript"]}
          onToggleTag={jest.fn()}
          maxTags={2}
        />,
      );

      // Assert
      const message = findByTestId(UNSAFE_root, "tag-limit-message");
      expect(containsText(message, "タグは最大2個まで選択できます")).toBe(true);
    });

    it("上限に達しても選択済みタグは解除可能であること", () => {
      // Arrange
      const onToggleTag = jest.fn();
      const { UNSAFE_root } = render(
        <TagPicker
          tags={defaultTags}
          selectedTags={["React", "TypeScript"]}
          onToggleTag={onToggleTag}
          maxTags={2}
        />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "tag-React"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("React");
    });
  });

  describe("新規タグ追加", () => {
    it("onAddTagが指定されていると入力欄が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={jest.fn()}
        />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "tag-add-input")).toBeDefined();
      expect(findByTestId(UNSAFE_root, "tag-input")).toBeDefined();
    });

    it("onAddTagが未指定の���合は入力欄が非表示になること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <TagPicker tags={defaultTags} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      expect(queryByTestId(UNSAFE_root, "tag-add-input")).toBeNull();
    });

    it("追加ボタンをタップするとonAddTagが呼ばれること", () => {
      // Arrange
      const onAddTag = jest.fn();
      const { UNSAFE_root } = render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      fireEvent.changeText(findByTestId(UNSAFE_root, "tag-input"), "NewTag");
      fireEvent.press(findByTestId(UNSAFE_root, "tag-add-button"));

      // Assert
      expect(onAddTag).toHaveBeenCalledWith("NewTag");
    });

    it("空文字ではonAddTagが呼ばれないこと", () => {
      // Arrange
      const onAddTag = jest.fn();
      const { UNSAFE_root } = render(
        <TagPicker
          tags={defaultTags}
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

    it("既存タグと同名ではonAddTagが呼ばれないこと", () => {
      // Arrange
      const onAddTag = jest.fn();
      const { UNSAFE_root } = render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      fireEvent.changeText(findByTestId(UNSAFE_root, "tag-input"), "React");
      fireEvent.press(findByTestId(UNSAFE_root, "tag-add-button"));

      // Assert
      expect(onAddTag).not.toHaveBeenCalled();
    });
  });
});
