/**
 * パーサー共通ユーティリティ
 * 複数のパーサーで使用する定数・関数を集約する
 */

import { parseHTML } from "linkedom";
import type TurndownService from "turndown";

/** TechClipボットのUser-Agent文字列 */
export const TECHCLIP_USER_AGENT =
  "Mozilla/5.0 (compatible; TechClipBot/1.0; +https://techclip.app)";

/** 読了速度（文字/分）*/
export const READING_SPEED_CHARS_PER_MIN = 500;

/** 最小読了時間（分） */
export const MIN_READING_TIME_MINUTES = 1;

/** 抜粋の最大文字数 */
export const EXCERPT_MAX_LENGTH = 200;

/**
 * テキストの読了時間を計算する
 *
 * @param text - 対象テキスト
 * @returns 読了時間（分）。最小値は MIN_READING_TIME_MINUTES
 */
export function calculateReadingTime(text: string): number {
  const charCount = text.length;
  const minutes = Math.ceil(charCount / READING_SPEED_CHARS_PER_MIN);
  return Math.max(minutes, MIN_READING_TIME_MINUTES);
}

/**
 * テキストから抜粋を生成する
 *
 * @param text - 対象テキスト
 * @returns EXCERPT_MAX_LENGTH 以内に切り詰めた抜粋文字列
 */
export function createExcerpt(text: string): string {
  if (text.length <= EXCERPT_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, EXCERPT_MAX_LENGTH)}...`;
}

/**
 * HTMLフラグメントをMarkdownに変換する
 *
 * Cloudflare Workers には DOMParser がないため turndown の内部 HTML parser
 * を使用できない。linkedom でフラグメントを正しい HTML 文書に包んでから
 * body ノードを turndown に渡すことで、Workers 環境でも変換できるようにする。
 *
 * @param html - HTMLフラグメント（body 内に入れる前提）
 * @param turndown - TurndownService インスタンス
 * @returns Markdown文字列
 */
export function htmlFragmentToMarkdown(html: string, turndown: TurndownService): string {
  const wrapped = `<!DOCTYPE html><html><head></head><body>${html}</body></html>`;
  const doc = parseHTML(wrapped);
  // linkedom の Element 型を turndown の Node 型に渡すには型アサーションが必要。
  // Cloudflare Workers には lib.dom の Node 型がないため、
  // unknown 経由で turndown が期待する Node 型（構造的互換）にキャストする
  const bodyAsTurndownInput = doc.document.body as unknown as Parameters<
    TurndownService["turndown"]
  >[0];
  return turndown.turndown(bodyAsTurndownInput);
}

/**
 * 複合カーソル型
 */
export type CompositeCursor = {
  createdAt: string;
  id: string;
};

/**
 * 複合カーソルを base64url エンコードして文字列化する
 *
 * `+`, `/`, `=` を URL 非安全文字として変換し、URL クエリパラメータに
 * 混入しても壊れないようにする。
 *
 * @param createdAt - 記事の作成日時（ISO文字列）
 * @param id - 記事のID
 * @returns base64url エンコードされたカーソル文字列
 */
export function encodeCursor(createdAt: string, id: string): string {
  const cursor: CompositeCursor = { createdAt, id };
  return btoa(JSON.stringify(cursor)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * base64url エンコードされたカーソル文字列をデコードする
 *
 * @param cursor - base64url エンコードされたカーソル文字列
 * @returns デコードされた複合カーソル
 * @throws SyntaxError - JSON パースに失敗した場合
 * @throws Error - カーソルの構造が不正な場合
 */
export function decodeCursor(cursor: string): CompositeCursor {
  const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const decoded = JSON.parse(atob(padded)) as unknown;
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof (decoded as Record<string, unknown>).createdAt !== "string" ||
    typeof (decoded as Record<string, unknown>).id !== "string"
  ) {
    throw new Error("カーソルの構造が不正です");
  }
  return decoded as CompositeCursor;
}

/** Cloudflare Workers CPU バジェット超過防止のための HTML 最大バイト数（1.5 MB） */
export const MAX_HTML_BYTES = 1_500_000;

/**
 * HTML テキストのサイズが上限を超えていないか検証する
 *
 * Cloudflare Workers は CPU 時間の制限があるため、Readability/TurndownService の
 * 処理対象 HTML のサイズに上限を設けてタイムアウトを防ぐ。
 *
 * @param html - 検証対象の HTML 文字列
 * @throws Error - MAX_HTML_BYTES を超える場合
 */
export function assertHtmlSize(html: string): void {
  if (html.length > MAX_HTML_BYTES) {
    throw new Error(
      `HTML サイズが上限を超えています（${html.length} バイト > ${MAX_HTML_BYTES} バイト）`,
    );
  }
}
