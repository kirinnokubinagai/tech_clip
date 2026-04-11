/**
 * AIモデル設定定数
 *
 * Gemmaモデルのデフォルト識別子を集約する。
 * 環境変数 GEMMA_MODEL_NAME で上書き可能。
 */

/**
 * データベース保存用の短縮タグ
 * summaries/translations.model カラムに保存する値。
 */
export const DEFAULT_GEMMA_MODEL_TAG = "gemma-4-26b-a4b";

/**
 * Cloudflare Workers AI で使用する Gemma モデルの完全識別子
 */
export const WORKERS_AI_GEMMA_MODEL_ID = "@cf/google/gemma-4-26b-a4b-it";

/**
 * 環境変数からGemmaモデルタグを解決する
 *
 * @param envValue - 環境変数 GEMMA_MODEL_NAME の値
 * @returns 解決されたモデルタグ。未設定の場合はデフォルトタグ
 */
export function resolveGemmaModelTag(envValue: string | undefined): string {
  if (!envValue) {
    return DEFAULT_GEMMA_MODEL_TAG;
  }
  return envValue;
}
