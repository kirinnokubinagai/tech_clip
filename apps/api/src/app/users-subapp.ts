import { and, desc, eq, lt, or } from "drizzle-orm";
import type { Auth } from "../auth";
import type { Database } from "../db";
import { follows, users } from "../db/schema";
import { toRecord } from "../lib/db-cast";
import { fetchWithAuth } from "../lib/route-helpers";
import type { FollowListItem, FollowListQueryParams } from "../routes/follows";
import { createFollowsRoute, parseCursor } from "../routes/follows";
import { createUsersRoute } from "../routes/users";
import type { Bindings } from "../types";

/** 本番環境のアバター公開 URL */
const PRODUCTION_AVATAR_URL = "https://avatars.techclip.io";

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
): Promise<Array<FollowListItem>> {
  const conditions = [eq(filterColumn, params.userId)];
  if (params.cursor) {
    const parsed = parseCursor(params.cursor);
    if (parsed) {
      const { cursorTime, cursorId } = parsed;
      conditions.push(
        or(
          lt(follows.createdAt, cursorTime),
          and(eq(follows.createdAt, cursorTime), lt(idColumn, cursorId)),
        ),
      );
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
    .orderBy(desc(follows.createdAt), desc(idColumn))
    .limit(params.limit);

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? null,
    bio: row.bio ?? null,
    avatarUrl: row.avatarUrl ?? null,
    createdAt: row.createdAt,
  }));
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
