import { EMAIL_SIMPLE_REGEX, PASSWORD_MIN_LENGTH } from "@/lib/validation";

describe("EMAIL_SIMPLE_REGEX", () => {
  describe("有効なメールアドレス", () => {
    it("標準的なメールアドレスがマッチすること", () => {
      // Arrange
      const email = "user@example.com";

      // Act
      const result = EMAIL_SIMPLE_REGEX.test(email);

      // Assert
      expect(result).toBe(true);
    });

    it("サブドメインを含むメールアドレスがマッチすること", () => {
      // Arrange
      const email = "user@mail.example.co.jp";

      // Act
      const result = EMAIL_SIMPLE_REGEX.test(email);

      // Assert
      expect(result).toBe(true);
    });

    it("プラス記号を含むメールアドレスがマッチすること", () => {
      // Arrange
      const email = "user+tag@example.com";

      // Act
      const result = EMAIL_SIMPLE_REGEX.test(email);

      // Assert
      expect(result).toBe(true);
    });

    it("ドットを含むローカルパートのメールアドレスがマッチすること", () => {
      // Arrange
      const email = "first.last@example.com";

      // Act
      const result = EMAIL_SIMPLE_REGEX.test(email);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe("無効なメールアドレス", () => {
    it("@記号がない場合はマッチしないこと", () => {
      // Arrange
      const email = "userexample.com";

      // Act
      const result = EMAIL_SIMPLE_REGEX.test(email);

      // Assert
      expect(result).toBe(false);
    });

    it("空白を含む場合はマッチしないこと", () => {
      // Arrange
      const email = "user @example.com";

      // Act
      const result = EMAIL_SIMPLE_REGEX.test(email);

      // Assert
      expect(result).toBe(false);
    });

    it("ドメインにドットがない場合はマッチしないこと", () => {
      // Arrange
      const email = "user@examplecom";

      // Act
      const result = EMAIL_SIMPLE_REGEX.test(email);

      // Assert
      expect(result).toBe(false);
    });

    it("ローカルパートが空の場合はマッチしないこと", () => {
      // Arrange
      const email = "@example.com";

      // Act
      const result = EMAIL_SIMPLE_REGEX.test(email);

      // Assert
      expect(result).toBe(false);
    });

    it("ドメインパートが空の場合はマッチしないこと", () => {
      // Arrange
      const email = "user@";

      // Act
      const result = EMAIL_SIMPLE_REGEX.test(email);

      // Assert
      expect(result).toBe(false);
    });

    it("空文字列の場合はマッチしないこと", () => {
      // Arrange
      const email = "";

      // Act
      const result = EMAIL_SIMPLE_REGEX.test(email);

      // Assert
      expect(result).toBe(false);
    });
  });
});

describe("PASSWORD_MIN_LENGTH", () => {
  it("パスワード最小文字数が8であること", () => {
    // Arrange & Act & Assert
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});
