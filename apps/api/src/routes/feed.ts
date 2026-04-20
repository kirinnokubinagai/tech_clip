import { and, desc, eq, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { Database } from "../db";
import { articles, follows } from "../db/schema";
import { toRecordArray } from "../lib/db-cast";
import { decodeCursor, encodeCursor } from "../services/parsers/_shared";

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
      c.header("Cache-Control", "private, max-age=0, must-revalidate");
      return c.json({ success: true, data: [], meta: { nextCursor: null, hasNext: false } });
    }

    const baseConditions = [inArray(articles.userId, followingIds), eq(articles.isPublic, true)];

    let cursor = null;
    if (cursorParam) {
      try {
        cursor = decodeCursor(cursorParam);
      } catch {
        cursor = null;
      }
    }
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
        ) as SQL,
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

    c.header("Cache-Control", "private, max-age=0, must-revalidate");
    return c.json({ success: true, data, meta: { nextCursor, hasNext } });
  });

  return route;
}
