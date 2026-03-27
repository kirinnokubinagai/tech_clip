import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db";

/**
 * Better Auth インスタンスを生成する
 *
 * @param db - Drizzle ORM データベースインスタンス
 * @param secret - Better Auth 暗号化用シークレットキー
 * @returns Better Auth インスタンス
 */
export function createAuth(db: Database, secret: string) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    secret,
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: ["techclip://", "http://localhost:8081"],
  });
}
