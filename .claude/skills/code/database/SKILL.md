---
name: database
description: データベース設計・Drizzle ORM。スキーマ設計、マイグレーション、クエリ最適化。
triggers:
  - "database"
  - "データベース"
  - "drizzle"
  - "スキーマ設計"
---

# データベース設計スキル

## マイグレーションルール（厳守）

```bash
# ✅ 正しい: generate → ローカル Turso 経由で migrate
pnpm drizzle-kit generate --name add_users_table
pnpm dev:migrate   # ← 必ずこれを使う

# ❌ 禁止: push（履歴が残らない）
pnpm drizzle-kit push

# ❌ 禁止: drizzle-kit migrate を直接実行（TURSO_DATABASE_URL 未設定で失敗する）
pnpm drizzle-kit migrate
```

### `pnpm dev:migrate` の前提条件

ローカル Turso が起動していること。起動していなければ先に実行：

```bash
pnpm dev:e2e:up    # ローカル Turso dev 起動
pnpm dev:migrate   # マイグレーション適用
```

`pnpm dev:migrate` は `scripts/dev/migrate.sh` を呼び出し、Turso 起動チェック・環境変数設定・`drizzle-kit migrate` 実行を一括で行う。

## スキーマ設計

### 命名規則
```typescript
// ✅ snake_case
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ❌ camelCase禁止
created_at: timestamp('createdAt'),  // ダメ
```

### 主キー（ULID推奨）
```typescript
import { ulid } from 'ulid';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => ulid()),
});
```

### 外部キー（onDelete必須）
```typescript
export const posts = pgTable('posts', {
  author_id: text('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});
```

### タイムスタンプ（必須）
```typescript
created_at: timestamp('created_at').defaultNow().notNull(),
updated_at: timestamp('updated_at').defaultNow().notNull(),
```

## クエリ実装

### N+1回避
```typescript
// ❌ 禁止: ループ内クエリ
for (const user of users) {
  const posts = await db.select().from(posts).where(eq(posts.authorId, user.id));
}

// ✅ 正しい: JOIN
const result = await db
  .select()
  .from(users)
  .leftJoin(posts, eq(users.id, posts.authorId));
```

### トランザクション
```typescript
await db.transaction(async (tx) => {
  await tx.update(accounts).set({ balance: sql`balance - ${amount}` }).where(eq(accounts.id, fromId));
  await tx.update(accounts).set({ balance: sql`balance + ${amount}` }).where(eq(accounts.id, toId));
});
```

### ページネーション（カーソルベース）
```typescript
async function getPosts(cursor?: string, limit = 20) {
  return await db
    .select()
    .from(posts)
    .where(cursor ? lt(posts.id, cursor) : undefined)
    .orderBy(desc(posts.id))
    .limit(limit);
}
```

## ワークフロー
1. `src/db/schema.ts` を編集
2. `pnpm drizzle-kit generate --name 変更内容`
3. `pnpm dev:e2e:up`（Turso 未起動の場合）
4. `pnpm dev:migrate`
5. Git コミット
