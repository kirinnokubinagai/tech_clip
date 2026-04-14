import type { PublicProfile } from "@tech-clip/types";
import { Hono } from "hono";

import { NOT_FOUND_ERROR_CODE } from "../lib/error-codes";
import { HTTP_NOT_FOUND, HTTP_OK } from "../lib/http-status";

/** ユーザー未発見エラーメッセージ */
const USER_NOT_FOUND_MESSAGE = "ユーザーが見つかりません";

/**
 * プロフィール取得関数の型
 *
 * @param targetUserId - 閲覧対象ユーザーID
 * @param viewerUserId - 閲覧者のユーザーID（未認証の場合は null）
 */
export type GetPublicProfileFn = (
  targetUserId: string,
  viewerUserId: string | null,
) => Promise<PublicProfile | null>;

/** createPublicProfileRoute のオプション */
type PublicProfileRouteOptions = {
  getProfileFn: GetPublicProfileFn;
};

/**
 * 公開プロフィールルートを生成する
 *
 * GET /:id/profile: 指定ユーザーの公開プロフィール（optional auth）
 *
 * @param options - プロフィール取得関数
 * @returns Hono ルーターインスタンス
 */
export function createPublicProfileRoute(options: PublicProfileRouteOptions) {
  const { getProfileFn } = options;
  const route = new Hono<{ Variables: { user?: { id: string } } }>();

  route.get("/:id/profile", async (c) => {
    const targetUserId = c.req.param("id");
    const viewer = c.get("user");
    const viewerUserId = viewer?.id ?? null;

    const profile = await getProfileFn(targetUserId, viewerUserId);

    if (!profile) {
      return c.json(
        {
          success: false,
          error: {
            code: NOT_FOUND_ERROR_CODE,
            message: USER_NOT_FOUND_MESSAGE,
          },
        },
        HTTP_NOT_FOUND,
      );
    }

    return c.json(
      {
        success: true,
        data: profile,
      },
      HTTP_OK,
    );
  });

  return route;
}
