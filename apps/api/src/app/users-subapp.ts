import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { Auth } from "../auth";
import type { Database } from "../db";
import { follows, users } from "../db/schema";
import { toRecord, toRecordArray } from "../lib/db-cast";
import { fetchWithAuth } from "../lib/route-helpers";
import { createFollowsRoute } from "../routes/follows";
import { createUsersRoute } from "../routes/users";
import type { Bindings } from "../types";

/** 本番環境のアバター公開 URL */
const PRODUCTION_AVATAR_URL = "https://avatars.techclip.io";

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
      const followRows = await db
        .select()
        .from(follows)
        .where(and(...conditions))
        .orderBy(desc(follows.createdAt))
        .limit(params.limit);

      if (followRows.length === 0) {
        return [];
      }

      const followerIds = followRows.map((row) => row.followerId);
      const userRows = await db
        .select({
          id: users.id,
          name: users.name,
          bio: users.bio,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(inArray(users.id, followerIds));

      const userMap = new Map(userRows.map((u) => [u.id, u]));

      return toRecordArray(
        followRows.map((row) => {
          const u = userMap.get(row.followerId);
          return {
            id: row.followerId,
            name: u?.name ?? null,
            bio: u?.bio ?? null,
            avatarUrl: u?.avatarUrl ?? null,
            createdAt: row.createdAt,
          };
        }),
      );
    },
    getFollowingFn: async (params) => {
      const conditions = [eq(follows.followerId, params.userId)];
      if (params.cursor) {
        conditions.push(lt(follows.createdAt, params.cursor));
      }
      const followRows = await db
        .select()
        .from(follows)
        .where(and(...conditions))
        .orderBy(desc(follows.createdAt))
        .limit(params.limit);

      if (followRows.length === 0) {
        return [];
      }

      const followingIds = followRows.map((row) => row.followingId);
      const userRows = await db
        .select({
          id: users.id,
          name: users.name,
          bio: users.bio,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(inArray(users.id, followingIds));

      const userMap = new Map(userRows.map((u) => [u.id, u]));

      return toRecordArray(
        followRows.map((row) => {
          const u = userMap.get(row.followingId);
          return {
            id: row.followingId,
            name: u?.name ?? null,
            bio: u?.bio ?? null,
            avatarUrl: u?.avatarUrl ?? null,
            createdAt: row.createdAt,
          };
        }),
      );
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
