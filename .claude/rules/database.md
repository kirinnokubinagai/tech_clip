# データベース操作規約

## 🗄️ Drizzle ORM

### スキーマ変更の原則

**必須ルール：**
1. **マイグレーションファイルは `drizzle-kit generate` で自動生成する**
2. **手動でSQLファイルを作成・編集しない**
3. **マイグレーションファイル経由でのみスキーマ変更を行う**

```bash
# ✅ 正しい: スキーマ変更 → 自動生成 → 適用
# 1. src/db/schema.ts を編集してスキーマを変更
pnpm drizzle-kit generate --name add_users_table  # 具体的な名前で生成
pnpm drizzle-kit migrate                          # マイグレーション適用

# ❌ 禁止: 曖昧な名前
pnpm drizzle-kit generate --name migration_1
pnpm drizzle-kit generate --name update

# ❌ 禁止: 手動でSQLファイル作成・編集
# drizzle/0001_xxx.sql を直接編集してはいけない

# ❌ 禁止: 直接プッシュ（マイグレーション履歴が残らない）
pnpm drizzle-kit push
drizzle-kit push
```

### なぜ `drizzle-kit push` を禁止するのか

| 項目 | `migrate` | `push` |
|------|-----------|--------|
| マイグレーション履歴 | ✅ 残る | ❌ 残らない |
| ロールバック | ✅ 可能 | ❌ 不可能 |
| チーム共有 | ✅ SQLファイルで共有 | ❌ 共有不可 |
| 本番環境適用 | ✅ 安全 | ❌ 危険 |
| バージョン管理 | ✅ Git管理可能 | ❌ 管理不可 |

### 正しいワークフロー

```bash
# 1. スキーマ定義ファイルを編集
# src/db/schema.ts を変更

# 2. マイグレーションファイル生成（必ず drizzle-kit generate を使用）
# --name で具体的な変更内容を指定する
pnpm drizzle-kit generate --name add_users_table

# 3. 生成されたSQLを確認（手動編集は禁止）
# drizzle/0001_add_users_table.sql の内容を確認
# ⚠️ 注意: このファイルを手動で編集しない！
#         スキーマを修正して再度 generate する

# 4. マイグレーション適用
pnpm drizzle-kit migrate

# 5. Gitにコミット
git add drizzle/ src/db/schema.ts
git commit -m "feat: add users table migration"
```

---

## 📋 スキーマ設計

### 命名規則

```typescript
// ✅ 正しい: snake_case
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// ❌ 禁止: camelCase
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  emailAddress: text('emailAddress'),  // ダメ
  createdAt: timestamp('createdAt'),   // ダメ
});
```

### 主キーの設計

```typescript
import { ulid } from 'ulid';

// ✅ 推奨: ULID（タイムスタンプ順・衝突なし）
export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => ulid()),
});

// ✅ 許可: UUID
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
});

// ❌ 禁止: 連番（分散環境で問題）
export const users = pgTable('users', {
  id: serial('id').primaryKey(),  // 避ける
});
```

### 外部キー制約

```typescript
// ✅ 正しい: 明示的な外部キー + onDelete指定
export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  author_id: text('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

// ❌ 禁止: onDelete 未指定
export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  author_id: text('author_id')
    .references(() => users.id),  // onDelete がない
});
```

### タイムスタンプカラム

```typescript
// ✅ 必須: created_at, updated_at
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * updated_at の自動更新トリガー
 */
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
```

---

## 🔍 クエリ実装

### N+1問題の回避

```typescript
// ❌ 禁止: N+1クエリ
async function getUsersWithPosts() {
  const allUsers = await db.select().from(users);

  for (const user of allUsers) {
    // ループ内でクエリ実行 → N+1問題
    const posts = await db.select().from(posts).where(eq(posts.authorId, user.id));
    user.posts = posts;
  }

  return allUsers;
}

// ✅ 正しい: JOIN で一発取得
async function getUsersWithPosts() {
  return await db
    .select()
    .from(users)
    .leftJoin(posts, eq(users.id, posts.authorId));
}
```

### ページネーション

```typescript
// ✅ 推奨: カーソルベース（大規模データに強い）
async function getPosts(cursor?: string, limit = 20) {
  return await db
    .select()
    .from(posts)
    .where(cursor ? lt(posts.id, cursor) : undefined)
    .orderBy(desc(posts.id))
    .limit(limit);
}

// ✅ 許可: オフセットベース（総数が必要な場合のみ）
async function getPosts(page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const [items, [{ count }]] = await Promise.all([
    db.select().from(posts).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(posts),
  ]);

  return { items, total: count };
}
```

### トランザクション

```typescript
// ✅ 正しい: トランザクション使用
async function transferMoney(fromId: string, toId: string, amount: number) {
  await db.transaction(async (tx) => {
    // 残高確認
    const [fromAccount] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, fromId))
      .for('update');

    if (fromAccount.balance < amount) {
      throw new Error("残高不足");
    }

    // 送金元から引く
    await tx
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${amount}` })
      .where(eq(accounts.id, fromId));

    // 送金先に足す
    await tx
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${amount}` })
      .where(eq(accounts.id, toId));
  });
}

// ❌ 禁止: トランザクションなし
async function transferMoney(fromId: string, toId: string, amount: number) {
  await db.update(accounts).set({ balance: sql`${accounts.balance} - ${amount}` }).where(eq(accounts.id, fromId));
  // ここでエラーが起きたら不整合！
  await db.update(accounts).set({ balance: sql`${accounts.balance} + ${amount}` }).where(eq(accounts.id, toId));
}
```

---

## 🔒 セキュリティ

### SQLインジェクション対策

```typescript
// ✅ 正しい: パラメータ化クエリ
async function getUserByEmail(email: string) {
  return await db
    .select()
    .from(users)
    .where(eq(users.email, email));
}

// ❌ 禁止: 生SQL文字列結合
async function getUserByEmail(email: string) {
  // SQLインジェクション脆弱性！
  return await db.execute(
    sql.raw(`SELECT * FROM users WHERE email = '${email}'`)
  );
}

// ✅ 正しい: sql テンプレートリテラル
async function searchUsers(keyword: string) {
  return await db.execute(
    sql`SELECT * FROM users WHERE name LIKE ${`%${keyword}%`}`
  );
}
```

### Row Level Security (RLS)

```sql
-- Supabase使用時は必須
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 自分の投稿のみ表示
CREATE POLICY "Users can view own posts"
ON posts FOR SELECT
USING (auth.uid() = author_id);

-- 自分の投稿のみ更新
CREATE POLICY "Users can update own posts"
ON posts FOR UPDATE
USING (auth.uid() = author_id);
```

---

## 📋 必須ルール（厳守）

### データベースORM
- **Drizzle ORM を使用する**（他のORMは使用しない）

### マイグレーション
- **`drizzle-kit generate` でマイグレーションファイルを自動生成する**
- **マイグレーションファイル名は具体的な変更内容を記述する**
  - 良い例: `add_users_table`, `add_email_index_to_users`, `add_posts_author_foreign_key`
  - 悪い例: `migration_1`, `update`, `changes`
- **`drizzle-kit migrate` でマイグレーションを適用する**
- **`drizzle-kit push` は禁止**（マイグレーション履歴が残らない）
- **マイグレーションファイルの手動作成・編集は禁止**

### ワークフロー
```bash
# 1. スキーマ変更
# src/db/schema.ts を編集

# 2. マイグレーション生成（名前は具体的に）
pnpm drizzle-kit generate --name add_users_table

# 3. マイグレーション適用
pnpm drizzle-kit migrate

# 4. Gitコミット
git add drizzle/ src/db/schema.ts
git commit -m "feat: add users table migration"
```
