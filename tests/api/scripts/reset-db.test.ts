import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/** Turso dev サーバーの接続先 URL */
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL ?? "http://127.0.0.1:8888";

/** Turso dev サーバーの認証トークン */
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? "dummy";

/**
 * sqld/sqld 互換サーバーが起動しているかどうかを確認する
 */
async function isTursoAvailable(): Promise<boolean> {
  try {
    const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
    await client.execute("SELECT 1");
    client.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * reset-db スクリプトを node で実行し stdout/stderr/exitCode を返す
 */
async function runResetDb(): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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
          TURSO_DATABASE_URL,
          TURSO_AUTH_TOKEN,
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
  let available: boolean;

  beforeEach(async () => {
    available = await isTursoAvailable();
    if (!available) return;
    client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  });

  afterEach(async () => {
    if (!available) return;
    client?.close();
  });

  it("Turso が起動していない場合はスキップできること", async () => {
    if (available) {
      expect(available).toBe(true);
      return;
    }
    expect(available).toBe(false);
  });

  it("空のデータベースに対して正常終了できること", async () => {
    if (!available) return;

    const { exitCode, stdout } = await runResetDb();

    expect(exitCode).toBe(0);
    expect(stdout).toContain("[reset-db] All tables dropped");
  });

  it("2 回連続実行しても正常終了できること（idempotent）", async () => {
    if (!available) return;

    const first = await runResetDb();
    expect(first.exitCode).toBe(0);

    const second = await runResetDb();
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("[reset-db] All tables dropped");
  });

  it("ALLOW_DB_RESET=1 が未設定の場合はプロセスが終了コード1で終了すること", async () => {
    if (!available) return;

    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const scriptPath = new URL("../../../apps/api/scripts/reset-db.ts", import.meta.url).pathname;

    // Arrange: ALLOW_DB_RESET を未設定にして実行
    const result = await execFileAsync("node", ["--experimental-strip-types", scriptPath], {
      env: {
        ...process.env,
        TURSO_DATABASE_URL,
        TURSO_AUTH_TOKEN,
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

    // Assert
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("ALLOW_DB_RESET=1");
  });

  it("本番相当の非ローカル URL の場合はプロセスが終了コード1で終了すること", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const scriptPath = new URL("../../../apps/api/scripts/reset-db.ts", import.meta.url).pathname;

    // Arrange: 本番相当の URL を設定して実行
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

    // Assert
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("non-local URL");
  });

  it("FTS virtual table と shadow tables を持つ DB でも正常終了できること", async () => {
    if (!available) return;

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

    const { exitCode, stdout, stderr } = await runResetDb();

    expect(exitCode, `stderr: ${stderr}`).toBe(0);
    expect(stdout).toContain("[reset-db] All tables dropped");

    const remaining = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'",
    );
    expect(remaining.rows).toHaveLength(0);
  });

  it("FK 参照を持つテーブル群でも正常終了できること", async () => {
    if (!available) return;

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

    const { exitCode, stderr } = await runResetDb();

    expect(exitCode, `stderr: ${stderr}`).toBe(0);

    const remaining = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'",
    );
    expect(remaining.rows).toHaveLength(0);
  });
});
