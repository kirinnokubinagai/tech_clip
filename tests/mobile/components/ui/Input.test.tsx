import { Input } from "@mobile/components/ui/Input";
import { fireEvent, render } from "@testing-library/react-native";

describe("Input", () => {
  describe("レンダリング", () => {
    it("ラベルが正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Input label="メールアドレス" />);

      // Assert
      expect(getByText("メールアドレス")).toBeDefined();
    });

    it("プレースホルダーが正しく表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<Input placeholder="example@domain.com" />);

      // Assert
      const input = getByTestId("input-field");
      expect(input.props.placeholder).toBe("example@domain.com");
    });

    it("ラベルなしでもレンダリングできること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<Input placeholder="入力してください" />);

      // Assert
      const input = getByTestId("input-field");
      expect(input.props.placeholder).toBe("入力してください");
    });
  });

  describe("エラー表示", () => {
    it("エラーメッセージが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <Input label="メール" error="メールアドレスの形式が正しくありません。" />,
      );

      // Assert
      expect(getByText("メールアドレスの形式が正しくありません。")).toBeDefined();
    });

    it("エラーがない場合はエラーメッセージが表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = await render(<Input label="メール" />);

      // Assert
      expect(queryByText("メールアドレスの形式が正しくありません。")).toBeNull();
    });
  });

  describe("インタラクション", () => {
    it("テキスト入力時にonChangeTextが呼ばれること", async () => {
      // Arrange
      const onChangeText = jest.fn();
      const { getByTestId } = await render(
        <Input placeholder="入力" onChangeText={onChangeText} />,
      );

      // Act
      await fireEvent.changeText(getByTestId("input-field"), "テスト入力");

      // Assert
      expect(onChangeText).toHaveBeenCalledWith("テスト入力");
    });

    it("値が正しく反映されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<Input value="初期値" />);

      // Assert
      const input = getByTestId("input-field");
      expect(input.props.value).toBe("初期値");
    });
  });

  describe("プロパティ", () => {
    it("secureTextEntryが正しく設定されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<Input placeholder="パスワード" secureTextEntry />);

      // Assert
      const input = getByTestId("input-field");
      expect(input.props.secureTextEntry).toBe(true);
    });

    it("編集不可状態が正しく設定されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<Input placeholder="読み取り専用" editable={false} />);

      // Assert
      const input = getByTestId("input-field");
      expect(input.props.editable).toBe(false);
    });

    it("カスタムtestIDが正しく設定されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <Input placeholder="カスタムID" testID="custom-input-id" />,
      );

      // Assert
      const input = getByTestId("custom-input-id");
      expect(input.props.placeholder).toBe("カスタムID");
    });
  });
});
