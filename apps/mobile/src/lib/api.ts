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

/**
 * セッション期限切れエラー
 * トークンリフレッシュに失敗した場合にスローする
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("セッションの有効期限が切れました。再度ログインしてください");
    this.name = "SessionExpiredError";
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
 * APIのベースURLを取得する
 *
 * @returns Workers APIのベースURL
 */
export function getBaseUrl(): string {
  const extra = Constants.expoConfig?.extra;
  if (extra && typeof extra === "object" && "apiUrl" in extra) {
    return extra.apiUrl as string;
  }
  return "http://localhost:8787";
}

/**
 * タイムアウト付きfetchを実行する
 *
 * @param url - リクエストURL
 * @param options - fetchオプション
 * @returns fetchレスポンス
 */
export async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
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

/**
 * リフレッシュトークンで新しいアクセストークンを取得する
 *
 * @returns 新しいアクセストークン
 * @throws SessionExpiredError - リフレッシュに失敗した場合
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    await clearAuthTokens();
    throw new SessionExpiredError();
  }

  const response = await fetchWithTimeout(`${getBaseUrl()}${REFRESH_TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const data = (await response.json()) as RefreshTokenResponse | { success: false };

  if (!data.success) {
    await clearAuthTokens();
    throw new SessionExpiredError();
  }

  const newToken = (data as RefreshTokenResponse).data.token;
  const newRefreshToken = (data as RefreshTokenResponse).data.refreshToken;
  await setAuthToken(newToken);
  await setRefreshToken(newRefreshToken);
  return newToken;
}

/**
 * Workers APIへのfetchラッパー
 * Authorizationヘッダーを自動付与し、401時はトークンリフレッシュを試みる
 *
 * @param path - APIパス（例: "/users"）
 * @param options - fetchオプション
 * @returns レスポンスデータ
 * @throws SessionExpiredError - セッションが期限切れでリフレッシュにも失敗した場合
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const existingHeaders = (options.headers as Record<string, string>) ?? {};
  const headers = buildHeaders(token, existingHeaders);

  const response = await fetchWithTimeout(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (response.status !== 401) {
    return (await response.json()) as T;
  }

  const newToken = await refreshAccessToken();

  const retryHeaders = buildHeaders(newToken, existingHeaders);
  const retryResponse = await fetchWithTimeout(`${getBaseUrl()}${path}`, {
    ...options,
    headers: retryHeaders,
  });

  if (retryResponse.status === 401) {
    await clearAuthTokens();
    throw new SessionExpiredError();
  }

  return (await retryResponse.json()) as T;
}
