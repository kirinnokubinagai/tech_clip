import i18n from "../../../apps/mobile/src/lib/i18n";

describe("i18n", () => {
  describe("初期化", () => {
    it("i18nインスタンスが初期化されていること", () => {
      // Assert
      expect(i18n.isInitialized).toBe(true);
    });

    it("日本語リソースが登録されていること", () => {
      // Assert
      expect(i18n.hasResourceBundle("ja", "translation")).toBe(true);
    });

    it("英語リソースが登録されていること", () => {
      // Assert
      expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
    });

    it("フォールバック言語が日本語であること", async () => {
      // Assert
      expect(i18n.options.fallbackLng).toContain("ja");
    });
  });

  describe("日本語翻訳", () => {
    beforeEach(() => {
      i18n.changeLanguage("ja");
    });

    it("auth.createAccountを日本語で翻訳できること", async () => {
      // Act
      const result = i18n.t("auth.createAccount");

      // Assert
      expect(result).toBe("アカウントを作成");
    });

    it("auth.loginを日本語で翻訳できること", async () => {
      // Act
      const result = i18n.t("auth.login");

      // Assert
      expect(result).toBe("ログイン");
    });

    it("common.loadingを日本語で翻訳できること", async () => {
      // Act
      const result = i18n.t("common.loading");

      // Assert
      expect(result).toBe("読み込み中...");
    });

    it("インターポレーションが機能すること", async () => {
      // Act
      const result = i18n.t("auth.validation.passwordMinLength", { min: 8 });

      // Assert
      expect(result).toBe("パスワードは8文字以上で入力してください");
    });
  });

  describe("英語翻訳", () => {
    beforeEach(() => {
      i18n.changeLanguage("en");
    });

    afterEach(() => {
      i18n.changeLanguage("ja");
    });

    it("auth.createAccountを英語で翻訳できること", async () => {
      // Act
      const result = i18n.t("auth.createAccount");

      // Assert
      expect(result).toBe("Create account");
    });

    it("auth.loginを英語で翻訳できること", async () => {
      // Act
      const result = i18n.t("auth.login");

      // Assert
      expect(result).toBe("Log in");
    });

    it("common.loadingを英語で翻訳できること", async () => {
      // Act
      const result = i18n.t("common.loading");

      // Assert
      expect(result).toBe("Loading...");
    });

    it("インターポレーションが英語でも機能すること", async () => {
      // Act
      const result = i18n.t("auth.validation.passwordMinLength", { min: 8 });

      // Assert
      expect(result).toBe("Password must be at least 8 characters");
    });
  });

  describe("言語切り替え", () => {
    it("changeLanguageで言語を切り替えられること", async () => {
      // Arrange
      await i18n.changeLanguage("en");

      // Act
      const result = i18n.t("auth.login");

      // Assert
      expect(result).toBe("Log in");

      // Cleanup
      await i18n.changeLanguage("ja");
    });

    it("切り替え後に日本語に戻せること", async () => {
      // Arrange
      await i18n.changeLanguage("en");
      await i18n.changeLanguage("ja");

      // Act
      const result = i18n.t("auth.login");

      // Assert
      expect(result).toBe("ログイン");
    });
  });

  describe("存在しないキー", () => {
    it("存在しないキーに対してキー文字列を返すこと", () => {
      // Act
      const result = i18n.t("nonexistent.key");

      // Assert
      expect(result).toBe("nonexistent.key");
    });
  });
});
