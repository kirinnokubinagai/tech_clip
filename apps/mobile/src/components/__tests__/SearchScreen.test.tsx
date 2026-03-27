import { fireEvent, render } from "@testing-library/react-native";

import { SearchScreenContent } from "../SearchScreenContent";

describe("SearchScreenContent", () => {
  describe("レンダリング", () => {
    it("検索入力フィールドが表示されること", () => {
      // Arrange & Act
      const { getByPlaceholderText } = render(<SearchScreenContent />);

      // Assert
      expect(getByPlaceholderText("記事を検索...")).toBeDefined();
    });

    it("初期状態でプロンプトが表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<SearchScreenContent />);

      // Assert
      expect(getByText("キーワードを入力して記事を検索")).toBeDefined();
    });
  });

  describe("入力インタラクション", () => {
    it("テキスト入力時にonChangeTextが動作すること", () => {
      // Arrange
      const { getByPlaceholderText, getByDisplayValue } = render(<SearchScreenContent />);

      // Act
      fireEvent.changeText(getByPlaceholderText("記事を検索..."), "React");

      // Assert
      expect(getByDisplayValue("React")).toBeDefined();
    });

    it("クリアボタンが入力時に表示されること", () => {
      // Arrange
      const { getByPlaceholderText, getByLabelText } = render(<SearchScreenContent />);

      // Act
      fireEvent.changeText(getByPlaceholderText("記事を検索..."), "React");

      // Assert
      expect(getByLabelText("検索をクリア")).toBeDefined();
    });

    it("クリアボタンタップで入力がクリアされること", () => {
      // Arrange
      const { getByPlaceholderText, getByLabelText, queryByDisplayValue } = render(
        <SearchScreenContent />,
      );

      // Act
      fireEvent.changeText(getByPlaceholderText("記事を検索..."), "React");
      fireEvent.press(getByLabelText("検索をクリア"));

      // Assert
      expect(queryByDisplayValue("React")).toBeNull();
    });

    it("空文字の場合クリアボタンが非表示であること", () => {
      // Arrange & Act
      const { queryByLabelText } = render(<SearchScreenContent />);

      // Assert
      expect(queryByLabelText("検索をクリア")).toBeNull();
    });
  });
});
