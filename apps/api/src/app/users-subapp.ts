import { and, count, desc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import type { Auth } from "../auth";
import type { Database } from "../db";
import { follows, users } from "../db/schema";
import { toRecord, toRecordArray } from "../lib/db-cast";
import { fetchWithAuth } from "../lib/route-helpers";
import { createFollowsRoute } from "../routes/follows";
import { createPublicProfileRoute } from "../routes/public-profile";
import { createUsersRoute } from "../routes/users";
import type { Bindings } from "../types";

/** 本番環境のアバター公開 URL */
const PRODUCTION_AVATAR_URL = "https://avatars.techclip.io";

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
      if (!found) {
        return null;
      }

      const [followersResult] = await db
        .select({ count: count() })
        .from(follows)
        .where(eq(follows.followingId, userId));

      const [followingResult] = await db
        .select({ count: count() })
        .from(follows)
        .where(eq(follows.followerId, userId));

      const user = found as unknown as Record<string, unknown>;

      return {
        id: user.id as string,
        name: (user.name as string | null) ?? null,
        username: (user.username as string | null) ?? null,
        bio: (user.bio as string | null) ?? null,
        avatarUrl: (user.avatarUrl as string | null) ?? null,
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
    getFollowersFn: async (params) => {
      const conditions = [eq(follows.followingId, params.userId)];
      if (params.cursor) {
        conditions.push(lt(follows.createdAt, params.cursor));
      }
      const results = await db
        .select()
        .from(follows)
        .where(and(...conditions))
        .orderBy(desc(follows.createdAt))
        .limit(params.limit);
      return toRecordArray(results);
    },
    getFollowingFn: async (params) => {
      const conditions = [eq(follows.followerId, params.userId)];
      if (params.cursor) {
        conditions.push(lt(follows.createdAt, params.cursor));
      }
      const results = await db
        .select()
        .from(follows)
        .where(and(...conditions))
        .orderBy(desc(follows.createdAt))
        .limit(params.limit);
      return toRecordArray(results);
    },
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
