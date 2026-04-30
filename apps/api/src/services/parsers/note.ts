import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

import { safeFetch } from "../../lib/safe-fetch";
import type { ParsedArticle } from "../../types/article";
import {
  assertHtmlSize,
  calculateReadingTime,
  htmlFragmentToMarkdown,
  TECHCLIP_USER_AGENT,
} from "./_shared";

/** note.comのホスト名 */
const NOTE_HOSTNAME = "note.com";

/** note.com記事URLのパスパターン（/ユーザー名/n/記事ID） */
const NOTE_ARTICLE_PATH_PATTERN = /^\/[^/]+\/n\/[^/]+\/?$/;

/**
 * linkedomのドキュメント型
 *
 * Cloudflare Workers環境にはDOM型が存在しないため、
 * linkedomが返すドキュメントオブジェクトの必要なインターフェースのみ定義する
 */
type LinkedomDocument = {
  querySelector: (selector: string) => { getAttribute: (name: string) => string | null } | null;
};

/**
 * note.com記事URLのバリデーションを行う
 *
 * @param url - 検証対象のURL
 * @throws Error - note.comの記事URLでない場合
 */
function validateNoteUrl(url: string): void {
  const parsed = new URL(url);

  if (parsed.hostname !== NOTE_HOSTNAME) {
    throw new Error("note.comのURLではありません");
  }

  const pathname = parsed.pathname;

  if (!NOTE_ARTICLE_PATH_PATTERN.test(pathname)) {
    throw new Error("note.com記事のURLではありません");
  }
}

/**
 * HTMLからOGPメタタグの値を取得する（property属性）
 *
 * @param doc - linkedomのドキュメントオブジェクト
 * @param property - metaタグのproperty属性値
 * @returns メタタグのcontent値。存在しない場合はnull
 */
function getMetaContentByProperty(doc: LinkedomDocument, property: string): string | null {
  const meta = doc.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    return null;
  }
  return meta.getAttribute("content");
}

/**
 * HTMLからmetaタグの値を取得する（name属性）
 *
 * @param doc - linkedomのドキュメントオブジェクト
 * @param name - metaタグのname属性値
 * @returns メタタグのcontent値。存在しない場合はnull
 */
function getMetaContentByName(doc: LinkedomDocument, name: string): string | null {
  const meta = doc.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    return null;
  }
  return meta.getAttribute("content");
}

/**
 * note.comのHTMLから著者名を抽出する
 *
 * article:author → note:creator の順にフォールバックする
 *
 * @param doc - linkedomのドキュメントオブジェクト
 * @returns 著者名。取得できない場合はnull
 */
function extractAuthor(doc: LinkedomDocument): string | null {
  const articleAuthor = getMetaContentByProperty(doc, "article:author");
  if (articleAuthor) {
    return articleAuthor;
  }

  const noteCreator = getMetaContentByName(doc, "note:creator");
  if (noteCreator) {
    return noteCreator;
  }

  return null;
}

/**
 * note.com記事URLからHTML取得 → 本文抽出 → Markdown変換するパーサー
 *
 * note.comはAPIが公開されていないため、HTMLをfetchしてReadabilityで本文を抽出する。
 * OGPメタタグからタイトル・サムネイル・著者・公開日を取得する。
 *
 * @param url - note.com記事のURL（例: https://note.com/user/n/abc123）
 * @returns パースされた記事情報
 * @throws Error - URLが不正、HTML取得失敗、本文抽出失敗の場合
 */
export async function parseNote(url: string): Promise<ParsedArticle> {
  validateNoteUrl(url);

  const response = await safeFetch(url, {
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`HTMLの取得に失敗しました（ステータス: ${response.status}）`);
  }

  const html = await response.text();
  assertHtmlSize(html);
  const { document } = parseHTML(html);
  if (!document.documentElement) {
    throw new Error("HTMLが空または不正です（Cloudflare等のbot対策の可能性）");
  }

  const reader = new Readability(document);
  const article = reader.parse();

  if (!article?.content) {
    throw new Error("記事本文の抽出に失敗しました");
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const markdown = htmlFragmentToMarkdown(article.content, turndown);

  const { document: originalDoc } = parseHTML(html);
  const doc = originalDoc as unknown as LinkedomDocument;

  const ogTitle = getMetaContentByProperty(doc, "og:title");
  const title = ogTitle ?? article.title ?? "";

  const thumbnailUrl = getMetaContentByProperty(doc, "og:image");
  const author = extractAuthor(doc);
  const publishedAt = getMetaContentByProperty(doc, "article:published_time");

  const textContent = article.textContent ?? "";

  return {
    title,
    author,
    content: markdown,
    excerpt: article.excerpt ?? null,
    thumbnailUrl,
    readingTimeMinutes: calculateReadingTime(textContent),
    publishedAt,
    source: NOTE_HOSTNAME,
  };
}
