import { getErrorMessage } from "../../../apps/mobile/src/lib/error-messages";

describe("getErrorMessage", () => {
  describe("日本語メッセージ", () => {
    it("AUTH_REQUIREDに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_REQUIRED", "日本語");

      // Assert
      expect(result).toBe("ログインが必要です");
    });

    it("AUTH_INVALIDに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_INVALID", "日本語");

      // Assert
      expect(result).toBe("認証情報が正しくありません");
    });

    it("AUTH_EXPIREDに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_EXPIRED", "日本語");

      // Assert
      expect(result).toBe("セッションの有効期限が切れました。再度ログインしてください");
    });

    it("FORBIDDENに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("FORBIDDEN", "日本語");

      // Assert
      expect(result).toBe("この操作を実行する権限がありません");
    });

    it("NOT_FOUNDに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("NOT_FOUND", "日本語");

      // Assert
      expect(result).toBe("リソースが見つかりません");
    });

    it("VALIDATION_FAILEDに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("VALIDATION_FAILED", "日本語");

      // Assert
      expect(result).toBe("入力内容を確認してください");
    });

    it("DUPLICATEに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("DUPLICATE", "日本語");

      // Assert
      expect(result).toBe("すでに登録されています");
    });

    it("CONFLICTに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("CONFLICT", "日本語");

      // Assert
      expect(result).toBe("競合が発生しました");
    });

    it("INTERNAL_ERRORに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("INTERNAL_ERROR", "日本語");

      // Assert
      expect(result).toBe("サーバーエラーが発生しました");
    });

    it("未知のエラーコードに対してフォールバック日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("UNKNOWN_CODE", "日本語");

      // Assert
      expect(result).toBe("予期しないエラーが発生しました");
    });
  });

  describe("英語メッセージ", () => {
    it("AUTH_REQUIREDに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_REQUIRED", "English");

      // Assert
      expect(result).toBe("Login required");
    });

    it("AUTH_INVALIDに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_INVALID", "English");

      // Assert
      expect(result).toBe("Invalid credentials");
    });

    it("AUTH_EXPIREDに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_EXPIRED", "English");

      // Assert
      expect(result).toBe("Session expired. Please log in again");
    });

    it("FORBIDDENに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("FORBIDDEN", "English");

      // Assert
      expect(result).toBe("You do not have permission to perform this action");
    });

    it("NOT_FOUNDに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("NOT_FOUND", "English");

      // Assert
      expect(result).toBe("Resource not found");
    });

    it("VALIDATION_FAILEDに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("VALIDATION_FAILED", "English");

      // Assert
      expect(result).toBe("Please check your input");
    });

    it("DUPLICATEに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("DUPLICATE", "English");

      // Assert
      expect(result).toBe("Already registered");
    });

    it("CONFLICTに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("CONFLICT", "English");

      // Assert
      expect(result).toBe("A conflict occurred");
    });

    it("INTERNAL_ERRORに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("INTERNAL_ERROR", "English");

      // Assert
      expect(result).toBe("A server error occurred");
    });

    it("未知のエラーコードに対してフォールバック英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("UNKNOWN_CODE", "English");

      // Assert
      expect(result).toBe("An unexpected error occurred");
    });
  });
});
