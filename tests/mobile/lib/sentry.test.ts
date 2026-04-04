import { captureException, initSentry } from "@mobile/lib/sentry";
import * as Sentry from "@sentry/react-native";

jest.mock("@sentry/react-native");

const mockInit = jest.mocked(Sentry.init);
const mockCaptureException = jest.mocked(Sentry.captureException);
const mockGetClient = jest.mocked(Sentry.getClient);

describe("initSentry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("DSN が設定されている場合に Sentry.init を呼び出せること", () => {
    const dsn = "https://examplePublicKey@o0.ingest.sentry.io/0";

    initSentry(dsn);

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn,
      }),
    );
  });

  it("DSN が空文字の場合に Sentry.init を呼び出さないこと", () => {
    initSentry("");

    expect(mockInit).not.toHaveBeenCalled();
  });

  it("DSN が undefined の場合に Sentry.init を呼び出さないこと", () => {
    initSentry(undefined);

    expect(mockInit).not.toHaveBeenCalled();
  });

  it("開発環境では Sentry 送信が無効になること", () => {
    const dsn = "https://examplePublicKey@o0.ingest.sentry.io/0";

    initSentry(dsn);

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

  it("Sentry クライアントが初期化済みの場合に Error をキャプチャできること", () => {
    mockGetClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    const error = new Error("テストエラー");

    captureException(error);

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });

  it("Sentry クライアントが未初期化の場合に captureException を呼び出さないこと", () => {
    mockGetClient.mockReturnValue(undefined);
    const error = new Error("テストエラー");

    captureException(error);

    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it("Sentry クライアントが初期化済みの場合に Error でない値もキャプチャできること", () => {
    mockGetClient.mockReturnValue({} as ReturnType<typeof Sentry.getClient>);

    captureException("文字列エラー");

    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith("文字列エラー");
  });
});
