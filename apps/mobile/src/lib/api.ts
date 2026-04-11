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

/**
 * APIエラーの基底クラス
 */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
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

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
  }
}

/**
 * ネットワークエラー
 * fetch自体が失敗した場合（オフライン、タイムアウト等）にスローする
 */
export class ApiNetworkError extends ApiError {
  /** 元のエラー */
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ApiNetworkError";
    this.cause = cause;
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
 * Content-TypeヘッダーがJSONを示しているかどうかを判定する
 *
 * @param response - fetchレスポンス
 * @returns JSONを示している、またはヘッダーが無ければ true
 */
function isJsonContentType(response: Response): boolean {
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
 * @param existingHeaders - 既存のヘッダー
 * @returns 構築済みヘッダー
 */
function buildHeaders(
  token: string | null,
  existingHeaders: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...existingHeaders,
  };

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
  if (!isJsonContentType(response)) {
    throw new ApiParseError(response.status, PARSE_ERROR_MESSAGE);
  }
  const parsed = await tryParseJson(response);
  if (parsed === PARSE_FAILED) {
    throw new ApiParseError(response.status, PARSE_ERROR_MESSAGE);
  }
  return parsed as T;
}

/**
 * 業務エラー形式かどうかを判定する
 * `{ success: false, error: { ... } }` の形を許容する
 *
 * @param value - 判定対象
 * @returns 業務エラー形式なら true
 */
function isBusinessErrorPayload(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const maybe = value as { success?: unknown; error?: unknown };
  return maybe.success === false && typeof maybe.error === "object" && maybe.error !== null;
}

/**
 * 非2xxレスポンスの本文を扱う
 * 業務エラーJSONならそのまま返し、そうでなければ ApiHttpError をスローする
 *
 * @param response - fetchレスポンス
 * @returns 業務エラー本文
 * @throws ApiHttpError - 非JSONまたは業務エラー形式でない場合
 */
async function handleErrorResponse<T>(response: Response): Promise<T> {
  const parsed = await tryParseJson(response);
  if (parsed === PARSE_FAILED) {
    throw new ApiHttpError(response.status, HTTP_ERROR_MESSAGE);
  }
  if (!isBusinessErrorPayload(parsed)) {
    throw new ApiHttpError(response.status, HTTP_ERROR_MESSAGE);
  }
  return parsed as T;
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
  const existingHeaders = (options.headers as Record<string, string>) ?? {};
  const headers = buildHeaders(token, existingHeaders);

  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (response.status !== HTTP_STATUS_UNAUTHORIZED) {
    return interpretResponse<T>(response);
  }

  const newToken = await refreshAccessToken(baseUrl);

  const retryHeaders = buildHeaders(newToken, existingHeaders);
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
