import { Hono } from "hono";

import { NOT_FOUND_ERROR_CODE } from "../lib/error-codes";
import { HTTP_NOT_FOUND, HTTP_OK } from "../lib/http-status";

/** ユーザー未発見エラーメッセージ */
const USER_NOT_FOUND_MESSAGE = "ユーザーが見つかりません";

/** 公開プロフィールの型 */
export type PublicProfile = {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
};

/** プロフィール取得関数の型 */
export type GetPublicProfileFn = (userId: string) => Promise<PublicProfile | null>;

/** createPublicProfileRoute のオプション */
type PublicProfileRouteOptions = {
  getProfileFn: GetPublicProfileFn;
};

/**
 * 公開プロフィールルートを生成する
 *
 * GET /:id/profile: 指定ユーザーの公開プロフィール（認証不要）
 *
 * @param options - プロフィール取得関数
 * @returns Hono ルーターインスタンス
 */
export function createPublicProfileRoute(options: PublicProfileRouteOptions) {
  const { getProfileFn } = options;
  const route = new Hono();

  route.get("/:id/profile", async (c) => {
    const userId = c.req.param("id");

    const profile = await getProfileFn(userId);

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
