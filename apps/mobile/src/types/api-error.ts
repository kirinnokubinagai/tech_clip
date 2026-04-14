/**
 * APIエラーレスポンスの共通ペイロード型
 *
 * `{ success: false, error: { code, message, details? } }` の形式
 */
export type ApiErrorPayload = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
};

/**
 * 値が ApiErrorPayload かどうかを判定する
 *
 * @param value - 判定対象
 * @returns ApiErrorPayload なら true
 */
export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const maybe = value as { success?: unknown; error?: unknown };
  return maybe.success === false && typeof maybe.error === "object" && maybe.error !== null;
}
