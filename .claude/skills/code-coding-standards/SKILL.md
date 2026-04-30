---
name: code-coding-standards
description: TypeScriptコーディング規約。命名規則、禁止パターン、必須パターンを定義。
triggers:
  - "coding standards"
  - "コーディング規約"
  - "コード規約"
---

# コーディング規約スキル

## 禁止パターン

### any型の使用
```typescript
// ❌ 禁止
const data: any = ...

// ✅ 正しい: unknown + type guard
function isUser(value: unknown): value is User {
  return typeof value === "object" && value !== null && "id" in value;
}
```

### else文の使用
```typescript
// ❌ 禁止
if (user) {
  return success;
} else {
  return error;
}

// ✅ 正しい: 早期リターン
if (!user) {
  return error;
}
return success;
```

### 関数内コメント
```typescript
// ❌ 禁止
function getUser(id: string) {
  // DBから取得
  const user = db.get(id);
  return user;
}

// ✅ 正しい: JSDocで説明
/**
 * ユーザー情報を取得する
 * @param id ユーザーID（ULID形式）
 */
function getUser(id: string): User | null {
  return db.get(id);
}
```

### console.logの使用
```typescript
// ❌ 禁止
console.log(data);

// ✅ 正しい: loggerを使用
logger.info("データ取得完了", { userId: data.id });
```

### ハードコード
```typescript
// ❌ 禁止
const JWT_SECRET = "my-secret-123";

// ✅ 正しい: 環境変数
const JWT_SECRET = process.env.JWT_SECRET!;
```

## 必須パターン

### 関数ドキュメント（日本語JSDoc）
```typescript
/**
 * ユーザー情報を取得する
 * @param userId ユーザーID
 * @returns ユーザー情報。存在しない場合はnull
 */
async function getUserById(userId: string): Promise<User | null>
```

### エラーメッセージは日本語
```typescript
throw new Error("メールアドレスの形式が正しくありません");
```

### 早期リターン
```typescript
function validate(user: User | null): Result {
  if (!user) return { error: "ユーザーが見つかりません" };
  if (!user.email) return { error: "メールが未設定です" };
  return { valid: true };
}
```

## 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| 変数・関数 | camelCase | `getUserById` |
| 定数 | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| 型・クラス | PascalCase | `UserRepository` |
| ファイル | kebab-case | `user-repository.ts` |
| Boolean | is/has/can | `isActive`, `hasPermission` |
