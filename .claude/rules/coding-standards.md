# コーディング規約

## 📋 禁止パターン

### any型の使用
```typescript
// ❌ 禁止
const data: any = ...

// ✅ 正しい: unknown + type guard
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}

function process(data: unknown): string {
  if (isUser(data)) {
    return data.name;
  }
  throw new Error("不正なデータ形式です");
}
```

### else文の使用
```typescript
// ❌ 禁止
function process(user: User | null): Result {
  if (user) {
    if (user.isActive) {
      return { success: true, data: user };
    } else {
      return { success: false, error: "..." };
    }
  } else {
    return { success: false, error: "..." };
  }
}

// ✅ 正しい: 早期リターン
function process(user: User | null): Result {
  if (!user) {
    return { success: false, error: "ユーザーが見つかりません" };
  }
  if (!user.isActive) {
    return { success: false, error: "ユーザーは無効です" };
  }
  return { success: true, data: user };
}
```

### 関数内コメント
```typescript
// ❌ 禁止
function getUserById(id: string) {
  // データベースから取得
  const user = db.get(id);
  return user;
}

// ✅ 正しい: JSDocで説明
/**
 * ユーザー情報を取得する
 *
 * @param id - ユーザーID（ULID形式）
 * @returns ユーザー情報。存在しない場合はnull
 */
function getUserById(id: string): User | null {
  const user = db.get(id);
  return user;
}
```

### console.logの使用
```typescript
// ❌ 禁止
console.log(data);

// ✅ 正しい: loggerを使用
logger.info("データ取得完了", { userId: data.id });
logger.error("エラーが発生しました", { error });
```

### 未使用コード・import
```typescript
// ❌ 禁止
import { unused } from "lib";

function oldFunction() { } // 使われていない

// ✅ 即削除する
```

### ハードコード禁止

#### 機密情報（絶対禁止）
```typescript
// ❌ 絶対ダメ
const JWT_SECRET = "my-secret-123";
const DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
const API_KEY = "sk_live_abc123";

// ✅ 必須: 環境変数
const JWT_SECRET = process.env.JWT_SECRET!;
const DATABASE_URL = process.env.DATABASE_URL!;
const API_KEY = process.env.STRIPE_API_KEY!;
```

#### API URL・ポート番号
```typescript
// ❌ 禁止
const API_URL = "https://api.example.com";
const PORT = 3000;

// ✅ 正しい: 環境変数
const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const PORT = Number(process.env.PORT) || 3000;
```

#### マジックナンバー
```typescript
// ❌ 禁止
if (x > 100) { }
setTimeout(() => {}, 3600000);

// ✅ 正しい: 定数化 + コメント
/** 最大リトライ回数 */
const MAX_RETRY_COUNT = 100;

/** セッション有効期限（ミリ秒） */
const SESSION_TTL_MS = 3600000;

if (x > MAX_RETRY_COUNT) { }
setTimeout(() => {}, SESSION_TTL_MS);
```

#### 文字列リテラル（繰り返し使用）
```typescript
// ❌ 禁止: 同じ文字列を複数箇所で
if (status === "pending") {}
if (status === "pending") {}

// ✅ 正しい: Enum or 定数
const TaskStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

if (status === TaskStatus.PENDING) {}
```

#### ファイルパス
```typescript
// ❌ 禁止
const UPLOAD_DIR = "/var/www/uploads";
const CONFIG_PATH = "/etc/app/config.json";

// ✅ 正しい: 環境変数 or 相対パス
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, "config.json");
```

#### カラーコード（CSS）
```typescript
// ❌ 禁止: 生のカラーコード
<div className="bg-[#14b8a6]" />
<div style={{ color: "#ef4444" }} />

// ✅ 正しい: デザインシステムの色を使用
<div className="bg-primary-500" />
<div className="text-error" />
```

#### 日時フォーマット
```typescript
// ❌ 禁止: フォーマット文字列の散在
format(date, "yyyy-MM-dd HH:mm:ss");
format(createdAt, "yyyy-MM-dd HH:mm:ss");

// ✅ 正しい: 定数化
/** 標準日時フォーマット */
const DATETIME_FORMAT = "yyyy-MM-dd HH:mm:ss";
/** 日付のみフォーマット */
const DATE_FORMAT = "yyyy-MM-dd";
/** 時刻のみフォーマット */
const TIME_FORMAT = "HH:mm";

format(date, DATETIME_FORMAT);
```

#### バリデーション制限値
```typescript
// ❌ 禁止: マジックナンバー
if (password.length < 8) {}
if (name.length > 100) {}
if (items.length > 50) {}

// ✅ 正しい: 定数化 + コメント
/** パスワード最小文字数 */
const PASSWORD_MIN_LENGTH = 8;
/** 名前最大文字数 */
const NAME_MAX_LENGTH = 100;
/** 1ページあたりの最大件数 */
const PAGE_SIZE_MAX = 50;

if (password.length < PASSWORD_MIN_LENGTH) {}
if (name.length > NAME_MAX_LENGTH) {}
```

#### 正規表現パターン
```typescript
// ❌ 禁止: インラインで定義
if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {}

// ✅ 正しい: 定数化 + コメント
/** メールアドレスの正規表現 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
/** 電話番号の正規表現（日本） */
const PHONE_REGEX = /^0\d{9,10}$/;

if (EMAIL_REGEX.test(email)) {}
```

#### HTTPステータスコード
```typescript
// ❌ 禁止: 数値直接
return new Response(null, { status: 201 });
if (response.status === 404) {}

// ✅ 正しい: 定数使用
import { StatusCodes } from "http-status-codes";
// または独自定義
const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

return new Response(null, { status: HttpStatus.CREATED });
```

#### 定数化の判断基準

**✅ 定数化する**
| 条件 | 理由 | 例 |
|------|------|-----|
| 2回以上使う値 | DRY原則 | `API_URL` |
| ビジネスルール | 仕様変更時に1箇所で修正 | `PASSWORD_MIN_LENGTH` |
| 環境依存値 | 環境ごとに切り替え | `DATABASE_URL` |
| 意味が不明確な値 | 定数名がドキュメントになる | `CACHE_TTL_MS = 3600000` |
| 将来変更の可能性がある値 | 保守性向上 | `MAX_FILE_SIZE` |
| 1回のみでも説明が必要な値 | 可読性向上 | `TAX_RATE = 0.1` |

**❌ 定数化しない**
| 条件 | 理由 | 例 |
|------|------|-----|
| 自明な初期値 | 過度な抽象化 | `let count = 0` |
| 配列の先頭・末尾 | 慣用的 | `items[0]`, `items.at(-1)` |
| ループの開始値 | 慣用的 | `for (let i = 0; ...)` |
| 真偽値リテラル | 自明 | `isActive = true` |

```typescript
// 1回のみでも定数化すべき例
/** 消費税率（2024年現在） */
const TAX_RATE = 0.1;
const total = price * (1 + TAX_RATE);  // 意図が明確

// 定数化不要な例
let count = 0;  // 初期値0は自明
const first = items[0];  // 配列の先頭は慣用的
```

---

## 🎯 シンプルさの原則（KISS）

### 過度な抽象化の禁止
```typescript
// ❌ 禁止: 1回しか使わないのに抽象化
interface DataProcessor<T, R> {
  process(input: T): R;
}

class UserNameProcessor implements DataProcessor<User, string> {
  process(user: User): string {
    return user.name.toUpperCase();
  }
}

// ✅ 正しい: シンプルに書く
function formatUserName(user: User): string {
  return user.name.toUpperCase();
}
```

### 最小限の実装
```typescript
// ❌ 禁止: 使わない機能を先に作る
class UserService {
  getUser(id: string) { }
  getAllUsers() { }
  searchUsers(query: string) { }    // まだ使わない
  exportToCSV() { }                 // まだ使わない
  syncWithExternalAPI() { }         // まだ使わない
}

// ✅ 正しい: 今必要なものだけ
class UserService {
  getUser(id: string) { }
  getAllUsers() { }
}
```

### 早すぎる最適化の禁止
```typescript
// ❌ 禁止: 問題が起きる前に最適化
const cache = new Map();
function getUserWithCache(id: string) {
  if (cache.has(id)) return cache.get(id);
  const user = db.get(id);
  cache.set(id, user);
  return user;
}

// ✅ 正しい: まずシンプルに、問題が出たら最適化
function getUser(id: string) {
  return db.get(id);
}
```

### 関数は1つのことだけ
```typescript
// ❌ 禁止: 複数の責務
function processUser(user: User) {
  // バリデーション
  if (!user.email) throw new Error("...");
  // 保存
  db.save(user);
  // 通知
  sendEmail(user.email, "Welcome!");
  // ログ
  logger.info("User created");
}

// ✅ 正しい: 1関数1責務
function validateUser(user: User): void {
  if (!user.email) throw new Error("...");
}

function saveUser(user: User): void {
  db.save(user);
}

function notifyUser(email: string): void {
  sendEmail(email, "Welcome!");
}
```

### ネストは浅く
```typescript
// ❌ 禁止: 深いネスト
function process(data: Data) {
  if (data) {
    if (data.items) {
      for (const item of data.items) {
        if (item.isValid) {
          if (item.value > 0) {
            // 処理
          }
        }
      }
    }
  }
}

// ✅ 正しい: 早期リターンでフラットに
function process(data: Data) {
  if (!data?.items) return;

  for (const item of data.items) {
    if (!item.isValid) continue;
    if (item.value <= 0) continue;

    // 処理
  }
}
```

### シンプルさのチェックリスト

- [ ] この関数は1つのことだけしているか？
- [ ] このクラス/モジュールは本当に必要か？
- [ ] もっとシンプルな方法はないか？
- [ ] 今必要な機能だけを実装しているか？
- [ ] 将来のために余計なコードを書いていないか？
- [ ] ネストは2-3段階以内か？

---

## ✅ 必須パターン

### 関数ドキュメント（日本語JSDoc）
```typescript
/**
 * ユーザー情報を取得する
 *
 * @param userId - ユーザーID（ULID形式）
 * @returns ユーザー情報。存在しない場合はnull
 * @throws DatabaseError - DB接続エラー時
 */
async function getUserById(userId: string): Promise<User | null> {
  // 実装
}
```

### 変数には説明コメント
```typescript
/** 最大リトライ回数 */
const MAX_RETRY_COUNT = 3;

/** セッション有効期限（秒） */
const SESSION_TTL_SECONDS = 3600;

/** ユーザーの認証状態 */
const isAuthenticated = checkAuth();
```

### エラーメッセージは日本語
```typescript
// ✅ 正しい
throw new Error("メールアドレスの形式が正しくありません");
throw new Error(`ユーザー（ID: ${userId}）が見つかりません`);

// ❌ 禁止
throw new Error("Invalid email");
throw new Error("Error occurred");
```

### TDD（テスト駆動開発）
```typescript
// 1. テストを先に書く
describe("getUserById", () => {
  it("存在するユーザーを返す", async () => {
    const user = await getUserById("test-id");
    expect(user).not.toBeNull();
    expect(user?.id).toBe("test-id");
  });

  it("存在しないユーザーの場合nullを返す", async () => {
    const user = await getUserById("invalid-id");
    expect(user).toBeNull();
  });
});

// 2. 実装する
async function getUserById(userId: string): Promise<User | null> {
  // 実装
}
```

### 早期リターン
```typescript
/**
 * ユーザーのアクティブ状態を確認する
 */
function validateUser(user: User | null): ValidationResult {
  // ガード句で早期リターン
  if (!user) {
    return { valid: false, error: "ユーザーが見つかりません" };
  }
  if (!user.email) {
    return { valid: false, error: "メールアドレスが設定されていません" };
  }
  if (!user.isActive) {
    return { valid: false, error: "ユーザーは無効化されています" };
  }

  // 正常系は最後
  return { valid: true };
}
```

---

## 🏷️ 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| 変数・関数 | camelCase | `getUserById`, `isActive` |
| 定数 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_ENDPOINT` |
| 型・インターフェース | PascalCase | `User`, `ApiResponse` |
| クラス | PascalCase | `UserRepository`, `AuthService` |
| ファイル | kebab-case | `user-repository.ts`, `auth-service.ts` |
| Boolean変数 | is/has/can | `isActive`, `hasPermission`, `canEdit` |

---

## 🎯 三項演算子

```typescript
// ✅ 許可: 単純な条件
const status = isActive ? "有効" : "無効";
const label = count > 0 ? `${count}件` : "なし";

// ❌ 禁止: ネストした三項演算子
const result = a ? (b ? c : d) : e;

// ✅ 正しい: if文で書く
let result: string;
if (a) {
  result = b ? c : d;
} else {
  result = e;
}
```

---

## 📝 型定義

### 型ガード
```typescript
/**
 * User型のチェック
 */
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "email" in value
  );
}

/**
 * 配列のチェック
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}
```

### 厳格なnullチェック
```typescript
// ✅ 正しい
function getName(user: User | null): string {
  if (!user) {
    throw new Error("ユーザーが存在しません");
  }
  return user.name;
}

// ❌ 禁止: オプショナルチェーンの乱用
function getName(user?: User): string {
  return user?.name ?? "Unknown"; // 意図が不明確
}
```

---

## 🔒 importの整理

```typescript
// ✅ 正しい順序
// 1. 外部ライブラリ
import { z } from "zod";
import type { NextRequest } from "next/server";

// 2. 内部モジュール（絶対パス）
import { db } from "@/lib/database";
import type { User } from "@/types/user";

// 3. 相対パス
import { validateEmail } from "../utils/validation";
import type { Config } from "./config";

// ❌ 禁止: 未使用import
import { unused } from "lib"; // 即削除

// ❌ 禁止: デフォルトimportとnamed importの混在
import React, { useState, useEffect } from "react"; // Reactは使わないなら削除
```

---

## 📦 ファイル構成

```typescript
// ✅ 推奨構造
/**
 * ユーザーリポジトリ
 * データベース操作を抽象化
 */

// 型定義
export type User = {
  id: string;
  name: string;
  email: string;
};

// 定数
const TABLE_NAME = "users";

// ヘルパー関数（非公開）
function validateUserId(id: string): void {
  if (!id) {
    throw new Error("ユーザーIDが指定されていません");
  }
}

// 公開関数
export async function getUserById(userId: string): Promise<User | null> {
  validateUserId(userId);
  // 実装
}
```

---

## ⚠️ エラーハンドリング

```typescript
/**
 * カスタムエラークラス
 */
export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * エラーハンドリングの例
 */
async function getUser(id: string): Promise<User> {
  try {
    const user = await db.get(id);
    if (!user) {
      throw new Error(`ユーザー（ID: ${id}）が見つかりません`);
    }
    return user;
  } catch (error) {
    // ログ記録
    logger.error("ユーザー取得エラー", { userId: id, error });

    // エラーの再スロー
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError("ユーザー情報の取得に失敗しました", error);
  }
}
```

---

## 🧪 テストの書き方

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("getUserById", () => {
  beforeEach(() => {
    // セットアップ
  });

  it("正常系: 存在するユーザーを返す", async () => {
    const user = await getUserById("test-id");
    expect(user).not.toBeNull();
    expect(user?.id).toBe("test-id");
  });

  it("異常系: 存在しないユーザーの場合nullを返す", async () => {
    const user = await getUserById("invalid-id");
    expect(user).toBeNull();
  });

  it("異常系: 空文字の場合エラー", async () => {
    await expect(getUserById("")).rejects.toThrow("ユーザーIDが指定されていません");
  });
});
```
