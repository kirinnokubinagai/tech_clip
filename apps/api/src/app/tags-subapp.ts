import type { Auth } from "../auth";
import type { Database } from "../db";
import { fetchWithAuth } from "../lib/route-helpers";
import { createArticleTagsRoute, createTagsRoute } from "../routes/tags";

/**
 * タグドメインのサブアプリを構築してリクエストを処理する
 *
 * @param db - データベースインスタンス
 * @param auth - Better Auth インスタンス
 * @param request - 元のリクエスト
 * @returns fetch レスポンス
 */
export async function handleTags(db: Database, auth: Auth, request: Request): Promise<Response> {
  const tagsRoute = createTagsRoute({ db });
  const articleTagsRoute = createArticleTagsRoute({ db });

  return fetchWithAuth(
    db,
    auth,
    (subApp) => {
      subApp.route("/api/tags", tagsRoute);
      subApp.route("/api/articles", articleTagsRoute);
    },
    request,
  );
}
