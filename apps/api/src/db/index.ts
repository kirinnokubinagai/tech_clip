import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

export type DatabaseEnv = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

/**
 * Drizzle ORM + Turso (libSQL) クライアントを初期化してDBインスタンスを返す
 *
 * @param env - データベース接続に必要な環境変数
 * @returns Drizzle ORM インスタンス
 */
export function createDatabase(env: DatabaseEnv) {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client);
}

export type Database = ReturnType<typeof createDatabase>;
