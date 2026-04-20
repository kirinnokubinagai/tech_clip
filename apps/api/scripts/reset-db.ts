#!/usr/bin/env -S node --experimental-strip-types

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

/** テーブル削除の最大試行回数 */
const MAX_DROP_ATTEMPTS = 5;

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

process.stdout.write(`[reset-db] Connecting to ${TURSO_DATABASE_URL}\n`);

try {
  /**
   * FK cascade による連鎖削除を無効化する
   * テーブル間の参照を気にせず個別に DROP できる
   */
  await client.execute("PRAGMA foreign_keys = OFF");

  /**
   * トリガーを先に削除する
   * テーブル削除時に FTS 同期トリガーが fire すると
   * "no such table" エラーが発生するため事前に除去する
   */
  const triggersResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='trigger' AND name NOT LIKE 'sqlite_%'",
  );
  for (const row of triggersResult.rows) {
    const name = String(row.name);
    process.stdout.write(`[reset-db] DROP TRIGGER ${name}\n`);
    try {
      await client.execute(`DROP TRIGGER IF EXISTS "${name}"`);
    } catch (e) {
      process.stderr.write(`[reset-db] trigger ${name} drop skipped: ${(e as Error).message}\n`);
    }
  }

  /**
   * ビューを削除する
   * テーブル削除前にビューへの依存を解消する
   */
  const viewsResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='view' AND name NOT LIKE 'sqlite_%'",
  );
  for (const row of viewsResult.rows) {
    const name = String(row.name);
    process.stdout.write(`[reset-db] DROP VIEW ${name}\n`);
    try {
      await client.execute(`DROP VIEW IF EXISTS "${name}"`);
    } catch (e) {
      process.stderr.write(`[reset-db] view ${name} drop skipped: ${(e as Error).message}\n`);
    }
  }

  /**
   * テーブルをリトライループで削除する
   * FTS5 shadow tables（_data / _idx / _docsize / _config 等）は
   * virtual table 削除時に自動消去されるが、他テーブルの CASCADE で
   * 先に消えることもある。DROP IF EXISTS + retry で吸収する
   */
  let remaining = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < MAX_DROP_ATTEMPTS && remaining > 0; attempt++) {
    const tablesResult = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' ORDER BY name",
    );
    remaining = tablesResult.rows.length;
    if (remaining === 0) break;

    process.stdout.write(`[reset-db] attempt ${attempt + 1}: ${remaining} tables remain\n`);

    for (const row of tablesResult.rows) {
      const name = String(row.name);
      try {
        await client.execute(`DROP TABLE IF EXISTS "${name}"`);
      } catch (e) {
        process.stderr.write(
          `[reset-db] DROP TABLE ${name} failed (will retry): ${(e as Error).message}\n`,
        );
      }
    }
  }

  /**
   * drizzle マイグレーション履歴テーブルを削除する
   * 次回 migrate 時に全マイグレーションが再実行される
   */
  await client.execute("DROP TABLE IF EXISTS __drizzle_migrations");

  /**
   * 事後検証: テーブルがすべて消えているか確認する
   */
  const finalResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'",
  );
  if (finalResult.rows.length > 0) {
    const remainingNames = finalResult.rows.map((r) => String(r.name)).join(", ");
    throw new Error(
      `reset-db FAILED: ${finalResult.rows.length} tables remain after ${MAX_DROP_ATTEMPTS} attempts: ${remainingNames}`,
    );
  }

  /**
   * FK を再有効化する
   * migrate・seed が正常に外部キー制約を使えるようにする
   */
  await client.execute("PRAGMA foreign_keys = ON");

  process.stdout.write("[reset-db] All tables dropped. Ready for migrate + seed.\n");
} finally {
  client.close();
}
