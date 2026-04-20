import type { Language } from "@/stores/settings-store";

/**
 * エラーコードから日本語メッセージへのマッピング
 */
const ERROR_MESSAGES_JA: Record<string, string> = {
  AUTH_REQUIRED: "ログインが必要です。",
  AUTH_INVALID: "認証情報が正しくありません。",
  AUTH_EXPIRED: "セッションの有効期限が切れました。再度ログインしてください。",
  FORBIDDEN: "この操作を実行する権限がありません。",
  NOT_FOUND: "リソースが見つかりません。",
  VALIDATION_FAILED: "入力内容を確認してください。",
  INVALID_REQUEST: "リクエストが正しくありません。",
  DUPLICATE: "すでに登録されています。",
  CONFLICT: "競合が発生しました。",
  INTERNAL_ERROR: "サーバーエラーが発生しました。",
  SERVICE_UNAVAILABLE: "サービスが一時的に利用できません。",
  RATE_LIMIT_EXCEEDED: "リクエストが多すぎます。しばらく待ってから再度お試しください。",
};

/**
 * エラーコードから英語メッセージへのマッピング
 */
const ERROR_MESSAGES_EN: Record<string, string> = {
  AUTH_REQUIRED: "Login required.",
  AUTH_INVALID: "Invalid credentials.",
  AUTH_EXPIRED: "Session expired. Please log in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "Resource not found.",
  VALIDATION_FAILED: "Please check your input.",
  INVALID_REQUEST: "Invalid request.",
  DUPLICATE: "Already registered.",
  CONFLICT: "A conflict occurred.",
  INTERNAL_ERROR: "A server error occurred.",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable.",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later.",
};

/**
 * エラーコードから簡体中文メッセージへのマッピング
 */
const ERROR_MESSAGES_ZH_CN: Record<string, string> = {
  AUTH_REQUIRED: "需要登录。",
  AUTH_INVALID: "认证信息不正确。",
  AUTH_EXPIRED: "会话已过期，请重新登录。",
  FORBIDDEN: "您没有执行此操作的权限。",
  NOT_FOUND: "未找到资源。",
  VALIDATION_FAILED: "请检查您的输入。",
  INVALID_REQUEST: "请求不正确。",
  DUPLICATE: "已经注册。",
  CONFLICT: "发生了冲突。",
  INTERNAL_ERROR: "服务器发生错误。",
  SERVICE_UNAVAILABLE: "服务暂时不可用。",
  RATE_LIMIT_EXCEEDED: "请求过多，请稍后再试。",
};

/**
 * エラーコードから繁體中文メッセージへのマッピング
 */
const ERROR_MESSAGES_ZH_TW: Record<string, string> = {
  AUTH_REQUIRED: "需要登入。",
  AUTH_INVALID: "驗證資訊不正確。",
  AUTH_EXPIRED: "工作階段已過期，請重新登入。",
  FORBIDDEN: "您沒有執行此操作的權限。",
  NOT_FOUND: "找不到資源。",
  VALIDATION_FAILED: "請確認您的輸入。",
  INVALID_REQUEST: "請求不正確。",
  DUPLICATE: "已經註冊。",
  CONFLICT: "發生了衝突。",
  INTERNAL_ERROR: "伺服器發生錯誤。",
  SERVICE_UNAVAILABLE: "服務暫時不可用。",
  RATE_LIMIT_EXCEEDED: "請求過多，請稍後再試。",
};

/**
 * エラーコードから韓国語メッセージへのマッピング
 */
const ERROR_MESSAGES_KO: Record<string, string> = {
  AUTH_REQUIRED: "로그인이 필요합니다.",
  AUTH_INVALID: "인증 정보가 올바르지 않습니다.",
  AUTH_EXPIRED: "세션이 만료되었습니다. 다시 로그인해 주세요.",
  FORBIDDEN: "이 작업을 수행할 권한이 없습니다.",
  NOT_FOUND: "리소스를 찾을 수 없습니다.",
  VALIDATION_FAILED: "입력 내용을 확인해 주세요.",
  INVALID_REQUEST: "요청이 올바르지 않습니다.",
  DUPLICATE: "이미 등록되어 있습니다.",
  CONFLICT: "충돌이 발생했습니다.",
  INTERNAL_ERROR: "서버 오류가 발생했습니다.",
  SERVICE_UNAVAILABLE: "서비스를 일시적으로 이용할 수 없습니다.",
  RATE_LIMIT_EXCEEDED: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
};

/** 各言語のフォールバックメッセージ */
const FALLBACK_MESSAGES: Record<Language, string> = {
  ja: "予期しないエラーが発生しました。",
  en: "An unexpected error occurred.",
  "zh-CN": "发生了意外错误。",
  "zh-TW": "發生了意外錯誤。",
  ko: "예기치 않은 오류가 발생했습니다.",
};

/** 各言語のエラーメッセージ辞書 */
const ERROR_MESSAGE_DICT: Record<Language, Record<string, string>> = {
  ja: ERROR_MESSAGES_JA,
  en: ERROR_MESSAGES_EN,
  "zh-CN": ERROR_MESSAGES_ZH_CN,
  "zh-TW": ERROR_MESSAGES_ZH_TW,
  ko: ERROR_MESSAGES_KO,
};

/**
 * APIエラーコードと言語設定から表示用メッセージを返す
 *
 * @param errorCode - APIレスポンスのエラーコード
 * @param language - 表示言語（settings-storeのLanguage型）
 * @returns ユーザーに表示するエラーメッセージ
 */
export function getErrorMessage(errorCode: string, language: Language): string {
  const dict = ERROR_MESSAGE_DICT[language];
  const message = dict?.[errorCode];
  if (message) {
    return message;
  }

  const enMessage = ERROR_MESSAGES_EN[errorCode];
  if (enMessage) {
    return enMessage;
  }

  return FALLBACK_MESSAGES[language] ?? FALLBACK_MESSAGES.en;
}
