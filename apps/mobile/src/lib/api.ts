import Constants from "expo-constants";

import {
  clearAuthTokens,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
} from "./secure-store";

/** API通信のタイムアウト（ミリ秒） */
const REQUEST_TIMEOUT_MS = 15000;

/** トークンリフレッシュAPIのパス */
const REFRESH_TOKEN_PATH = "/api/auth/refresh";

/** HTTPステータスコード: 未認証 */
const HTTP_STATUS_UNAUTHORIZED = 401;

/** HTTPステータスコード: 成功範囲の下限 */
const HTTP_STATUS_SUCCESS_MIN = 200;

/** HTTPステータスコード: 成功範囲の上限（未満） */
const HTTP_STATUS_SUCCESS_MAX = 300;

/** JSONのContent-Type判定用の文字列 */
const JSON_CONTENT_TYPE_HINT = "json";

/** getBaseUrl のフォールバックURL */
const DEFAULT_API_BASE_URL = "http://localhost:8787";

/** Abortエラーの識別名 */
const ABORT_ERROR_NAME = "AbortError";

/** タイムアウト時のエラーメッセージ */
const TIMEOUT_ERROR_MESSAGE = "リクエストがタイムアウトしました";

/** ネットワーク接続不能時のエラーメッセージ */
const NETWORK_ERROR_MESSAGE = "ネットワークに接続できません";

/** HTTPエラー時のデフォルトメッセージ */
const HTTP_ERROR_MESSAGE = "サーバーエラーが発生しました";

/** パースエラー時のデフォルトメッセージ */
const PARSE_ERROR_MESSAGE = "レスポンスの解析に失敗しました";

/** ステータスコード別デフォルトメッセージ（非業務エラー時のフォールバック） */
const HTTP_ERROR_MESSAGES_BY_STATUS: Readonly<Record<number, string>> = {
  400: "リクエストが正しくありません",
  403: "この操作を実行する権限がありません",
  404: "リソースが見つかりません",
  408: "リクエストがタイムアウトしました",
  409: "競合が発生しました",
  413: "送信データが大きすぎます",
  422: "入力内容を確認してください",
  429: "リクエストが多すぎます。しばらく待ってから再度お試しください",
  500: "サーバーエラーが発生しました",
  502: "サーバーに接続できません",
  503: "サービスが一時的に利用できません",
  504: "サーバー応答がタイムアウトしました",
};

/** bodyText のプレビュー最大長（診断用に残すが機密抑制のため制限） */
const BODY_TEXT_PREVIEW_MAX_LENGTH = 512;

/**
 * APIエラーの基底クラス
 */
export class ApiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
  }
}

/**
 * セッション期限切れエラー
 * トークンリフレッシュに失敗した場合にスローする
 */
export class SessionExpiredError extends ApiError {
  constructor() {
    super("セッションの有効期限が切れました。再度ログインしてください");
    this.name = "SessionExpiredError";
  }
}

/**
 * HTTPエラー（非2xxかつ業務エラーJSONでない応答）
 * 非JSON本文や空本文など、業務エラーとして解釈できない非2xx応答に対して使う
 */
export class ApiHttpError extends ApiError {
  /** HTTPステータスコード */
  public readonly status: number;
  /** 業務エラーJSONから取得した code。非業務エラー時は undefined */
  public readonly code?: string;
  /** 業務エラーJSONから取得した details。非業務エラー時は undefined */
  public readonly details?: unknown;
  /** レスポンス本文の先頭（診断用、最大 BODY_TEXT_PREVIEW_MAX_LENGTH 文字） */
  public readonly bodyText?: string;

  constructor(
    status: number,
    message: string,
    options?: { code?: string; details?: unknown; bodyText?: string; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ApiHttpError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
    this.bodyText = options?.bodyText;
  }
}

/**
 * ネットワークエラー
 * fetch自体が失敗した場合（オフライン、タイムアウト等）にスローする
 */
export class ApiNetworkError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ApiNetworkError";
  }
}

/**
 * レスポンス解析エラー
 * 2xxレスポンスでJSONパースに失敗した場合にスローする
 */
export class ApiParseError extends ApiError {
  /** HTTPステータスコード */
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiParseError";
    this.status = status;
  }
}

/**
 * リフレッシュトークンAPIのレスポンス型
 */
type RefreshTokenResponse = {
  success: true;
  data: { token: string; refreshToken: string };
};

/**
 * リフレッシュトークンAPIのレスポンスを型ガードで検証する
 *
 * @param value - 検証対象
 * @returns RefreshTokenResponse 型なら true
 */
function isRefreshTokenResponse(value: unknown): value is RefreshTokenResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("success" in value) || (value as { success: unknown }).success !== true) {
    return false;
  }
  const data = (value as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return false;
  }
  return (
    typeof (data as { token?: unknown }).token === "string" &&
    typeof (data as { refreshToken?: unknown }).refreshToken === "string"
  );
}

/**
 * APIのベースURLを取得する
 *
 * @returns Workers APIのベースURL
 */
export function getBaseUrl(): string {
  const extra = Constants.expoConfig?.extra;
  if (extra && typeof extra === "object" && "apiUrl" in extra) {
    const apiUrl = (extra as { apiUrl?: unknown }).apiUrl;
    if (typeof apiUrl === "string") {
      return apiUrl;
    }
  }
  return DEFAULT_API_BASE_URL;
}

/**
 * HTTPステータスが成功範囲（2xx）かどうかを判定する
 *
 * @param status - HTTPステータスコード
 * @returns 2xxなら true
 */
function isSuccessStatus(status: number): boolean {
  return status >= HTTP_STATUS_SUCCESS_MIN && status < HTTP_STATUS_SUCCESS_MAX;
}

/**
 * レスポンスをJSONとしてパースすべきかどうかを判定する
 * Content-TypeがJSONを示している場合、またはContent-Typeヘッダーが存在しない場合に true を返す
 * Content-TypeなしはJSONとして扱う（一部サーバーがヘッダーを省略するため）
 *
 * @param response - fetchレスポンス
 * @returns JSONとしてパースすべきなら true
 */
function shouldParseAsJson(response: Response): boolean {
  const contentType = response.headers.get("content-type");
  if (!contentType) {
    return true;
  }
  return contentType.toLowerCase().includes(JSON_CONTENT_TYPE_HINT);
}

/**
 * タイムアウト付きfetchを実行する
 * fetchが reject した場合は ApiNetworkError にラップする
 *
 * @param url - リクエストURL
 * @param options - fetchオプション
 * @returns fetchレスポンス
 * @throws ApiNetworkError - ネットワーク不通・タイムアウト時
 */
export async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === ABORT_ERROR_NAME) {
      throw new ApiNetworkError(TIMEOUT_ERROR_MESSAGE, error);
    }
    throw new ApiNetworkError(NETWORK_ERROR_MESSAGE, error);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * リクエストヘッダーを構築する
 *
 * @param token - 認証トークン。nullの場合はAuthorizationヘッダーを付与しない
 * @param existingHeaders - 既存のヘッダー（Content-Type 等は呼び出し側が責任を持つ）
 * @returns 構築済みヘッダー
 */
function buildHeaders(
  token: string | null,
  existingHeaders: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = { ...existingHeaders };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/** JSONパース失敗を示す内部センチネル */
const PARSE_FAILED = Symbol("parse-failed");

/**
 * レスポンス本文をJSONとしてパースする
 * パースに失敗した場合は PARSE_FAILED を返す
 *
 * @param response - fetchレスポンス
 * @returns パース結果。失敗時は PARSE_FAILED
 */
async function tryParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return PARSE_FAILED;
  }
}

/**
 * 成功レスポンスの本文をパースする
 * パース失敗時は ApiParseError をスローする
 *
 * @param response - fetchレスポンス
 * @returns パース済み本文
 * @throws ApiParseError - Content-TypeがJSON以外、またはJSONパース失敗時
 */
async function parseSuccessBody<T>(response: Response): Promise<T> {
  if (!shouldParseAsJson(response)) {
    throw new ApiParseError(response.status, PARSE_ERROR_MESSAGE);
  }
  const parsed = await tryParseJson(response);
  if (parsed === PARSE_FAILED) {
    throw new ApiParseError(response.status, PARSE_ERROR_MESSAGE);
  }
  return parsed as T;
}

/**
 * 業務エラーの形状を表す型
 * API 規約に従い `error.code` と `error.message` を必須とする
 */
type BusinessErrorShape = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

/**
 * 業務エラー形式かどうかを判定する
 * `{ success: false, error: { code: string; message: string } }` の形を要求する
 *
 * @param value - 判定対象
 * @returns 業務エラー形式なら true
 */
function isBusinessErrorPayload(value: unknown): value is BusinessErrorShape {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const v = value as { success?: unknown; error?: unknown };
  if (v.success !== false) {
    return false;
  }
  if (v.error === null || typeof v.error !== "object" || Array.isArray(v.error)) {
    return false;
  }
  const e = v.error as { code?: unknown; message?: unknown };
  return typeof e.code === "string" && typeof e.message === "string";
}

/**
 * ステータスコードに対応する日本語メッセージを返す
 *
 * @param status - HTTPステータスコード
 * @returns 対応する日本語メッセージ
 */
function defaultHttpErrorMessage(status: number): string {
  return HTTP_ERROR_MESSAGES_BY_STATUS[status] ?? HTTP_ERROR_MESSAGE;
}

/**
 * レスポンス本文をテキストとして一度だけ読み込む
 * 読み込みに失敗した場合は null を返す
 *
 * @param response - fetchレスポンス
 * @returns 読み込んだテキスト。失敗時は null
 */
async function readBodyOnce(response: Response): Promise<{ text: string } | null> {
  try {
    return { text: await response.text() };
  } catch {
    return null;
  }
}

/**
 * テキストを JSON としてパースする
 * パースに失敗した場合は PARSE_FAILED を返す
 *
 * @param text - パース対象の文字列
 * @returns パース結果。失敗時は PARSE_FAILED
 */
function tryParseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return PARSE_FAILED;
  }
}

/**
 * テキストが JSON オブジェクトまたは配列に見えるか判定する
 *
 * @param text - 判定対象の文字列
 * @returns JSON らしければ true
 */
function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/**
 * テキストを BODY_TEXT_PREVIEW_MAX_LENGTH 文字以内に切り詰める
 *
 * @param text - 切り詰め対象の文字列
 * @returns 切り詰め後の文字列
 */
function truncateBodyText(text: string): string {
  return text.length > BODY_TEXT_PREVIEW_MAX_LENGTH
    ? text.slice(0, BODY_TEXT_PREVIEW_MAX_LENGTH)
    : text;
}

/**
 * 非2xxレスポンスの本文を扱う
 * 業務エラーJSONならそのまま返し、そうでなければ ApiHttpError をスローする
 * body は text() で一度だけ読み込み、JSON パースは文字列ベースで行う
 *
 * @param response - fetchレスポンス
 * @returns 業務エラー本文
 * @throws ApiHttpError - 非JSONまたは業務エラー形式でない場合
 */
async function handleErrorResponse<T>(response: Response): Promise<T> {
  const body = await readBodyOnce(response);
  if (body === null) {
    throw new ApiHttpError(response.status, defaultHttpErrorMessage(response.status));
  }

  if (shouldParseAsJson(response) || looksLikeJson(body.text)) {
    const parsed = tryParseJsonText(body.text);
    if (parsed !== PARSE_FAILED && isBusinessErrorPayload(parsed)) {
      return parsed as unknown as T;
    }
  }

  throw new ApiHttpError(response.status, defaultHttpErrorMessage(response.status), {
    bodyText: truncateBodyText(body.text),
  });
}

/**
 * レスポンスを解釈して本文を返す
 * 2xx → 成功パース、非2xx → 業務エラーJSON or ApiHttpError
 *
 * @param response - fetchレスポンス
 * @returns パース済み本文
 * @throws ApiParseError - 2xxだがJSONパース失敗時
 * @throws ApiHttpError - 非2xxかつ業務エラー形式でない場合
 */
async function interpretResponse<T>(response: Response): Promise<T> {
  if (isSuccessStatus(response.status)) {
    return parseSuccessBody<T>(response);
  }
  return handleErrorResponse<T>(response);
}

/**
 * リフレッシュトークンで新しいアクセストークンを取得する
 * 非JSON応答・ネットワーク失敗を含むあらゆる失敗は SessionExpiredError にラップする
 *
 * @param baseUrl - APIのベースURL
 * @returns 新しいアクセストークン
 * @throws SessionExpiredError - リフレッシュに失敗した場合
 */
async function refreshAccessToken(baseUrl: string): Promise<string> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    await clearAuthTokens();
    throw new SessionExpiredError();
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}${REFRESH_TOKEN_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!isSuccessStatus(response.status)) {
      await clearAuthTokens();
      throw new SessionExpiredError();
    }

    const parsed = await tryParseJson(response);
    if (!isRefreshTokenResponse(parsed)) {
      await clearAuthTokens();
      throw new SessionExpiredError();
    }

    await setAuthToken(parsed.data.token);
    await setRefreshToken(parsed.data.refreshToken);
    return parsed.data.token;
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      throw error;
    }
    await clearAuthTokens();
    throw new SessionExpiredError();
  }
}

/**
 * Workers APIへのfetchラッパー
 * Authorizationヘッダーを自動付与し、401時はトークンリフレッシュを試みる
 *
 * @param path - APIパス（例: "/users"）
 * @param options - fetchオプション
 * @returns レスポンスデータ
 * @throws SessionExpiredError - セッションが期限切れでリフレッシュにも失敗した場合
 * @throws ApiHttpError - 非JSONの非2xx応答を受信した場合
 * @throws ApiParseError - 2xx応答のJSONパースに失敗した場合
 * @throws ApiNetworkError - ネットワーク不通・タイムアウト時
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const token = await getAuthToken();
  const isFormData = options.body instanceof FormData;
  const existingHeaders = (options.headers as Record<string, string>) ?? {};
  const headersWithoutContentType = isFormData
    ? existingHeaders
    : { "Content-Type": "application/json", ...existingHeaders };
  const headers = buildHeaders(token, headersWithoutContentType);

  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (response.status !== HTTP_STATUS_UNAUTHORIZED) {
    return interpretResponse<T>(response);
  }

  const newToken = await refreshAccessToken(baseUrl);

  const retryHeaders = buildHeaders(newToken, headersWithoutContentType);
  const retryResponse = await fetchWithTimeout(`${baseUrl}${path}`, {
    ...options,
    headers: retryHeaders,
  });

  if (retryResponse.status === HTTP_STATUS_UNAUTHORIZED) {
    await clearAuthTokens();
    throw new SessionExpiredError();
  }

  return interpretResponse<T>(retryResponse);
}
