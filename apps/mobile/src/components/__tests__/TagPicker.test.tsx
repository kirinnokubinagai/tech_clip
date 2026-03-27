import { fireEvent, render, screen } from "@testing-library/react-native";
import { TagPicker } from "../TagPicker";

describe("TagPicker", () => {
  const defaultTags = ["React", "TypeScript", "Expo", "NativeWind"];

  describe("表示", () => {
    it("すべてのタグが表示されること", () => {
      // Arrange & Act
      render(<TagPicker tags={defaultTags} selectedTags={[]} onToggleTag={jest.fn()} />);

      // Assert
      expect(screen.getByTestId("tag-React")).toBeTruthy();
      expect(screen.getByTestId("tag-TypeScript")).toBeTruthy();
      expect(screen.getByTestId("tag-Expo")).toBeTruthy();
      expect(screen.getByTestId("tag-NativeWind")).toBeTruthy();
    });

    it("選択済みタグが視覚的に区別されること", () => {
      // Arrange & Act
      render(<TagPicker tags={defaultTags} selectedTags={["React"]} onToggleTag={jest.fn()} />);

      // Assert
      const reactTag = screen.getByTestId("tag-React");
      expect(reactTag).toBeTruthy();
    });

    it("未選択タグが非選択状態であること", () => {
      // Arrange & Act
      render(<TagPicker tags={defaultTags} selectedTags={["React"]} onToggleTag={jest.fn()} />);

      // Assert
      const tsTag = screen.getByTestId("tag-TypeScript");
      expect(tsTag).toBeTruthy();
    });
  });

  describe("タグ選択・解除", () => {
    it("タグをタップするとonToggleTagが呼ばれること", () => {
      // Arrange
      const onToggleTag = jest.fn();
      render(<TagPicker tags={defaultTags} selectedTags={[]} onToggleTag={onToggleTag} />);

      // Act
      fireEvent.press(screen.getByTestId("tag-React"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("React");
      expect(onToggleTag).toHaveBeenCalledTimes(1);
    });

    it("選択済みタグをタップするとonToggleTagが呼ばれること", () => {
      // Arrange
      const onToggleTag = jest.fn();
      render(<TagPicker tags={defaultTags} selectedTags={["React"]} onToggleTag={onToggleTag} />);

      // Act
      fireEvent.press(screen.getByTestId("tag-React"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("React");
    });
  });

  describe("最大タグ数制限", () => {
    it("上限に達すると未選択タグが無効化されること", () => {
      // Arrange & Act
      render(
        <TagPicker
          tags={defaultTags}
          selectedTags={["React", "TypeScript"]}
          onToggleTag={jest.fn()}
          maxTags={2}
        />,
      );

      // Assert
      const expoTag = screen.getByTestId("tag-Expo");
      expect(expoTag).toBeTruthy();
    });

    it("上限に達すると制限メッセージが表示されること", () => {
      // Arrange & Act
      render(
        <TagPicker
          tags={defaultTags}
          selectedTags={["React", "TypeScript"]}
          onToggleTag={jest.fn()}
          maxTags={2}
        />,
      );

      // Assert
      expect(screen.getByTestId("tag-limit-message")).toHaveTextContent(
        "タグは最大2個まで選択できます",
      );
    });

    it("上限に達しても選択済みタグは解除可能であること", () => {
      // Arrange
      const onToggleTag = jest.fn();
      render(
        <TagPicker
          tags={defaultTags}
          selectedTags={["React", "TypeScript"]}
          onToggleTag={onToggleTag}
          maxTags={2}
        />,
      );

      // Act
      fireEvent.press(screen.getByTestId("tag-React"));

      // Assert
      expect(onToggleTag).toHaveBeenCalledWith("React");
    });
  });

  describe("新規タグ追加", () => {
    it("onAddTagが指定されていると入力欄が表示されること", () => {
      // Arrange & Act
      render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={jest.fn()}
        />,
      );

      // Assert
      expect(screen.getByTestId("tag-add-input")).toBeTruthy();
      expect(screen.getByTestId("tag-input")).toBeTruthy();
    });

    it("onAddTagが未指定の場合は入力欄が非表示になること", () => {
      // Arrange & Act
      render(<TagPicker tags={defaultTags} selectedTags={[]} onToggleTag={jest.fn()} />);

      // Assert
      expect(screen.queryByTestId("tag-add-input")).toBeNull();
    });

    it("追加ボタンをタップするとonAddTagが呼ばれること", () => {
      // Arrange
      const onAddTag = jest.fn();
      render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      fireEvent.changeText(screen.getByTestId("tag-input"), "NewTag");
      fireEvent.press(screen.getByTestId("tag-add-button"));

      // Assert
      expect(onAddTag).toHaveBeenCalledWith("NewTag");
    });

    it("空文字ではonAddTagが呼ばれないこと", () => {
      // Arrange
      const onAddTag = jest.fn();
      render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      fireEvent.changeText(screen.getByTestId("tag-input"), "   ");
      fireEvent.press(screen.getByTestId("tag-add-button"));

      // Assert
      expect(onAddTag).not.toHaveBeenCalled();
    });

    it("既存タグと同名ではonAddTagが呼ばれないこと", () => {
      // Arrange
      const onAddTag = jest.fn();
      render(
        <TagPicker
          tags={defaultTags}
          selectedTags={[]}
          onToggleTag={jest.fn()}
          onAddTag={onAddTag}
        />,
      );

      // Act
      fireEvent.changeText(screen.getByTestId("tag-input"), "React");
      fireEvent.press(screen.getByTestId("tag-add-button"));

      // Assert
      expect(onAddTag).not.toHaveBeenCalled();
    });
  });
});
