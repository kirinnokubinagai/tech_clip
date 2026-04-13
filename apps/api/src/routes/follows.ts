import type { Context } from "hono";
import { Hono } from "hono";

import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  CONFLICT_ERROR_CODE,
  NOT_FOUND_ERROR_CODE,
  VALIDATION_ERROR_CODE,
} from "../lib/error-codes";
import {
  HTTP_CONFLICT,
  HTTP_CREATED,
  HTTP_NO_CONTENT,
  HTTP_NOT_FOUND,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE_ENTITY,
} from "../lib/http-status";
import { createLogger } from "../lib/logger";

/** デフォルトのページサイズ */
const DEFAULT_LIMIT = 20;

/** 最小ページサイズ */
const MIN_LIMIT = 1;

/** 最大ページサイズ */
const MAX_LIMIT = 50;

/** フォロー関係の型 */
type FollowResult = {
  followerId: string;
  followingId: string;
  createdAt: string;
};

/** 複合カーソルの区切り文字 */
const CURSOR_SEPARATOR = "|";

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

/** フォロー一覧のユーザーアイテム型 */
export type FollowListItem = {
  id: string;
  createdAt: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

/** フォロワー/フォロー中一覧取得関数の型 */
export type GetFollowListFn = (params: FollowListQueryParams) => Promise<Array<FollowListItem>>;

/** フォロー状態確認関数の型 */
export type IsFollowingFn = (followerId: string, followingId: string) => Promise<boolean>;

/** ユーザー存在確認関数の型 */
export type UserExistsFn = (userId: string) => Promise<boolean>;

/** ルートの変数型 */
type RouteVariables = { user?: Record<string, unknown> };

/**
 * 認証済みユーザーIDを取得する
 *
 * @param c - Honoコンテキスト
 * @returns 認証済みの場合は `{ ok: true; userId: string }`、未認証の場合は `{ ok: false }`
 */
function getAuthenticatedUserId(
  c: Context<{ Variables: RouteVariables }>,
): { ok: true; userId: string } | { ok: false } {
  const user = c.get("user");
  if (!user?.id || typeof user.id !== "string") {
    return { ok: false };
  }
  return { ok: true, userId: user.id };
}

/** createFollowsRouteのオプション */
type FollowsRouteOptions = {
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
 * @returns パース結果。成功時は `{ ok: true; value: number }`、失敗時は `{ ok: false; message: string }`
 */
function parseLimitParam(
  limitStr: string | undefined,
): { ok: true; value: number } | { ok: false; message: string } {
  if (limitStr === undefined) {
    return { ok: true, value: DEFAULT_LIMIT };
  }
  const parsed = Number(limitStr);
  if (Number.isNaN(parsed) || !Number.isInteger(parsed)) {
    return { ok: false, message: "limitは整数で指定してください" };
  }
  if (parsed < MIN_LIMIT || parsed > MAX_LIMIT) {
    return { ok: false, message: `limitは${MIN_LIMIT}以上${MAX_LIMIT}以下で指定してください` };
  }
  return { ok: true, value: parsed };
}

/**
 * 複合カーソル文字列（`createdAt|id` 形式）をパースする
 *
 * @param cursor - 複合カーソル文字列
 * @returns パース結果。不正な形式の場合は null
 */
export function parseCursor(cursor: string): { cursorTime: string; cursorId: string } | null {
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
 * 複合カーソル文字列（`createdAt|id` 形式）を生成する
 *
 * @param createdAt - フォロー作成日時文字列
 * @param id - フォロワーIDまたはフォロー中ID
 * @returns 複合カーソル文字列
 */
export function buildCursor(createdAt: string, id: string): string {
  return `${createdAt}${CURSOR_SEPARATOR}${id}`;
}

const logger = createLogger();

/** SQLite/D1 の UNIQUE constraint エラー文言 */
const UNIQUE_CONSTRAINT_ERROR_FRAGMENT = "UNIQUE constraint failed";

/**
 * SQLiteのUNIQUE制約違反エラーかどうかを判定する
 *
 * D1/libsql では LibsqlError→cause→cause と複数段ネストする場合があるため、
 * while ループで cause チェーンを再帰的に辿る。
 *
 * @param error - 発生したエラー
 * @returns UNIQUE制約違反であれば true
 */
function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  let current: Error | undefined = error;
  while (current) {
    if (current.message.includes(UNIQUE_CONSTRAINT_ERROR_FRAGMENT)) return true;
    current = current.cause instanceof Error ? current.cause : undefined;
  }
  return false;
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
  const route = new Hono<{ Variables: RouteVariables }>();

  /**
   * フォロワー/フォロー中一覧の共通GETハンドラーを生成する
   *
   * @param getListFn - 一覧取得関数（getFollowersFn または getFollowingFn）
   * @returns Honoルートハンドラー
   */
  function createFollowListHandler(getListFn: GetFollowListFn) {
    return async (c: Context<{ Variables: RouteVariables }>) => {
      const authResult = getAuthenticatedUserId(c);
      if (!authResult.ok) {
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

      const targetUserId = c.req.param("id") as string;

      const limitResult = parseLimitParam(c.req.query("limit"));
      if (!limitResult.ok) {
        return c.json(
          {
            success: false,
            error: {
              code: VALIDATION_ERROR_CODE,
              message: "入力内容を確認してください",
              details: [{ field: "limit", message: limitResult.message }],
            },
          },
          HTTP_UNPROCESSABLE_ENTITY,
        );
      }

      const limit = limitResult.value;
      const cursorParam = c.req.query("cursor");

      if (cursorParam !== undefined && parseCursor(cursorParam) === null) {
        return c.json(
          {
            success: false,
            error: {
              code: VALIDATION_ERROR_CODE,
              message: "cursorの形式が正しくありません",
            },
          },
          HTTP_UNPROCESSABLE_ENTITY,
        );
      }

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

      /** +1件取得して hasNext を判定する */
      const fetched = await getListFn({
        userId: targetUserId,
        limit: limit + 1,
        cursor: cursorParam,
      });

      const hasNext = fetched.length > limit;
      const data = hasNext ? fetched.slice(0, limit) : fetched;
      const lastItem = data.length > 0 ? data[data.length - 1] : null;
      const nextCursor = hasNext && lastItem ? buildCursor(lastItem.createdAt, lastItem.id) : null;

      return c.json({
        success: true,
        data,
        meta: {
          nextCursor,
          hasNext,
        },
      });
    };
  }

  route.post("/:id/follow", async (c) => {
    const authResult = getAuthenticatedUserId(c);
    if (!authResult.ok) {
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

    const followerId = authResult.userId;
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
            code: CONFLICT_ERROR_CODE,
            message: "すでにフォローしています",
          },
        },
        HTTP_CONFLICT,
      );
    }

    try {
      const result = await followFn(followerId, followingId);
      return c.json(
        {
          success: true,
          data: result,
        },
        HTTP_CREATED,
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return c.json(
          {
            success: false,
            error: {
              code: CONFLICT_ERROR_CODE,
              message: "すでにフォローしています",
            },
          },
          HTTP_CONFLICT,
        );
      }
      logger.error("フォロー処理エラー", {
        followerId,
        followingId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  });

  route.delete("/:id/follow", async (c) => {
    const authResult = getAuthenticatedUserId(c);
    if (!authResult.ok) {
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

    const followerId = authResult.userId;
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

  route.get("/:id/followers", createFollowListHandler(getFollowersFn));
  route.get("/:id/following", createFollowListHandler(getFollowingFn));

  return route;
}
