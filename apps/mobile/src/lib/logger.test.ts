import * as Sentry from "@sentry/react-native";
import { createLogger } from "./logger";

jest.mock("@sentry/react-native");

const mockCaptureException = jest.mocked(Sentry.captureException);
const mockGetClient = jest.mocked(Sentry.getClient);

describe("createLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetClient.mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

    it("Sentryクライアントが初期化済みかつcontextにerrorがある場合にcaptureExceptionを呼び出せること", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGetClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
      const logger = createLogger();
      const error = new Error("Sentryキャプチャテスト");

      // Act
      logger.error("エラー発生", { error });

      // Assert
      expect(mockCaptureException).toHaveBeenCalledTimes(1);
      expect(mockCaptureException).toHaveBeenCalledWith(error);
      consoleSpy.mockRestore();
    });

    it("Sentryクライアントが未初期化の場合にcaptureExceptionを呼び出さないこと", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGetClient.mockReturnValue(undefined);
      const logger = createLogger();
      const error = new Error("未初期化テスト");

      // Act
      logger.error("エラー発生", { error });

      // Assert
      expect(mockCaptureException).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("contextにerrorキーがない場合にcaptureExceptionを呼び出さないこと", () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGetClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
      const logger = createLogger();

      // Act
      logger.error("エラー発生", { message: "errorキーなし" });

      // Assert
      expect(mockCaptureException).not.toHaveBeenCalled();
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
