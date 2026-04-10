import { describe, expect, it } from "vitest";
import {
  isLoggerJsonOutput,
  isSuppressedLogLevel,
  shouldSuppressTestLog,
} from "../../../apps/api/vitest.utils";

describe("isLoggerJsonOutput", () => {
  it("levelとmessageを持つJSONはロガー出力と判定できること", () => {
    // Arrange
    const log = JSON.stringify({
      level: "warn",
      message: "テスト警告",
      timestamp: "2024-01-01T00:00:00.000Z",
    });

    // Act
    const result = isLoggerJsonOutput(log);

    // Assert
    expect(result).toBe(true);
  });

  it("{で始まらない文字列はロガー出力ではないと判定できること", () => {
    // Arrange
    const log = "通常のログ出力";

    // Act
    const result = isLoggerJsonOutput(log);

    // Assert
    expect(result).toBe(false);
  });

  it("levelがないJSONはロガー出力ではないと判定できること", () => {
    // Arrange
    const log = JSON.stringify({ message: "テスト", timestamp: "2024-01-01T00:00:00.000Z" });

    // Act
    const result = isLoggerJsonOutput(log);

    // Assert
    expect(result).toBe(false);
  });

  it("messageがないJSONはロガー出力ではないと判定できること", () => {
    // Arrange
    const log = JSON.stringify({ level: "info", timestamp: "2024-01-01T00:00:00.000Z" });

    // Act
    const result = isLoggerJsonOutput(log);

    // Assert
    expect(result).toBe(false);
  });

  it("不正なJSONはロガー出力ではないと判定できること", () => {
    // Arrange
    const log = "{ invalid json }";

    // Act
    const result = isLoggerJsonOutput(log);

    // Assert
    expect(result).toBe(false);
  });
});

describe("isSuppressedLogLevel", () => {
  it("warnレベルは抑制対象と判定できること", () => {
    // Arrange
    const log = JSON.stringify({ level: "warn", message: "警告" });

    // Act
    const result = isSuppressedLogLevel(log);

    // Assert
    expect(result).toBe(true);
  });

  it("infoレベルは抑制対象と判定できること", () => {
    // Arrange
    const log = JSON.stringify({ level: "info", message: "情報" });

    // Act
    const result = isSuppressedLogLevel(log);

    // Assert
    expect(result).toBe(true);
  });

  it("debugレベルは抑制対象と判定できること", () => {
    // Arrange
    const log = JSON.stringify({ level: "debug", message: "デバッグ" });

    // Act
    const result = isSuppressedLogLevel(log);

    // Assert
    expect(result).toBe(true);
  });

  it("errorレベルは抑制対象でないと判定できること", () => {
    // Arrange
    const log = JSON.stringify({ level: "error", message: "エラー" });

    // Act
    const result = isSuppressedLogLevel(log);

    // Assert
    expect(result).toBe(false);
  });

  it("不正なJSONは抑制対象でないと判定できること", () => {
    // Arrange
    const log = "{ invalid json }";

    // Act
    const result = isSuppressedLogLevel(log);

    // Assert
    expect(result).toBe(false);
  });
});

describe("shouldSuppressTestLog", () => {
  it("warnレベルのロガー出力は抑制されること", () => {
    // Arrange
    const log = JSON.stringify({
      level: "warn",
      message: "リフレッシュトークンの再利用を検知しました",
      timestamp: "2024-01-01T00:00:00.000Z",
    });

    // Act
    const result = shouldSuppressTestLog(log);

    // Assert
    expect(result).toBe(false);
  });

  it("infoレベルのロガー出力は抑制されること", () => {
    // Arrange
    const log = JSON.stringify({
      level: "info",
      message: "ユーザーログイン",
      timestamp: "2024-01-01T00:00:00.000Z",
    });

    // Act
    const result = shouldSuppressTestLog(log);

    // Assert
    expect(result).toBe(false);
  });

  it("debugレベルのロガー出力は抑制されること", () => {
    // Arrange
    const log = JSON.stringify({
      level: "debug",
      message: "デバッグ情報",
      timestamp: "2024-01-01T00:00:00.000Z",
    });

    // Act
    const result = shouldSuppressTestLog(log);

    // Assert
    expect(result).toBe(false);
  });

  it("errorレベルのロガー出力は抑制されないこと", () => {
    // Arrange
    const log = JSON.stringify({
      level: "error",
      message: "重大なエラー",
      timestamp: "2024-01-01T00:00:00.000Z",
    });

    // Act
    const result = shouldSuppressTestLog(log);

    // Assert
    expect(result).toBeUndefined();
  });

  it("通常のconsole出力は抑制されないこと", () => {
    // Arrange
    const log = "通常のコンソール出力";

    // Act
    const result = shouldSuppressTestLog(log);

    // Assert
    expect(result).toBeUndefined();
  });
});
