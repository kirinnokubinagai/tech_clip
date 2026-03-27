import { Hono } from "hono";

import type { Database } from "../db";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** HTTP 201 Created ステータスコード */
const HTTP_CREATED = 201;

/** HTTP 204 No Content ステータスコード */
const HTTP_NO_CONTENT = 204;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 404 Not Found ステータスコード */
const HTTP_NOT_FOUND = 404;

/** HTTP 409 Conflict ステータスコード */
const HTTP_CONFLICT = 409;

/** HTTP 422 Unprocessable Entity ステータスコード */
const HTTP_UNPROCESSABLE_ENTITY = 422;

/** 未認証エラーコード */
const AUTH_ERROR_CODE = "AUTH_REQUIRED";

/** 未認証エラーメッセージ */
const AUTH_ERROR_MESSAGE = "ログインが必要です";

/** バリデーションエラーコード */
const VALIDATION_ERROR_CODE = "VALIDATION_FAILED";

/** リソース未存在エラーコード */
const NOT_FOUND_ERROR_CODE = "NOT_FOUND";

/** 重複エラーコード */
const DUPLICATE_ERROR_CODE = "DUPLICATE";

/** フォロー関係の型 */
type FollowResult = {
  followerId: string;
  followingId: string;
  createdAt: string;
};

/** フォロワー/フォロー中一覧のクエリパラメータ型 */
export type FollowListQueryParams = {
  userId: string;
  limit: number;
  cursor?: string;
};

/** フォロー関数の型 */
export type FollowFn = (followerId: string, followingId: string) => Promise<FollowResult>;

/** アンフォロー関数の型 */
export type UnfollowFn = (followerId: string, followingId: string) => Promise<void>;

/** フォロワー/フォロー中一覧取得関数の型 */
export type GetFollowListFn = (
  params: FollowListQueryParams,
) => Promise<Array<Record<string, unknown>>>;

/** フォロー状態確認関数の型 */
export type IsFollowingFn = (followerId: string, followingId: string) => Promise<boolean>;

/** ユーザー存在確認関数の型 */
export type UserExistsFn = (userId: string) => Promise<boolean>;

/** createFollowsRouteのオプション */
type FollowsRouteOptions = {
  db: Database;
  followFn: FollowFn;
  unfollowFn: UnfollowFn;
  getFollowersFn: GetFollowListFn;
  getFollowingFn: GetFollowListFn;
  isFollowingFn: IsFollowingFn;
  userExistsFn: UserExistsFn;
};

/**
 * limitクエリパラメータをパースしてバリデーションする
 *
 * @param limitStr - クエリパラメータの文字列値
 * @returns パース結果。エラーの場合はエラーメッセージ文字列
 */
function parseLimitParam(limitStr: string | undefined): number | string {
  if (limitStr === undefined) {
    return DEFAULT_LIMIT;
  }
  const parsed = Number(limitStr);
  if (Number.isNaN(parsed) || !Number.isInteger(parsed)) {
    return "limitは整数で指定してください";
  }
  if (parsed < MIN_LIMIT || parsed > MAX_LIMIT) {
    return `limitは${MIN_LIMIT}以上${MAX_LIMIT}以下で指定してください`;
  }
  return parsed;
}

/**
 * フォロー関連ルートを生成する
 *
 * POST /:id/follow: ユーザーをフォローする
 * DELETE /:id/follow: ユーザーのフォローを解除する
 * GET /:id/followers: フォロワー一覧（カーソルベースページネーション対応）
 * GET /:id/following: フォロー中一覧（カーソルベースページネーション対応）
 *
 * @param options - DB インスタンスと各操作関数
 * @returns Hono ルーターインスタンス
 */
export function createFollowsRoute(options: FollowsRouteOptions) {
  const { followFn, unfollowFn, getFollowersFn, getFollowingFn, isFollowingFn, userExistsFn } =
    options;
  const route = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  route.post("/:id/follow", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_ERROR_CODE,
            message: AUTH_ERROR_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const followerId = user.id as string;
    const followingId = c.req.param("id");

    if (followerId === followingId) {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: "自分自身をフォローすることはできません",
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const targetExists = await userExistsFn(followingId);
    if (!targetExists) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: "ユーザーが見つかりません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const alreadyFollowing = await isFollowingFn(followerId, followingId);
    if (alreadyFollowing) {
      return c.json(
        {
          success: false,
          error: {
            code: DUPLICATE_ERROR_CODE,
            message: "すでにフォローしています",
          },
        },
        HTTP_CONFLICT,
      );
    }

    const result = await followFn(followerId, followingId);

    return c.json(
      {
        success: true,
        data: result,
      },
      HTTP_CREATED,
    );
  });

  route.delete("/:id/follow", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_ERROR_CODE,
            message: AUTH_ERROR_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const followerId = user.id as string;
    const followingId = c.req.param("id");

    const targetExists = await userExistsFn(followingId);
    if (!targetExists) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: "ユーザーが見つかりません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const isCurrentlyFollowing = await isFollowingFn(followerId, followingId);
    if (!isCurrentlyFollowing) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: "フォローしていません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    await unfollowFn(followerId, followingId);

    return c.body(null, HTTP_NO_CONTENT);
  });

  route.get("/:id/followers", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_ERROR_CODE,
            message: AUTH_ERROR_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const targetUserId = c.req.param("id");

    const targetExists = await userExistsFn(targetUserId);
    if (!targetExists) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: "ユーザーが見つかりません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const limitResult = parseLimitParam(c.req.query("limit"));
    if (typeof limitResult === "string") {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: "入力内容を確認してください",
            details: [{ field: "limit", message: limitResult }],
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const limit = limitResult;
    const cursor = c.req.query("cursor");

    const fetchedFollowers = await getFollowersFn({
      userId: targetUserId,
      limit: limit + 1,
      cursor: cursor || undefined,
    });

    const hasNext = fetchedFollowers.length > limit;
    const data = hasNext ? fetchedFollowers.slice(0, limit) : fetchedFollowers;
    const nextCursor = hasNext ? (data[data.length - 1].id as string) : null;

    return c.json({
      success: true,
      data,
      meta: {
        nextCursor,
        hasNext,
      },
    });
  });

  route.get("/:id/following", async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json(
        {
          success: false,
          error: {
            code: AUTH_ERROR_CODE,
            message: AUTH_ERROR_MESSAGE,
          },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    const targetUserId = c.req.param("id");

    const targetExists = await userExistsFn(targetUserId);
    if (!targetExists) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: "ユーザーが見つかりません",
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    const limitResult = parseLimitParam(c.req.query("limit"));
    if (typeof limitResult === "string") {
      return c.json(
        {
          success: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            message: "入力内容を確認してください",
            details: [{ field: "limit", message: limitResult }],
          },
        },
        HTTP_UNPROCESSABLE_ENTITY,
      );
    }

    const limit = limitResult;
    const cursor = c.req.query("cursor");

    const fetchedFollowing = await getFollowingFn({
      userId: targetUserId,
      limit: limit + 1,
      cursor: cursor || undefined,
    });

    const hasNext = fetchedFollowing.length > limit;
    const data = hasNext ? fetchedFollowing.slice(0, limit) : fetchedFollowing;
    const nextCursor = hasNext ? (data[data.length - 1].id as string) : null;

    return c.json({
      success: true,
      data,
      meta: {
        nextCursor,
        hasNext,
      },
    });
  });

  return route;
}
