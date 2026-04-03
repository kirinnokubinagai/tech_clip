import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../../../apps/api/src/lib/logger";

describe("createLogger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("info", () => {
    it("infoレベルのJSONログを出力できること", () => {
      // Arrange
      const logger = createLogger();

      // Act
      logger.info("テストメッセージ", { key: "value" });

      // Assert
      expect(console.log).toHaveBeenCalledTimes(1);
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("テストメッセージ");
      expect(parsed.key).toBe("value");
    });

    it("タイムスタンプがISO形式で含まれること", () => {
      // Arrange
      const logger = createLogger();

      // Act
      logger.info("テスト");

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(typeof parsed.timestamp).toBe("string");
      expect(() => new Date(parsed.timestamp as string)).not.toThrow();
    });

    it("コンテキストなしでも動作すること", () => {
      // Arrange
      const logger = createLogger();

      // Act
      logger.info("コンテキストなし");

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("コンテキストなし");
    });
  });

  describe("warn", () => {
    it("warnレベルのJSONログを出力できること", () => {
      // Arrange
      const logger = createLogger();

      // Act
      logger.warn("警告メッセージ", { code: "WARN_001" });

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.level).toBe("warn");
      expect(parsed.message).toBe("警告メッセージ");
      expect(parsed.code).toBe("WARN_001");
    });
  });

  describe("error", () => {
    it("errorレベルのJSONログを出力できること", () => {
      // Arrange
      const logger = createLogger();

      // Act
      logger.error("エラーメッセージ", { errorCode: 500 });

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.level).toBe("error");
      expect(parsed.message).toBe("エラーメッセージ");
      expect(parsed.errorCode).toBe(500);
    });

    it("Errorオブジェクトをシリアライズできること", () => {
      // Arrange
      const logger = createLogger();
      const error = new Error("テストエラー");

      // Act
      logger.error("エラー発生", { error });

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.level).toBe("error");
    });
  });

  describe("debug", () => {
    it("debugレベルのJSONログを出力できること", () => {
      // Arrange
      const logger = createLogger();

      // Act
      logger.debug("デバッグメッセージ", { detail: "詳細情報" });

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.level).toBe("debug");
      expect(parsed.message).toBe("デバッグメッセージ");
      expect(parsed.detail).toBe("詳細情報");
    });
  });

  describe("requestIdの引き継ぎ", () => {
    it("withRequestIdでリクエストIDをすべてのログに付加できること", () => {
      // Arrange
      const logger = createLogger();
      const requestId = "test-request-id-123";

      // Act
      const scopedLogger = logger.withRequestId(requestId);
      scopedLogger.info("スコープ付きログ");

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.requestId).toBe(requestId);
      expect(parsed.message).toBe("スコープ付きログ");
    });

    it("withRequestIdのスコープ外のログにはrequestIdが含まれないこと", () => {
      // Arrange
      const logger = createLogger();

      // Act
      logger.info("スコープなしログ");

      // Assert
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed.requestId).toBeUndefined();
    });
  });
});
