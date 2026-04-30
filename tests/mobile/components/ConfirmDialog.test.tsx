import { confirm } from "@mobile/components/ConfirmDialog";

/**
 * ConfirmDialog の確認ダイアログを表示する store ベース実装のテスト。
 * 旧 Alert.alert 実装からの変更に伴い、ここでは公開関数 confirm() が例外を出さず
 * 安定して呼び出せることを検証する。表示・タップ動作の検証は E2E (07-settings)
 * とコンポーネントのスナップショットテストで担保する。
 */

describe("ConfirmDialog", () => {
  describe("confirm", () => {
    it("呼び出してもエラーにならず例外が出ないこと", () => {
      // Arrange
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      // Act / Assert: 単に呼び出せることを確認 (store push の副作用)
      expect(() =>
        confirm({
          title: "削除確認",
          message: "本当に削除しますか？",
          onConfirm,
          onCancel,
        }),
      ).not.toThrow();
    });

    it("dangerバリアントでも問題なく呼び出せること", () => {
      const onConfirm = jest.fn();
      expect(() =>
        confirm({
          title: "削除確認",
          message: "この操作は取り消せません",
          variant: "danger",
          onConfirm,
        }),
      ).not.toThrow();
    });

    it("warningバリアントでも問題なく呼び出せること", () => {
      const onConfirm = jest.fn();
      expect(() =>
        confirm({
          title: "確認",
          message: "続行しますか？",
          variant: "warning",
          onConfirm,
        }),
      ).not.toThrow();
    });

    it("カスタムラベルを指定しても問題なく呼び出せること", () => {
      expect(() =>
        confirm({
          title: "ログアウト",
          message: "ログアウトしますか？",
          confirmLabel: "ログアウトする",
          cancelLabel: "戻る",
          onConfirm: jest.fn(),
        }),
      ).not.toThrow();
    });

    it("onCancel が未指定でも問題なく呼び出せること", () => {
      expect(() =>
        confirm({
          title: "確認",
          message: "続行しますか？",
          onConfirm: jest.fn(),
        }),
      ).not.toThrow();
    });
  });
});
