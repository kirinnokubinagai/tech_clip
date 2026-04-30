import type { PublicProfile } from "@tech-clip/types";
import { Hono } from "hono";

import { NOT_FOUND_ERROR_CODE } from "../lib/error-codes";
import { HTTP_INTERNAL_SERVER_ERROR, HTTP_NOT_FOUND, HTTP_OK } from "../lib/http-status";
import { createLogger } from "../lib/logger";

/** ルートロガー */
const logger = createLogger();

/** ユーザー未発見エラーメッセージ */
const USER_NOT_FOUND_MESSAGE = "ユーザーが見つかりません";

/** 内部サーバーエラーメッセージ */
const INTERNAL_SERVER_ERROR_MESSAGE = "内部サーバーエラーが発生しました";

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

    try {
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
    } catch (err) {
      logger.error("公開プロフィール取得エラー", {
        error: err instanceof Error ? err : String(err),
      });
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: INTERNAL_SERVER_ERROR_MESSAGE,
          },
        },
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
  });

  return route;
}
