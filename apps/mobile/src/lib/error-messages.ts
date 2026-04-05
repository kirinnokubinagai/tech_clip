import type { Language } from "@/stores/settings-store";

/**
 * エラーコードから日本語メッセージへのマッピング
 */
const ERROR_MESSAGES_JA: Record<string, string> = {
  AUTH_REQUIRED: "ログインが必要です",
  AUTH_INVALID: "認証情報が正しくありません",
  AUTH_EXPIRED: "セッションの有効期限が切れました。再度ログインしてください",
  FORBIDDEN: "この操作を実行する権限がありません",
  NOT_FOUND: "リソースが見つかりません",
  VALIDATION_FAILED: "入力内容を確認してください",
  INVALID_REQUEST: "リクエストが正しくありません",
  DUPLICATE: "すでに登録されています",
  CONFLICT: "競合が発生しました",
  INTERNAL_ERROR: "サーバーエラーが発生しました",
  SERVICE_UNAVAILABLE: "サービスが一時的に利用できません",
  RATE_LIMIT_EXCEEDED: "リクエストが多すぎます。しばらく待ってから再度お試しください",
};

/**
 * エラーコードから英語メッセージへのマッピング
 */
const ERROR_MESSAGES_EN: Record<string, string> = {
  AUTH_REQUIRED: "Login required",
  AUTH_INVALID: "Invalid credentials",
  AUTH_EXPIRED: "Session expired. Please log in again",
  FORBIDDEN: "You do not have permission to perform this action",
  NOT_FOUND: "Resource not found",
  VALIDATION_FAILED: "Please check your input",
  INVALID_REQUEST: "Invalid request",
  DUPLICATE: "Already registered",
  CONFLICT: "A conflict occurred",
  INTERNAL_ERROR: "A server error occurred",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later",
};

/** 日本語フォールバックメッセージ */
const FALLBACK_MESSAGE_JA = "予期しないエラーが発生しました";

/** 英語フォールバックメッセージ */
const FALLBACK_MESSAGE_EN = "An unexpected error occurred";

/**
 * APIエラーコードと言語設定から表示用メッセージを返す
 *
 * @param errorCode - APIレスポンスのエラーコード
 * @param language - 表示言語（settings-storeのLanguage型）
 * @returns ユーザーに表示するエラーメッセージ
 */
export function getErrorMessage(errorCode: string, language: Language): string {
  if (language === "en") {
    return ERROR_MESSAGES_EN[errorCode] ?? FALLBACK_MESSAGE_EN;
  }
  return ERROR_MESSAGES_JA[errorCode] ?? FALLBACK_MESSAGE_JA;
}
