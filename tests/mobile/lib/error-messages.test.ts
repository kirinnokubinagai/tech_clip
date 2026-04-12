import { getErrorMessage } from "@mobile/lib/error-messages";

describe("getErrorMessage", () => {
  describe("日本語メッセージ", () => {
    it("AUTH_REQUIREDに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_REQUIRED", "ja");

      // Assert
      expect(result).toBe("ログインが必要です");
    });

    it("AUTH_INVALIDに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_INVALID", "ja");

      // Assert
      expect(result).toBe("認証情報が正しくありません");
    });

    it("AUTH_EXPIREDに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_EXPIRED", "ja");

      // Assert
      expect(result).toBe("セッションの有効期限が切れました。再度ログインしてください");
    });

    it("FORBIDDENに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("FORBIDDEN", "ja");

      // Assert
      expect(result).toBe("この操作を実行する権限がありません");
    });

    it("NOT_FOUNDに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("NOT_FOUND", "ja");

      // Assert
      expect(result).toBe("リソースが見つかりません");
    });

    it("VALIDATION_FAILEDに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("VALIDATION_FAILED", "ja");

      // Assert
      expect(result).toBe("入力内容を確認してください");
    });

    it("DUPLICATEに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("DUPLICATE", "ja");

      // Assert
      expect(result).toBe("すでに登録されています");
    });

    it("CONFLICTに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("CONFLICT", "ja");

      // Assert
      expect(result).toBe("競合が発生しました");
    });

    it("INTERNAL_ERRORに対して日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("INTERNAL_ERROR", "ja");

      // Assert
      expect(result).toBe("サーバーエラーが発生しました");
    });

    it("未知のエラーコードに対してフォールバック日本語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("UNKNOWN_CODE", "ja");

      // Assert
      expect(result).toBe("予期しないエラーが発生しました");
    });
  });

  describe("簡体中文メッセージ", () => {
    it("AUTH_REQUIREDに対して簡体中文メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_REQUIRED", "zh-CN");

      // Assert
      expect(result).toBe("需要登录");
    });

    it("INTERNAL_ERRORに対して簡体中文メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("INTERNAL_ERROR", "zh-CN");

      // Assert
      expect(result).toBe("服务器发生错误");
    });

    it("未知のエラーコードに対してフォールバック簡体中文メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("UNKNOWN_CODE", "zh-CN");

      // Assert
      expect(result).toBe("发生了意外错误");
    });
  });

  describe("繁體中文メッセージ", () => {
    it("AUTH_REQUIREDに対して繁體中文メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_REQUIRED", "zh-TW");

      // Assert
      expect(result).toBe("需要登入");
    });

    it("INTERNAL_ERRORに対して繁體中文メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("INTERNAL_ERROR", "zh-TW");

      // Assert
      expect(result).toBe("伺服器發生錯誤");
    });

    it("未知のエラーコードに対してフォールバック繁體中文メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("UNKNOWN_CODE", "zh-TW");

      // Assert
      expect(result).toBe("發生了意外錯誤");
    });
  });

  describe("韓国語メッセージ", () => {
    it("AUTH_REQUIREDに対して韓国語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_REQUIRED", "ko");

      // Assert
      expect(result).toBe("로그인이 필요합니다");
    });

    it("INTERNAL_ERRORに対して韓国語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("INTERNAL_ERROR", "ko");

      // Assert
      expect(result).toBe("서버 오류가 발생했습니다");
    });

    it("未知のエラーコードに対してフォールバック韓国語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("UNKNOWN_CODE", "ko");

      // Assert
      expect(result).toBe("예기치 않은 오류가 발생했습니다");
    });
  });

  describe("英語メッセージ", () => {
    it("AUTH_REQUIREDに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_REQUIRED", "en");

      // Assert
      expect(result).toBe("Login required");
    });

    it("AUTH_INVALIDに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_INVALID", "en");

      // Assert
      expect(result).toBe("Invalid credentials");
    });

    it("AUTH_EXPIREDに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("AUTH_EXPIRED", "en");

      // Assert
      expect(result).toBe("Session expired. Please log in again");
    });

    it("FORBIDDENに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("FORBIDDEN", "en");

      // Assert
      expect(result).toBe("You do not have permission to perform this action");
    });

    it("NOT_FOUNDに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("NOT_FOUND", "en");

      // Assert
      expect(result).toBe("Resource not found");
    });

    it("VALIDATION_FAILEDに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("VALIDATION_FAILED", "en");

      // Assert
      expect(result).toBe("Please check your input");
    });

    it("DUPLICATEに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("DUPLICATE", "en");

      // Assert
      expect(result).toBe("Already registered");
    });

    it("CONFLICTに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("CONFLICT", "en");

      // Assert
      expect(result).toBe("A conflict occurred");
    });

    it("INTERNAL_ERRORに対して英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("INTERNAL_ERROR", "en");

      // Assert
      expect(result).toBe("A server error occurred");
    });

    it("未知のエラーコードに対してフォールバック英語メッセージを返すこと", () => {
      // Arrange & Act
      const result = getErrorMessage("UNKNOWN_CODE", "en");

      // Assert
      expect(result).toBe("An unexpected error occurred");
    });
  });
});
