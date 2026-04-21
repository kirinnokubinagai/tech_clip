import { AuthAlert } from "@mobile/components/auth/AuthAlert";
import { render } from "@testing-library/react-native";

describe("AuthAlert", () => {
  describe("レンダリング", () => {
    it("メッセージテキストが表示されること", async () => {
      // Arrange
      const message = "エラーが発生しました";

      // Act
      const { getByText } = await render(<AuthAlert message={message} />);

      // Assert
      expect(getByText(message)).toBeTruthy();
    });

    it("variant='success'でメッセージが表示されること", async () => {
      // Arrange
      const message = "保存が完了しました";

      // Act
      const { getByText } = await render(<AuthAlert message={message} variant="success" />);

      // Assert
      expect(getByText(message)).toBeTruthy();
    });

    it("accessibilityRole='alert'が設定されていること", async () => {
      // Arrange
      const message = "テストメッセージ";

      // Act
      const { toJSON } = await render(<AuthAlert message={message} />);
      const json = JSON.stringify(toJSON());

      // Assert
      expect(json).toContain('"accessibilityRole":"alert"');
    });

    it("accessibilityLabelにメッセージが設定されていること", async () => {
      // Arrange
      const message = "アクセシビリティテスト";

      // Act
      const { toJSON } = await render(<AuthAlert message={message} />);
      const json = JSON.stringify(toJSON());

      // Assert
      expect(json).toContain(`"accessibilityLabel":"${message}"`);
    });
  });
});
