declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
  exit: (code: number) => never;
};

import { createClient } from "@libsql/client";

/** Turso dev サーバーの接続先 URL */
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL ?? "http://127.0.0.1:8888";

/** Turso dev サーバーの認証トークン（ローカル開発時はダミーで可） */
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? "dummy";

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

process.stdout.write(`[reset-db] Connecting to ${TURSO_DATABASE_URL}\n`);

const result = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'",
);

for (const row of result.rows) {
  const name = String(row.name);
  process.stdout.write(`[reset-db] DROP TABLE ${name}\n`);
  await client.execute(`DROP TABLE IF EXISTS "${name}"`);
}

// drizzle マイグレーション履歴テーブルも削除して最初から migrate させる
await client.execute("DROP TABLE IF EXISTS __drizzle_migrations");

process.stdout.write("[reset-db] All tables dropped. Ready for migrate + seed.\n");

client.close();
