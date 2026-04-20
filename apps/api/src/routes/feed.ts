import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { Hono } from "hono";

import type { Database } from "../db";
import { articles, follows } from "../db/schema";
import { toRecordArray } from "../lib/db-cast";

type Variables = { Variables: { user?: Record<string, unknown> } };

const AUTH_ERROR_CODE = "AUTH_REQUIRED";
const HTTP_UNAUTHORIZED = 401;
const DEFAULT_LIMIT = 20;

/**
 * フィードルート
 *
 * フォローしているユーザーの公開記事を新しい順に返す。
 * `GET /feed` で自分のフィードを取得する。
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
    const cursor = c.req.query("cursor");
    const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "", 10) || DEFAULT_LIMIT, 50);

    // 自分がフォローしているユーザーの ID 一覧
    const followingRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userId));

    const followingIds = followingRows.map((r) => r.followingId as string);
    if (followingIds.length === 0) {
      return c.json({ success: true, data: [], meta: { nextCursor: null, hasNext: false } });
    }

    const conditions = [inArray(articles.userId, followingIds), eq(articles.isPublic, true)];
    if (cursor) {
      conditions.push(lt(articles.id, cursor));
    }

    const rows = await db
      .select()
      .from(articles)
      .where(and(...conditions))
      .orderBy(desc(articles.createdAt))
      .limit(limit + 1);

    const hasNext = rows.length > limit;
    const data = toRecordArray(hasNext ? rows.slice(0, limit) : rows);
    const nextCursor = hasNext ? (rows[limit - 1]?.id as string | null) : null;

    return c.json({ success: true, data, meta: { nextCursor, hasNext } });
  });

  return route;
}
