/**
 * Workers AI レスポンスの型ガード（summary / translator 共通）
 *
 * @param value - 検証対象の値
 * @returns response フィールドが string かどうか
 */
export function isWorkersAiTextResponse(value: unknown): value is { response: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v.response === "string";
}
