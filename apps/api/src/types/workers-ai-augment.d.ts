/**
 * @cloudflare/workers-types の型拡張
 *
 * 公式リリースの types パッケージに未収録のモデルを追加する。
 * 各モデルの存在は Cloudflare Workers AI ドキュメントで確認済み。
 *
 * @see https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AiModels {
  /** Gemma 4 26B A4B Instruct - 256k context, function calling, vision 対応 */
  "@cf/google/gemma-4-26b-a4b-it": BaseAiTextGeneration;
}
