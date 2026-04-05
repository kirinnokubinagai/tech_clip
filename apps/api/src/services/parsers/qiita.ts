import TurndownService from "turndown";

import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, TECHCLIP_USER_AGENT } from "./_shared";

/** Qiita記事URLの正規表現パターン */
const QIITA_ITEM_URL_PATTERN = /^https:\/\/qiita\.com\/[^/]+\/items\/([a-zA-Z0-9]+)\/?/;

/** Qiita API v2 ベースURL */
const QIITA_API_BASE_URL = "https://qiita.com/api/v2";

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
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
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
