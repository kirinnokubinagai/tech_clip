import { eq } from "drizzle-orm";

import type { Auth } from "../auth";
import type { Database } from "../db";
import { sessions, users } from "../db/schema";

/**
 * リクエストからユーザーを解決する
 *
 * Better Auth Cookie → カスタム sessions テーブルの Bearer token の順で検証する。
 * モバイルクライアントは Authorization: Bearer <token> ヘッダーで認証する想定。
 *
 * @param db - データベースインスタンス
 * @param auth - Better Auth インスタンス
 * @param headers - リクエストヘッダー
 * @returns ユーザー情報。未認証の場合は null
 */
export async function resolveUserFromRequest(
  db: Database,
  auth: Auth,
  headers: Headers,
): Promise<Record<string, unknown> | null> {
  // 1. Better Auth の cookie セッションを試す
  try {
    const result = await auth.api.getSession({ headers });
    if (result?.user) {
      return result.user as Record<string, unknown>;
    }
  } catch {
    // Cookie 検証失敗は無視して Bearer token を試す
  }

  // 2. Authorization: Bearer <token> ヘッダーからカスタム sessions テーブルを検証
  const authHeader = headers.get("authorization") ?? headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length);
  const [sessionRow] = await db.select().from(sessions).where(eq(sessions.token, token));
  if (!sessionRow) {
    return null;
  }

  // セッション有効期限チェック
  const expiresAtMs =
    typeof sessionRow.expiresAt === "string"
      ? Date.parse(sessionRow.expiresAt)
      : (sessionRow.expiresAt as Date).getTime();
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return null;
  }

  const [userRow] = await db.select().from(users).where(eq(users.id, sessionRow.userId));
  return userRow ? (userRow as Record<string, unknown>) : null;
}
