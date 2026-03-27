import { fireEvent, render } from "@testing-library/react-native";

import { SourceFilter } from "../SourceFilter";

describe("SourceFilter", () => {
  describe("レンダリング", () => {
    it("「すべて」フィルターが表示されること", () => {
      // Arrange
      const onSelect = jest.fn();

      // Act
      const { getByText } = render(<SourceFilter selected={null} onSelect={onSelect} />);

      // Assert
      expect(getByText("すべて")).toBeDefined();
    });

    it("主要ソースフィルターが表示されること", () => {
      // Arrange
      const onSelect = jest.fn();

      // Act
      const { getByText } = render(<SourceFilter selected={null} onSelect={onSelect} />);

      // Assert
      expect(getByText("Zenn")).toBeDefined();
      expect(getByText("Qiita")).toBeDefined();
      expect(getByText("note")).toBeDefined();
      expect(getByText("GitHub")).toBeDefined();
    });
  });

  describe("選択操作", () => {
    it("フィルター押下時にonSelectが呼ばれること", () => {
      // Arrange
      const onSelect = jest.fn();

      // Act
      const { getByText } = render(<SourceFilter selected={null} onSelect={onSelect} />);
      fireEvent.press(getByText("Zenn"));

      // Assert
      expect(onSelect).toHaveBeenCalledWith("zenn");
    });

    it("「すべて」押下時にnullが渡されること", () => {
      // Arrange
      const onSelect = jest.fn();

      // Act
      const { getByText } = render(<SourceFilter selected="zenn" onSelect={onSelect} />);
      fireEvent.press(getByText("すべて"));

      // Assert
      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });

  describe("アクセシビリティ", () => {
    it("各フィルターにアクセシビリティラベルが設定されていること", () => {
      // Arrange
      const onSelect = jest.fn();

      // Act
      const { getByLabelText } = render(<SourceFilter selected={null} onSelect={onSelect} />);

      // Assert
      expect(getByLabelText("すべてでフィルター")).toBeDefined();
      expect(getByLabelText("Zennでフィルター")).toBeDefined();
    });
  });
});
