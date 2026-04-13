/**
 * エラーコードとエラーメッセージ定数
 * 全ルートファイルで共通利用する
 */

/** 未認証エラーコード */
export const AUTH_ERROR_CODE = "AUTH_REQUIRED";

/** 未認証エラーメッセージ */
export const AUTH_ERROR_MESSAGE = "ログインが必要です";

/** 認証情報不正エラーコード */
export const AUTH_INVALID_CODE = "AUTH_INVALID";

/** 認証情報不正エラーメッセージ */
export const AUTH_INVALID_MESSAGE = "認証情報が正しくありません";

/** セッション期限切れエラーコード */
export const AUTH_EXPIRED_CODE = "AUTH_EXPIRED";

/** セッション期限切れエラーメッセージ */
export const AUTH_EXPIRED_MESSAGE = "セッションの有効期限が切れました。再度ログインしてください";

/** 権限エラーコード */
export const FORBIDDEN_ERROR_CODE = "FORBIDDEN";

/** 権限エラーメッセージ */
export const FORBIDDEN_ERROR_MESSAGE = "この操作を実行する権限がありません";

/** リソース未発見エラーコード */
export const NOT_FOUND_ERROR_CODE = "NOT_FOUND";

/** リソース未発見エラーメッセージ */
export const NOT_FOUND_ERROR_MESSAGE = "リソースが見つかりません";

/** リクエスト不正エラーコード */
export const INVALID_REQUEST_ERROR_CODE = "INVALID_REQUEST";

/** バリデーションエラーコード */
export const VALIDATION_ERROR_CODE = "VALIDATION_FAILED";

/** バリデーションエラーメッセージ */
export const VALIDATION_ERROR_MESSAGE = "入力内容を確認してください";

/** 重複エラーコード */
export const DUPLICATE_ERROR_CODE = "DUPLICATE";

/** 重複エラーメッセージ */
export const DUPLICATE_ERROR_MESSAGE = "すでに登録されています";

/** 競合エラーコード */
export const CONFLICT_ERROR_CODE = "CONFLICT";

/** 競合エラーメッセージ */
export const CONFLICT_ERROR_MESSAGE = "競合が発生しました";

/** 内部エラーコード */
export const INTERNAL_ERROR_CODE = "INTERNAL_ERROR";

/** 内部エラーメッセージ */
export const INTERNAL_ERROR_MESSAGE = "サーバーエラーが発生しました";
