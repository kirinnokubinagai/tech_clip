import { AuthAlert } from "@mobile/components/auth/AuthAlert";
import { render } from "@testing-library/react-native";

describe("AuthAlert", () => {
  describe("error バリアント", () => {
    it("メッセージを表示できること", async () => {
      const { getByText } = await render(<AuthAlert message="エラーメッセージ" />);

      expect(getByText("エラーメッセージ")).toBeTruthy();
    });

    it("error バリアントのスタイルが適用されること", async () => {
      const { getByText } = await render(<AuthAlert message="エラー" variant="error" />);

      expect(getByText("エラー").props.className).toContain("text-error");
    });

    it("デフォルトバリアントが error であること", async () => {
      const { getByText } = await render(<AuthAlert message="デフォルト" />);

      expect(getByText("デフォルト").props.className).toContain("text-error");
    });
  });

  describe("success バリアント", () => {
    it("success バリアントのスタイルが適用されること", async () => {
      const { getByText } = await render(<AuthAlert message="成功" variant="success" />);

      expect(getByText("成功").props.className).toContain("text-success");
    });

    it("success バリアントでもメッセージを表示できること", async () => {
      const { getByText } = await render(
        <AuthAlert message="操作が完了しました" variant="success" />,
      );

      expect(getByText("操作が完了しました")).toBeTruthy();
    });
  });

  describe("アクセシビリティ", () => {
    it("accessibilityRole が alert であること", async () => {
      const { getByLabelText } = await render(<AuthAlert message="アラート" />);

      expect(getByLabelText("アラート").props.accessibilityRole).toBe("alert");
    });

    it("accessibilityLabel にメッセージが設定されること", async () => {
      const { toJSON } = await render(<AuthAlert message="アクセシビリティテスト" />);

      expect(JSON.stringify(toJSON())).toContain(
        '"accessibilityLabel":"アクセシビリティテスト"',
      );
    });
  });
});
