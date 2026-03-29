import { fireEvent, render } from "@testing-library/react-native";

import { containsText, findByTestId, queryByTestId } from "@/test-helpers";

import { Input } from "../Input";

describe("Input", () => {
  describe("レンダリング", () => {
    it("ラベルが正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Input label="メールアドレス" />);

      // Assert
      expect(containsText(UNSAFE_root, "メールアドレス")).toBe(true);
    });

    it("プレースホルダーが正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Input placeholder="example@domain.com" />);

      // Assert
      const input = findByTestId(UNSAFE_root, "input-field");
      expect(input.props.placeholder).toBe("example@domain.com");
    });

    it("ラベルなしでもレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Input placeholder="入力してください" />);

      // Assert
      const input = findByTestId(UNSAFE_root, "input-field");
      expect(input.props.placeholder).toBe("入力してください");
    });
  });

  describe("エラー表示", () => {
    it("エラーメッセージが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Input label="メール" error="メールアドレスの形式が正しくありません" />,
      );

      // Assert
      expect(containsText(UNSAFE_root, "メールアドレスの形式が正しくありません")).toBe(true);
    });

    it("エラーがない場合はエラーメッセージが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Input label="メール" />);

      // Assert
      expect(containsText(UNSAFE_root, "メールアドレスの形式が正しくありません")).toBe(false);
    });
  });

  describe("インタラクション", () => {
    it("テキスト入力時にonChangeTextが呼ばれること", () => {
      // Arrange
      const onChangeText = jest.fn();
      const { UNSAFE_root } = render(<Input placeholder="入力" onChangeText={onChangeText} />);

      // Act
      fireEvent.changeText(findByTestId(UNSAFE_root, "input-field"), "テスト入力");

      // Assert
      expect(onChangeText).toHaveBeenCalledWith("テスト入力");
    });

    it("値が正しく反映されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Input value="初期値" />);

      // Assert
      const input = findByTestId(UNSAFE_root, "input-field");
      expect(input.props.value).toBe("初期値");
    });
  });

  describe("プロパティ", () => {
    it("secureTextEntryが正しく設定されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Input placeholder="パスワード" secureTextEntry />);

      // Assert
      const input = findByTestId(UNSAFE_root, "input-field");
      expect(input.props.secureTextEntry).toBe(true);
    });

    it("編集不可状態が正しく設定されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Input placeholder="読み取り専用" editable={false} />);

      // Assert
      const input = findByTestId(UNSAFE_root, "input-field");
      expect(input.props.editable).toBe(false);
    });
  });
});
