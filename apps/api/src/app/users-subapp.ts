import { and, count, desc, eq, lt, or, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import type { Auth } from "../auth";
import type { Database } from "../db";
import { follows, users } from "../db/schema";
import { fetchWithAuth } from "../lib/route-helpers";
import type { FollowListItem, FollowListQueryParams } from "../routes/follows";
import { createFollowsRoute, parseCursor } from "../routes/follows";
import { createPublicProfileRoute } from "../routes/public-profile";
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
 * @param direction - "followers"（フォロワー一覧）または "following"（フォロー中一覧）
 * @returns フォローリストレコード配列
 */
async function queryFollowList(
  db: Database,
  params: FollowListQueryParams,
  direction: "followers" | "following",
): Promise<Array<FollowListItem>> {
  const [filterColumn, idColumn] =
    direction === "followers"
      ? [follows.followingId, follows.followerId]
      : [follows.followerId, follows.followingId];

  const conditions: SQL<unknown>[] = [eq(filterColumn, params.userId)];
  if (params.cursor) {
    const parsed = parseCursor(params.cursor);
    if (!parsed) {
      throw new Error("カーソル形式が不正です");
    }
    const { cursorTime, cursorId } = parsed;
    const cursorCondition = or(
      lt(follows.createdAt, cursorTime),
      and(eq(follows.createdAt, cursorTime), lt(idColumn, cursorId)),
    );
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }
  const rows = await db
    .select({
      id: idColumn,
      createdAt: follows.createdAt,
      name: users.name,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      isProfilePublic: users.isProfilePublic,
    })
    .from(follows)
    .leftJoin(users, eq(idColumn, users.id))
    .where(and(...conditions))
    .orderBy(desc(follows.createdAt), desc(idColumn))
    .limit(params.limit);

  /**
   * 非公開ユーザーのプロフィールポリシー:
   * - id / createdAt はフォロー関係として存在を公開する
   * - name / bio / avatarUrl は非公開ユーザーの場合 null を返す
   */
  return rows.map((row) => ({
    id: row.id,
    name: row.isProfilePublic ? (row.name ?? null) : null,
    bio: row.isProfilePublic ? (row.bio ?? null) : null,
    avatarUrl: row.isProfilePublic ? (row.avatarUrl ?? null) : null,
    createdAt: row.createdAt,
  }));
}

/**
 * 公開プロフィールサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handlePublicProfile(db: Database, request: Request): Promise<Response> {
  const publicProfileRoute = createPublicProfileRoute({
    getProfileFn: async (userId) => {
      const [found] = await db.select().from(users).where(eq(users.id, userId));
      if (!found?.isProfilePublic) {
        return null;
      }

      const [[followersResult], [followingResult]] = await Promise.all([
        db.select({ count: count() }).from(follows).where(eq(follows.followingId, userId)),
        db.select({ count: count() }).from(follows).where(eq(follows.followerId, userId)),
      ]);

      return {
        id: found.id,
        name: found.name ?? null,
        username: found.username ?? null,
        bio: found.bio ?? null,
        avatarUrl: found.avatarUrl ?? null,
        followersCount: followersResult?.count ?? 0,
        followingCount: followingResult?.count ?? 0,
      };
    },
  });

  const subApp = new Hono();
  subApp.route("/api/users", publicProfileRoute);

  return subApp.fetch(request);
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
    followFn: async (followerId, followingId) => {
      await db.insert(follows).values({ followerId, followingId });
      const [result] = await db
        .select()
        .from(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
      return {
        followerId: result.followerId,
        followingId: result.followingId,
        createdAt: result.createdAt,
      };
    },
    unfollowFn: async (followerId, followingId) => {
      await db
        .delete(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    },
    getFollowersFn: async (params) => queryFollowList(db, params, "followers"),
    getFollowingFn: async (params) => queryFollowList(db, params, "following"),
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
