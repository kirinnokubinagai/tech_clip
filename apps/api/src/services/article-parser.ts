import type { ArticleSource } from "@tech-clip/types";

import { detectSource } from "./source-detector";

/**
 * パーサーが返す記事コンテンツ（sourceを除く）
 *
 * 個別パーサー・汎用パーサーはこの型を返す。
 * sourceフィールドはarticle-parserが付与する。
 */
export type ParsedArticleContent = {
  title: string;
  content: string | null;
  excerpt: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  readingTimeMinutes: number | null;
};

/**
 * パース済み記事（source付き）
 */
export type ParsedArticle = ParsedArticleContent & {
  source: ArticleSource;
};

/**
 * ArticleSourceに対応するパーサー関数を動的importして返す
 *
 * @param source - 判定されたArticleSource
 * @param url - パース対象URL
 * @returns パース済み記事コンテンツ
 */
async function dispatchParser(source: ArticleSource, url: string): Promise<ParsedArticleContent> {
  if (source === "zenn") {
    if (url.includes("/books/")) {
      const { parseZennBook } = await import("./parsers/zenn-book");
      return parseZennBook(url);
    }
    const { parseZenn } = await import("./parsers/zenn");
    return parseZenn(url);
  }

  if (source === "qiita") {
    const { parseQiita } = await import("./parsers/qiita");
    return parseQiita(url);
  }

  if (source === "note") {
    const { parseNote } = await import("./parsers/note");
    return parseNote(url);
  }

  if (source === "hatena") {
    const { parseHatena } = await import("./parsers/hatena");
    return parseHatena(url);
  }

  if (source === "devto") {
    const { parseDevto } = await import("./parsers/devto");
    return parseDevto(url);
  }

  if (source === "medium") {
    const { parseMedium } = await import("./parsers/medium");
    return parseMedium(url);
  }

  if (source === "github") {
    const { parseGitHub } = await import("./parsers/github");
    return parseGitHub(url);
  }

  if (source === "hackernews") {
    const { parseHackerNews } = await import("./parsers/hackernews");
    return parseHackerNews(url);
  }

  if (source === "hashnode") {
    const { parseHashnode } = await import("./parsers/hashnode");
    return parseHashnode(url);
  }

  if (source === "stackoverflow") {
    const { parseStackOverflow } = await import("./parsers/stackoverflow");
    return parseStackOverflow(url);
  }

  if (source === "reddit") {
    const { parseReddit } = await import("./parsers/reddit");
    return parseReddit(url);
  }

  if (source === "freecodecamp") {
    const { parseFreecodecamp } = await import("./parsers/freecodecamp");
    return parseFreecodecamp(url);
  }

  if (source === "logrocket") {
    const { parseLogrocket } = await import("./parsers/logrocket");
    return parseLogrocket(url);
  }

  if (source === "css-tricks") {
    const { parseCssTricks } = await import("./parsers/css-tricks");
    return parseCssTricks(url);
  }

  if (source === "smashing") {
    const { parseSmashing } = await import("./parsers/smashing");
    return parseSmashing(url);
  }

  if (source === "speakerdeck") {
    const { parseSpeakerdeck } = await import("./parsers/speakerdeck");
    return parseSpeakerdeck(url);
  }

  const { parseGeneric } = await import("./parsers/generic");
  return parseGeneric(url);
}

/**
 * URLから記事をパースする
 *
 * sourceDetectorでソースを判定し、対応するパーサーを呼び出す。
 * 個別パーサーがエラーになった場合は汎用パーサーにフォールバックする。
 *
 * @param url - パース対象のURL文字列
 * @returns パース済み記事データ
 */
export async function parseArticle(url: string): Promise<ParsedArticle> {
  const source = detectSource(url);

  if (source === "other") {
    const { parseGeneric } = await import("./parsers/generic");
    const result = await parseGeneric(url);
    return { ...result, source };
  }

  try {
    const result = await dispatchParser(source, url);
    return { ...result, source };
  } catch {
    const { parseGeneric } = await import("./parsers/generic");
    const result = await parseGeneric(url);
    return { ...result, source };
  }
}
