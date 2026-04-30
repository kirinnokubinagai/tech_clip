import TurndownService from "turndown";

import { safeFetch } from "../../lib/safe-fetch";
import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, htmlFragmentToMarkdown, TECHCLIP_USER_AGENT } from "./_shared";

/** Zenn Books URLのパスパターン */
const ZENN_BOOK_PATH_REGEX = /^\/[^/]+\/books\/([^/]+)\/?$/;

/** Zenn APIのベースURL */
const ZENN_API_BASE_URL = "https://zenn.dev/api";

/** 記事ソース識別子 */
const SOURCE_IDENTIFIER = "zenn.dev";

/**
 * Zenn Books APIのブック情報レスポンス型
 */
type ZennBookResponse = {
  book: {
    slug: string;
    title: string;
    user: {
      username: string;
      name: string;
    };
    published_at: string | null;
    image_url: string | null;
  };
};

/**
 * Zenn Books APIのチャプター情報型
 */
type ZennChapter = {
  slug: string;
  title: string;
  position: number;
  body_html: string;
};

/**
 * Zenn Books APIのチャプター一覧レスポンス型
 */
type ZennChaptersResponse = {
  chapters: ZennChapter[];
};

/**
 * URLからZenn Booksのslugを抽出する
 *
 * @param url - Zenn BooksのURL
 * @returns ブックのslug
 * @throws Error - Zenn BooksのURLではない場合
 */
function extractBookSlug(url: string): string {
  const parsed = new URL(url);

  if (parsed.hostname !== SOURCE_IDENTIFIER) {
    throw new Error("Zenn BooksのURLではありません");
  }

  const match = parsed.pathname.match(ZENN_BOOK_PATH_REGEX);
  if (!match) {
    throw new Error("Zenn BooksのURLではありません");
  }

  return match[1];
}

/**
 * Zenn BooksのURLからブック情報とチャプターを取得してParsedArticleを返す
 *
 * @param url - Zenn BooksのURL（例: https://zenn.dev/user/books/slug）
 * @returns パースされた記事情報（全チャプターを結合したMarkdown）
 * @throws Error - URLの解析、API取得、またはパースに失敗した場合
 */
export async function parseZennBook(url: string): Promise<ParsedArticle> {
  const slug = extractBookSlug(url);
  const headers = { "User-Agent": TECHCLIP_USER_AGENT };

  const bookResponse = await safeFetch(`${ZENN_API_BASE_URL}/books/${slug}`, { headers });
  if (!bookResponse.ok) {
    throw new Error(`ブック情報の取得に失敗しました（ステータス: ${bookResponse.status}）`);
  }
  const bookData: ZennBookResponse = await bookResponse.json();

  const chaptersResponse = await safeFetch(`${ZENN_API_BASE_URL}/books/${slug}/chapters`, {
    headers,
  });
  if (!chaptersResponse.ok) {
    throw new Error(`チャプター一覧の取得に失敗しました（ステータス: ${chaptersResponse.status}）`);
  }
  const chaptersData: ZennChaptersResponse = await chaptersResponse.json();

  if (chaptersData.chapters.length === 0) {
    throw new Error("チャプターが見つかりません");
  }

  const sortedChapters = [...chaptersData.chapters].sort((a, b) => a.position - b.position);

  const combinedHtml = sortedChapters.map((chapter) => chapter.body_html).join("\n");

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const markdown = htmlFragmentToMarkdown(combinedHtml, turndown);

  const plainText = markdown.replace(/[#*`[\]()_~>-]/g, "");

  return {
    title: bookData.book.title,
    author: bookData.book.user.name,
    content: markdown,
    excerpt: null,
    thumbnailUrl: bookData.book.image_url,
    readingTimeMinutes: calculateReadingTime(plainText),
    publishedAt: bookData.book.published_at,
    source: SOURCE_IDENTIFIER,
  };
}
