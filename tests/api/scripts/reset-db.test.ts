import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * テストごとに独立した一時 SQLite ファイルを返す
 *
 * reset-db は DROP ALL TABLES という破壊的操作のため、共有 sqld（:8888）を
 * 使うと並列実行中の他テストを壊す。各テストで独自の一時ファイル DB を使うことで
 * 完全に隔離する。
 */
function makeTempDbUrl(): { url: string; filePath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reset-db-test-"));
  const filePath = path.join(dir, "test.db");
  return { url: `file:${filePath}`, filePath: dir };
}

/**
 * reset-db スクリプトを node で実行し stdout/stderr/exitCode を返す
 */
async function runResetDb(
  dbUrl: string,
  authToken = "",
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  const scriptPath = new URL("../../../apps/api/scripts/reset-db.ts", import.meta.url).pathname;

  try {
    const { stdout, stderr } = await execFileAsync(
      "node",
      ["--experimental-strip-types", scriptPath],
      {
        env: {
          ...process.env,
          TURSO_DATABASE_URL: dbUrl,
          TURSO_AUTH_TOKEN: authToken,
          ALLOW_DB_RESET: "1",
        },
        timeout: 30_000,
      },
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const error = err as Error & { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      exitCode: error.code ?? 1,
    };
  }
}

describe("reset-db スクリプト", () => {
  let client: ReturnType<typeof createClient>;
  let tempDbUrl: string;
  let tempDir: string;

  beforeEach(() => {
    const { url, filePath } = makeTempDbUrl();
    tempDbUrl = url;
    tempDir = filePath;
    client = createClient({ url: tempDbUrl });
  });

  afterEach(() => {
    client?.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // 削除失敗は無視
    }
  });

  it("空のデータベースに対して正常終了できること", async () => {
    const { exitCode, stdout } = await runResetDb(tempDbUrl);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("[reset-db] All tables dropped");
  });

  it("2 回連続実行しても正常終了できること（idempotent）", async () => {
    const first = await runResetDb(tempDbUrl);
    expect(first.exitCode).toBe(0);

    const second = await runResetDb(tempDbUrl);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("[reset-db] All tables dropped");
  });

  it("ALLOW_DB_RESET=1 が未設定の場合はプロセスが終了コード1で終了すること", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const scriptPath = new URL("../../../apps/api/scripts/reset-db.ts", import.meta.url).pathname;

    const result = await execFileAsync("node", ["--experimental-strip-types", scriptPath], {
      env: {
        ...process.env,
        TURSO_DATABASE_URL: tempDbUrl,
        TURSO_AUTH_TOKEN: "",
        ALLOW_DB_RESET: undefined,
      },
      timeout: 10_000,
    }).then(
      () => ({ exitCode: 0, stderr: "" }),
      (err: Error & { stderr?: string; code?: number }) => ({
        exitCode: err.code ?? 1,
        stderr: err.stderr ?? "",
      }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ALLOW_DB_RESET=1");
  });

  it("本番相当の非ローカル URL の場合はプロセスが終了コード1で終了すること", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const scriptPath = new URL("../../../apps/api/scripts/reset-db.ts", import.meta.url).pathname;

    const result = await execFileAsync("node", ["--experimental-strip-types", scriptPath], {
      env: {
        ...process.env,
        TURSO_DATABASE_URL: "libsql://my-db-org.turso.io",
        TURSO_AUTH_TOKEN: "dummy",
        ALLOW_DB_RESET: "1",
      },
      timeout: 10_000,
    }).then(
      () => ({ exitCode: 0, stderr: "" }),
      (err: Error & { stderr?: string; code?: number }) => ({
        exitCode: err.code ?? 1,
        stderr: err.stderr ?? "",
      }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("non-local URL");
  });

  it("FTS virtual table と shadow tables を持つ DB でも正常終了できること", async () => {
    await client.execute("PRAGMA foreign_keys = OFF");
    await client.execute(
      "CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, title TEXT, body TEXT)",
    );
    await client.execute(
      "CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(title, body, content='articles', content_rowid='rowid')",
    );
    await client.execute(`
      CREATE TRIGGER IF NOT EXISTS articles_ai_fts
      AFTER INSERT ON articles BEGIN
        INSERT INTO articles_fts(rowid, title, body) VALUES (new.rowid, new.title, new.body);
      END
    `);
    await client.execute(`
      CREATE TRIGGER IF NOT EXISTS articles_ad_fts
      AFTER DELETE ON articles BEGIN
        INSERT INTO articles_fts(articles_fts, rowid, title, body) VALUES ('delete', old.rowid, old.title, old.body);
      END
    `);
    await client.execute(`
      CREATE TRIGGER IF NOT EXISTS articles_au_fts
      AFTER UPDATE ON articles BEGIN
        INSERT INTO articles_fts(articles_fts, rowid, title, body) VALUES ('delete', old.rowid, old.title, old.body);
        INSERT INTO articles_fts(rowid, title, body) VALUES (new.rowid, new.title, new.body);
      END
    `);
    await client.execute("PRAGMA foreign_keys = ON");

    const { exitCode, stdout, stderr } = await runResetDb(tempDbUrl);

    expect(exitCode, `stderr: ${stderr}`).toBe(0);
    expect(stdout).toContain("[reset-db] All tables dropped");

    const remaining = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'",
    );
    expect(remaining.rows).toHaveLength(0);
  });

  it("FK 参照を持つテーブル群でも正常終了できること", async () => {
    await client.execute("PRAGMA foreign_keys = OFF");
    await client.execute(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL)",
    );
    await client.execute(
      "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE)",
    );
    await client.execute(
      "CREATE TABLE IF NOT EXISTS verifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE)",
    );
    await client.execute("PRAGMA foreign_keys = ON");

    const { exitCode, stderr } = await runResetDb(tempDbUrl);

    expect(exitCode, `stderr: ${stderr}`).toBe(0);

    const remaining = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'",
    );
    expect(remaining.rows).toHaveLength(0);
  });
});
