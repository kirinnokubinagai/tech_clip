/**
 * AIモデル設定定数
 *
 * Gemmaモデルのデフォルト識別子を集約する。
 * 環境変数 GEMMA_MODEL_NAME で上書き可能。
 */

/**
 * HuggingFace準拠のGemmaモデル参照名
 * RunPod側の vLLM ハンドラーに渡すモデル識別子。
 */
export const DEFAULT_GEMMA_MODEL = "gemma-3-12b-it";

/**
 * データベース保存用の短縮タグ
 * summaries/translations.model カラムに保存する値。
 */
export const DEFAULT_GEMMA_MODEL_TAG = "gemma3-12b";

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
