import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { Database } from "../db";
import { articles, follows } from "../db/schema";
import { toRecordArray } from "../lib/db-cast";

type Variables = { Variables: { user?: Record<string, unknown> } };

const AUTH_ERROR_CODE = "AUTH_REQUIRED";
const HTTP_UNAUTHORIZED = 401;

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/**
 * 複合カーソル型
 */
type CompositeCursor = {
  createdAt: string;
  id: string;
};

/**
 * 複合カーソルを Base64URL エンコードして文字列化する
 *
 * @param createdAt - 記事の作成日時（ISO文字列）
 * @param id - 記事のID
 * @returns Base64URL エンコードされたカーソル文字列
 */
function encodeCursor(createdAt: string, id: string): string {
  const cursor: CompositeCursor = { createdAt, id };
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

/**
 * Base64URL エンコードされたカーソル文字列をデコードする
 *
 * @param cursor - Base64URL エンコードされたカーソル文字列
 * @returns デコードされた複合カーソル。無効な場合は null
 */
function decodeCursor(cursor: string): CompositeCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString()) as unknown;
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof (decoded as Record<string, unknown>).createdAt !== "string" ||
      typeof (decoded as Record<string, unknown>).id !== "string"
    ) {
      return null;
    }
    return decoded as CompositeCursor;
  } catch {
    return null;
  }
}

/**
 * フィードルート
 *
 * フォローしているユーザーの公開記事を新しい順に返す。
 * `GET /feed` で自分のフィードを取得する。
 *
 * カーソルページネーションは複合 (createdAt DESC, id DESC) で行い、
 * 同一 createdAt を持つレコードでの欠落・重複を防ぐ。
 */
export function createFeedRoute(options: { db: Database }): Hono<Variables> {
  const { db } = options;
  const route = new Hono<Variables>();

  route.get("/feed", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: { code: AUTH_ERROR_CODE, message: "ログインが必要です" },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const userId = user.id as string;
    const cursorParam = c.req.query("cursor");
    const limitRaw = Number.parseInt(c.req.query("limit") ?? "", 10);
    const limit = Math.max(
      MIN_LIMIT,
      Math.min(MAX_LIMIT, Number.isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw),
    );

    // 自分がフォローしているユーザーの ID 一覧
    const followingRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userId));

    const followingIds = followingRows.map((r) => r.followingId as string);
    if (followingIds.length === 0) {
      return c.json({ success: true, data: [], meta: { nextCursor: null, hasNext: false } });
    }

    const baseConditions = [inArray(articles.userId, followingIds), eq(articles.isPublic, true)];

    const cursor = cursorParam ? decodeCursor(cursorParam) : null;
    if (cursor !== null) {
      // 複合カーソル: (created_at, id) < (cursor.createdAt, cursor.id)
      // SQLite での行値比較: (created_at < ?) OR (created_at = ? AND id < ?)
      baseConditions.push(
        or(
          lt(articles.createdAt, new Date(cursor.createdAt)),
          and(
            sql`${articles.createdAt} = ${new Date(cursor.createdAt)}`,
            lt(articles.id, cursor.id),
          ),
        ) as ReturnType<typeof and>,
      );
    }

    const rows = await db
      .select()
      .from(articles)
      .where(and(...baseConditions))
      .orderBy(desc(articles.createdAt), desc(articles.id))
      .limit(limit + 1);

    const hasNext = rows.length > limit;
    const sliced = hasNext ? rows.slice(0, limit) : rows;
    const data = toRecordArray(sliced);
    const lastRow = sliced[sliced.length - 1];
    const nextCursor =
      hasNext && lastRow
        ? encodeCursor(
            lastRow.createdAt instanceof Date
              ? lastRow.createdAt.toISOString()
              : String(lastRow.createdAt),
            lastRow.id as string,
          )
        : null;

    return c.json({ success: true, data, meta: { nextCursor, hasNext } });
  });

  return route;
}
