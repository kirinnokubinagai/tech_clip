import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { Auth } from "../auth";
import type { Database } from "../db";
import { follows, users } from "../db/schema";
import { toRecord, toRecordArray } from "../lib/db-cast";
import { fetchWithAuth } from "../lib/route-helpers";
import type { FollowListQueryParams } from "../routes/follows";
import { createFollowsRoute } from "../routes/follows";
import { createUsersRoute } from "../routes/users";
import type { Bindings } from "../types";

/** 本番環境のアバター公開 URL */
const PRODUCTION_AVATAR_URL = "https://avatars.techclip.io";

/** 複合カーソルの区切り文字 */
const CURSOR_SEPARATOR = "|";

/**
 * 複合カーソル文字列（`createdAt|id` 形式）をパースする
 *
 * @param cursor - 複合カーソル文字列
 * @returns パース結果。不正な形式の場合は null
 */
function parseCursor(cursor: string): { cursorTime: string; cursorId: string } | null {
  const separatorIndex = cursor.indexOf(CURSOR_SEPARATOR);
  if (separatorIndex === -1) {
    return null;
  }
  const cursorTime = cursor.slice(0, separatorIndex);
  const cursorId = cursor.slice(separatorIndex + 1);
  if (!cursorTime || !cursorId) {
    return null;
  }
  return { cursorTime, cursorId };
}

/**
 * フォロー関係のリストをDBから取得する共通クエリビルダー
 *
 * 複合カーソル（`createdAt|id` 形式）を使用し、同一タイムスタンプでのページ欠落を防ぐ。
 * WHERE条件: (createdAt < cursorTime) OR (createdAt = cursorTime AND id < cursorId)
 *
 * @param db - データベースインスタンス
 * @param params - クエリパラメータ（userId, limit, cursor）
 * @param filterColumn - WHERE 条件に使うカラム（followingId or followerId）
 * @param idColumn - SELECT して id として返すカラム（followerId or followingId）
 * @returns フォローリストレコード配列
 */
async function queryFollowList(
  db: Database,
  params: FollowListQueryParams,
  filterColumn: typeof follows.followingId | typeof follows.followerId,
  idColumn: typeof follows.followerId | typeof follows.followingId,
): Promise<Array<Record<string, unknown>>> {
  const conditions = [eq(filterColumn, params.userId)];
  if (params.cursor) {
    const parsed = parseCursor(params.cursor);
    if (parsed) {
      const { cursorTime, cursorId } = parsed;
      const cursorCondition = or(
        lt(follows.createdAt, cursorTime),
        and(sql`${follows.createdAt} = ${cursorTime}`, lt(idColumn, cursorId)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }
  }
  const rows = await db
    .select({
      id: idColumn,
      createdAt: follows.createdAt,
      name: users.name,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
    })
    .from(follows)
    .leftJoin(users, eq(idColumn, users.id))
    .where(and(...conditions))
    .orderBy(desc(follows.createdAt))
    .limit(params.limit);

  return toRecordArray(
    rows.map((row) => ({
      id: row.id,
      name: row.name ?? null,
      bio: row.bio ?? null,
      avatarUrl: row.avatarUrl ?? null,
      createdAt: row.createdAt,
    })),
  );
}

/**
 * ユーザー・フォロードメインのサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param env - Cloudflare Workers バインディング
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleUsers(
  db: Database,
  env: Bindings,
  auth: Auth,
  request: Request,
): Promise<Response> {
  const usersRoute = createUsersRoute({
    db,
    r2Bucket: env.AVATARS_BUCKET,
    r2PublicUrl: env.ENVIRONMENT === "production" ? PRODUCTION_AVATAR_URL : undefined,
  });

  const followsRoute = createFollowsRoute({
    db,
    followFn: async (followerId, followingId) => {
      await db.insert(follows).values({ followerId, followingId });
      const [result] = await db
        .select()
        .from(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
      return toRecord<{ followerId: string; followingId: string; createdAt: string }>(result);
    },
    unfollowFn: async (followerId, followingId) => {
      await db
        .delete(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    },
    getFollowersFn: async (params) =>
      queryFollowList(db, params, follows.followingId, follows.followerId),
    getFollowingFn: async (params) =>
      queryFollowList(db, params, follows.followerId, follows.followingId),
    isFollowingFn: async (followerId, followingId) => {
      const [result] = await db
        .select()
        .from(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
      return !!result;
    },
    userExistsFn: async (userId) => {
      const [found] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      return !!found;
    },
  });

  return fetchWithAuth(
    auth.api.getSession.bind(auth.api),
    (subApp) => {
      subApp.route("/api/users", usersRoute);
      subApp.route("/api/users", followsRoute);
    },
    request,
  );
}
