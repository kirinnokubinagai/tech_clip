import * as Sentry from "@sentry/react-native";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { captureException, initSentry } from "./sentry";

jest.mock("@sentry/react-native");

const mockInit = jest.mocked(Sentry.init);
const mockCaptureException = jest.mocked(Sentry.captureException);
const mockIsInitialized = jest.mocked(Sentry.isInitialized);

describe("initSentry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("DSNが設定されている場合にSentry.initを呼び出せること", () => {
    // Arrange
    const dsn = "https://examplePublicKey@o0.ingest.sentry.io/0";

    // Act
    initSentry(dsn);

    // Assert
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn,
      }),
    );
  });

  it("DSNが空文字の場合にSentry.initを呼び出さないこと", () => {
    // Arrange
    const dsn = "";

    // Act
    initSentry(dsn);

    // Assert
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("DSNがundefinedの場合にSentry.initを呼び出さないこと", () => {
    // Arrange
    const dsn = undefined;

    // Act
    initSentry(dsn);

    // Assert
    expect(mockInit).not.toHaveBeenCalled();
  });

  it("enableInExpoDevelopmentがfalseで設定されること", () => {
    // Arrange
    const dsn = "https://examplePublicKey@o0.ingest.sentry.io/0";

    // Act
    initSentry(dsn);

    // Assert
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn,
        enableInExpoDevelopment: false,
      }),
    );
  });
});

describe("captureException", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Sentryが初期化済みの場合にErrorオブジェクトをキャプチャできること", () => {
    // Arrange
    mockIsInitialized.mockReturnValue(true);
    const error = new Error("テストエラー");

    // Act
    captureException(error);

    // Assert
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("Sentryが未初期化の場合にcaptureExceptionを呼び出さないこと", () => {
    // Arrange
    mockIsInitialized.mockReturnValue(false);
    const error = new Error("テストエラー");

    // Act
    captureException(error);

    // Assert
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("Sentryが初期化済みの場合にErrorでない値もキャプチャできること", () => {
    // Arrange
    mockIsInitialized.mockReturnValue(true);
    const error = "文字列エラー";

    // Act
    captureException(error);

    // Assert
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });
});
