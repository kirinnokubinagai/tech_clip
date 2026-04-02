import { createLogger } from "./logger";

describe("createLogger", () => {
  describe("info", () => {
    it("開発環境でinfoメッセージをログ出力できること", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "info").mockImplementation(() => {});
      const logger = createLogger();

      // Act
      logger.info("テストメッセージ");

      // Assert
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it("コンテキスト付きでinfoメッセージをログ出力できること", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "info").mockImplementation(() => {});
      const logger = createLogger();

      // Act
      logger.info("テストメッセージ", { key: "value" });

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("テストメッセージ"),
        expect.objectContaining({ key: "value" }),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("warn", () => {
    it("開発環境でwarnメッセージをログ出力できること", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const logger = createLogger();

      // Act
      logger.warn("警告メッセージ");

      // Assert
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it("コンテキスト付きでwarnメッセージをログ出力できること", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const logger = createLogger();

      // Act
      logger.warn("警告メッセージ", { code: "WARN_001" });

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("警告メッセージ"),
        expect.objectContaining({ code: "WARN_001" }),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("error", () => {
    it("開発環境でerrorメッセージをログ出力できること", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger();

      // Act
      logger.error("エラーメッセージ");

      // Assert
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it("エラーオブジェクト付きでerrorメッセージをログ出力できること", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger();
      const error = new Error("テストエラー");

      // Act
      logger.error("エラー発生", { error });

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("エラー発生"),
        expect.objectContaining({ error }),
      );
      consoleSpy.mockRestore();
    });

    it("コンテキストなしでもerrorメッセージをログ出力できること", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const logger = createLogger();

      // Act
      logger.error("コンテキストなしエラー");

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("コンテキストなしエラー"));
      consoleSpy.mockRestore();
    });
  });

  describe("debug", () => {
    it("開発環境でdebugメッセージをログ出力できること", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
      const logger = createLogger();

      // Act
      logger.debug("デバッグメッセージ");

      // Assert
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });
  });
});
