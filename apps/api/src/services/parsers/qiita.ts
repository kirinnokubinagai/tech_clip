import TurndownService from "turndown";

import type { ParsedArticle } from "../../types/article";

/** Qiita記事URLの正規表現パターン */
const QIITA_ITEM_URL_PATTERN = /^https:\/\/qiita\.com\/[^/]+\/items\/([a-zA-Z0-9]+)\/?/;

/** Qiita API v2 ベースURL */
const QIITA_API_BASE_URL = "https://qiita.com/api/v2";

/** fetch時のUser-Agent */
const USER_AGENT = "Mozilla/5.0 (compatible; TechClipBot/1.0; +https://techclip.app)";

/** 読了速度（文字/分） */
const READING_SPEED_CHARS_PER_MIN = 500;

/** 最小読了時間（分） */
const MIN_READING_TIME_MINUTES = 1;

/**
 * Qiita API v2 レスポンスの型定義
 */
type QiitaApiResponse = {
  id: string;
  title: string;
  body: string | null;
  rendered_body: string;
  user: {
    id: string;
    name: string;
  };
  created_at: string;
  tags: { name: string }[];
};

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
 * QiitaのURLからitem_idを抽出する
 *
 * @param url - Qiita記事のURL
 * @returns item_id
 * @throws Error - URLがQiita形式でない場合
 */
function extractItemId(url: string): string {
  const parsed = new URL(url);

  if (parsed.hostname !== "qiita.com") {
    throw new Error("QiitaのURLではありません");
  }

  const match = QIITA_ITEM_URL_PATTERN.exec(`${parsed.origin}${parsed.pathname}`);

  if (!match?.[1]) {
    throw new Error("QiitaのURLからitem_idを抽出できません");
  }

  return match[1];
}

/**
 * Qiita記事URLからQiita API v2でコンテンツを取得し、ParsedArticleに変換する
 *
 * @param url - Qiita記事のURL（例: https://qiita.com/user/items/xxxxx）
 * @returns パースされた記事情報
 * @throws Error - URLが不正、またはAPI取得に失敗した場合
 */
export async function parseQiita(url: string): Promise<ParsedArticle> {
  const itemId = extractItemId(url);

  const response = await fetch(`${QIITA_API_BASE_URL}/items/${itemId}`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Qiita APIからのデータ取得に失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as QiitaApiResponse;

  let content: string;
  if (data.body) {
    content = data.body;
  } else {
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });
    content = turndown.turndown(data.rendered_body);
  }

  const plainText = content.replace(/[#*`[\]()>\-_~|]/g, "").replace(/\n+/g, " ");

  return {
    title: data.title,
    author: data.user.id,
    content,
    excerpt: null,
    thumbnailUrl: null,
    readingTimeMinutes: calculateReadingTime(plainText),
    publishedAt: data.created_at,
    source: "qiita.com",
  };
}
