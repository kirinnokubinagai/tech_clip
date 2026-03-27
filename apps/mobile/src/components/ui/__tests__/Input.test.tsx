import { fireEvent, render } from "@testing-library/react-native";

import { Input } from "../Input";

describe("Input", () => {
  describe("レンダリング", () => {
    it("ラベルが正しく表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<Input label="メールアドレス" />);

      // Assert
      expect(getByText("メールアドレス")).toBeDefined();
    });

    it("プレースホルダーが正しく表示されること", () => {
      // Arrange & Act
      const { getByPlaceholderText } = render(<Input placeholder="example@domain.com" />);

      // Assert
      expect(getByPlaceholderText("example@domain.com")).toBeDefined();
    });

    it("ラベルなしでもレンダリングできること", () => {
      // Arrange & Act
      const { getByPlaceholderText } = render(<Input placeholder="入力してください" />);

      // Assert
      expect(getByPlaceholderText("入力してください")).toBeDefined();
    });
  });

  describe("エラー表示", () => {
    it("エラーメッセージが表示されること", () => {
      // Arrange & Act
      const { getByText } = render(
        <Input label="メール" error="メールアドレスの形式が正しくありません" />,
      );

      // Assert
      expect(getByText("メールアドレスの形式が正しくありません")).toBeDefined();
    });

    it("エラーがない場合はエラーメッセージが表示されないこと", () => {
      // Arrange & Act
      const { queryByText } = render(<Input label="メール" />);

      // Assert
      expect(queryByText("メールアドレスの形式が正しくありません")).toBeNull();
    });
  });

  describe("インタラクション", () => {
    it("テキスト入力時にonChangeTextが呼ばれること", () => {
      // Arrange
      const onChangeText = jest.fn();
      const { getByPlaceholderText } = render(
        <Input placeholder="入力" onChangeText={onChangeText} />,
      );

      // Act
      fireEvent.changeText(getByPlaceholderText("入力"), "テスト入力");

      // Assert
      expect(onChangeText).toHaveBeenCalledWith("テスト入力");
    });

    it("値が正しく反映されること", () => {
      // Arrange & Act
      const { getByDisplayValue } = render(<Input value="初期値" />);

      // Assert
      expect(getByDisplayValue("初期値")).toBeDefined();
    });
  });

  describe("プロパティ", () => {
    it("secureTextEntryが正しく設定されること", () => {
      // Arrange & Act
      const { getByPlaceholderText } = render(<Input placeholder="パスワード" secureTextEntry />);

      // Assert
      const input = getByPlaceholderText("パスワード");
      expect(input.props.secureTextEntry).toBe(true);
    });

    it("編集不可状態が正しく設定されること", () => {
      // Arrange & Act
      const { getByPlaceholderText } = render(
        <Input placeholder="読み取り専用" editable={false} />,
      );

      // Assert
      const input = getByPlaceholderText("読み取り専用");
      expect(input.props.editable).toBe(false);
    });
  });
});
