import TurndownService from "turndown";

import type { ParsedArticle } from "../../types/article";

/** Zenn Books URLのパスパターン */
const ZENN_BOOK_PATH_REGEX = /^\/[^/]+\/books\/([^/]+)\/?$/;

/** Zenn APIのベースURL */
const ZENN_API_BASE_URL = "https://zenn.dev/api";

/** fetch時のUser-Agent */
const USER_AGENT = "Mozilla/5.0 (compatible; TechClipBot/1.0; +https://techclip.app)";

/** 読了速度（文字/分） */
const READING_SPEED_CHARS_PER_MIN = 500;

/** 最小読了時間（分） */
const MIN_READING_TIME_MINUTES = 1;

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
 * 文字数から読了時間を計算する
 *
 * @param text - 本文テキスト
 * @returns 推定読了時間（分、最小1分）
 */
function calculateReadingTime(text: string): number {
  const charCount = text.length;
  const minutes = Math.ceil(charCount / READING_SPEED_CHARS_PER_MIN);
  return Math.max(minutes, MIN_READING_TIME_MINUTES);
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
  const headers = { "User-Agent": USER_AGENT };

  const bookResponse = await fetch(`${ZENN_API_BASE_URL}/books/${slug}`, { headers });
  if (!bookResponse.ok) {
    throw new Error(`ブック情報の取得に失敗しました（ステータス: ${bookResponse.status}）`);
  }
  const bookData: ZennBookResponse = await bookResponse.json();

  const chaptersResponse = await fetch(`${ZENN_API_BASE_URL}/books/${slug}/chapters`, { headers });
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
  const markdown = turndown.turndown(combinedHtml);

  const plainText = markdown.replace(/[#*`\[\]()_~>-]/g, "");

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
