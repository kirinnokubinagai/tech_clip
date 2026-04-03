import * as Sentry from "@sentry/react-native";
import { captureException, initSentry } from "./sentry";

jest.mock("@sentry/react-native");

const mockInit = jest.mocked(Sentry.init);
const mockCaptureException = jest.mocked(Sentry.captureException);
const mockGetClient = jest.mocked(Sentry.getClient);

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

  it("開発環境ではSentry送信が無効になること", () => {
    // Arrange
    const dsn = "https://examplePublicKey@o0.ingest.sentry.io/0";

    // Act
    initSentry(dsn);

    // Assert
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn,
        enabled: false,
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

  it("Sentryクライアントが初期化済みの場合にErrorオブジェクトをキャプチャできること", () => {
    // Arrange
    mockGetClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    const error = new Error("テストエラー");

    // Act
    captureException(error);

    // Assert
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("Sentryクライアントが未初期化の場合にcaptureExceptionを呼び出さないこと", () => {
    // Arrange
    mockGetClient.mockReturnValue(undefined);
    const error = new Error("テストエラー");

    // Act
    captureException(error);

    // Assert
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("Sentryクライアントが初期化済みの場合にErrorでない値もキャプチャできること", () => {
    // Arrange
    mockGetClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    const error = "文字列エラー";

    // Act
    captureException(error);

    // Assert
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });
});
