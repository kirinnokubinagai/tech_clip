import * as SecureStore from "expo-secure-store";

/** 認証トークンのストレージキー */
const TOKEN_KEY = "auth_token";

/** リフレッシュトークンのストレージキー */
const REFRESH_TOKEN_KEY = "refresh_token";

/**
 * 認証トークンを取得する
 *
 * @returns 認証トークン。存在しない場合はnull
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * 認証トークンを保存する
 *
 * @param token - 保存する認証トークン
 */
export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/**
 * 認証トークンを削除する
 */
export async function removeAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * リフレッシュトークンを取得する
 *
 * @returns リフレッシュトークン。存在しない場合はnull
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * リフレッシュトークンを保存する
 *
 * @param token - 保存するリフレッシュトークン
 */
export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

/**
 * リフレッシュトークンを削除する
 */
export async function removeRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * 認証トークンとリフレッシュトークンをまとめて削除する
 */
export async function clearAuthTokens(): Promise<void> {
  await Promise.all([removeAuthToken(), removeRefreshToken()]);
}

/** OAuth state（CSRF 対策用 nonce）のストレージキー */
const OAUTH_STATE_KEY = "oauth_state_nonce";

/**
 * OAuth state nonce を保存する
 *
 * @param state - ランダム生成した nonce 文字列
 */
export async function setOAuthState(state: string): Promise<void> {
  await SecureStore.setItemAsync(OAUTH_STATE_KEY, state);
}

/**
 * OAuth state nonce を取得する
 *
 * @returns 保存済みの nonce。存在しない場合はnull
 */
export async function getOAuthState(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(OAUTH_STATE_KEY);
  } catch {
    return null;
  }
}

/**
 * OAuth state nonce を削除する
 */
export async function removeOAuthState(): Promise<void> {
  await SecureStore.deleteItemAsync(OAUTH_STATE_KEY);
}
