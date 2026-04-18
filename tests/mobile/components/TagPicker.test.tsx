import { TagPicker } from "@mobile/components/TagPicker";
import { fireEvent, render } from "@testing-library/react-native";

describe("TagPicker", () => {
  const defaultTags = ["React", "TypeScript", "Expo", "NativeWind"];

  describe("表示", () => {
    it("すべてのタグが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker tags={defaultTags} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      expect(getByTestId("tag-React")).toBeDefined();
      expect(getByTestId("tag-TypeScript")).toBeDefined();
      expect(getByTestId("tag-Expo")).toBeDefined();
      expect(getByTestId("tag-NativeWind")).toBeDefined();
    });

    it("選択済みタグが視覚的に区別されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker tags={defaultTags} selectedTags={["React"]} onToggleTag={jest.fn()} />,
      );

      // Assert
      const reactTag = getByTestId("tag-React");
      expect(reactTag).toBeDefined();
    });

    it("未選択タグが非選択状態であること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker tags={defaultTags} selectedTags={["React"]} onToggleTag={jest.fn()} />,
      );

      // Assert
      const tsTag = getByTestId("tag-TypeScript");
      expect(tsTag).toBeDefined();
    });
  });

  describe("タグ選択・解除", () => {
    it("タグをタップするとonToggleTagが呼ばれること", async () => {
      // Arrange
      const onToggleTag = jest.fn();
      const { getByTestId } = await render(
        <TagPicker tags={defaultTags} selectedTags={[]} onToggleTag={onToggleTag} />,
      );

      // Act
      await fireEvent.press(getByTestId("tag-React"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("React");
      expect(onToggleTag).toHaveBeenCalledTimes(1);
    });

    it("選択済みタグをタップするとonToggleTagが呼ばれること", async () => {
      // Arrange
      const onToggleTag = jest.fn();
      const { getByTestId } = await render(
        <TagPicker tags={defaultTags} selectedTags={["React"]} onToggleTag={onToggleTag} />,
      );

      // Act
      await fireEvent.press(getByTestId("tag-React"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("React");
    });
  });

  describe("最大タグ数制限", () => {
    it("上限に達すると未選択タグが無効化されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker
          tags={defaultTags}
          selectedTags={["React", "TypeScript"]}
          onToggleTag={jest.fn()}
          maxTags={2}
        />,
      );

      // Assert
      const expoTag = getByTestId("tag-Expo");
      expect(expoTag).toBeDefined();
    });

    it("上限に達すると制限メッセージが表示されること", async () => {
      // Arrange & Act
      const { getByTestId, getByText } = await render(
        <TagPicker
          tags={defaultTags}
          selectedTags={["React", "TypeScript"]}
          onToggleTag={jest.fn()}
          maxTags={2}
        />,
      );

      // Assert
      expect(getByTestId("tag-limit-message")).toBeDefined();
      expect(getByText("タグは最大2個まで選択できます。")).toBeDefined();
    });

    it("上限に達しても選択済みタグは解除可能であること", async () => {
      // Arrange
      const onToggleTag = jest.fn();
      const { getByTestId } = await render(
        <TagPicker
          tags={defaultTags}
          selectedTags={["React", "TypeScript"]}
          onToggleTag={onToggleTag}
          maxTags={2}
        />,
      );

      // Act
      await fireEvent.press(getByTestId("tag-React"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("React");
    });
  });

  describe("新規タグ追加", () => {
    it("onAddTagが指定されていると入力欄が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={jest.fn()}
        />,
      );

      // Assert
      expect(getByTestId("tag-add-input")).toBeDefined();
      expect(getByTestId("tag-input")).toBeDefined();
    });

    it("onAddTagが未指定の場合は入力欄が非表示になること", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(
        <TagPicker tags={defaultTags} selectedTags={[]} onToggleTag={jest.fn()} />,
      );

      // Assert
      expect(queryByTestId("tag-add-input")).toBeNull();
    });

    it("追加ボタンをタップするとonAddTagが呼ばれること", async () => {
      // Arrange
      const onAddTag = jest.fn();
      const { getByTestId } = await render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      await fireEvent.changeText(getByTestId("tag-input"), "NewTag");
      await fireEvent.press(getByTestId("tag-add-button"));

      // Assert
      expect(onAddTag).toHaveBeenCalledWith("NewTag");
    });

    it("空文字ではonAddTagが呼ばれないこと", async () => {
      // Arrange
      const onAddTag = jest.fn();
      const { getByTestId } = await render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      await fireEvent.changeText(getByTestId("tag-input"), "   ");
      await fireEvent.press(getByTestId("tag-add-button"));

      // Assert
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it("既存タグと同名ではonAddTagが呼ばれないこと", async () => {
      // Arrange
      const onAddTag = jest.fn();
      const { getByTestId } = await render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      await fireEvent.changeText(getByTestId("tag-input"), "React");
      await fireEvent.press(getByTestId("tag-add-button"));

      // Assert
      expect(onAddTag).not.toHaveBeenCalled();
    });
  });
});
