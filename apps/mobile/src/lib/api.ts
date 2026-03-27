import Constants from "expo-constants";

import { getAuthToken } from "./secure-store";

/** API通信のタイムアウト（ミリ秒） */
const REQUEST_TIMEOUT_MS = 15000;

/**
 * APIのベースURLを取得する
 *
 * @returns Workers APIのベースURL
 */
function getBaseUrl(): string {
  const extra = Constants.expoConfig?.extra;
  if (extra && typeof extra === "object" && "apiUrl" in extra) {
    return extra.apiUrl as string;
  }
  return "http://localhost:8787";
}

/** APIのベースURL */
const BASE_URL = getBaseUrl();

/**
 * Workers APIへのfetchラッパー
 * Authorizationヘッダーを自動付与する
 *
 * @param path - APIパス（例: "/users"）
 * @param options - fetchオプション
 * @returns レスポンスデータ
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const data = (await response.json()) as T;
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}
