---
name: code-api-design
description: RESTful API設計。リソース指向URL、レスポンス形式、エラーハンドリングを定義。
triggers:
  - "api design"
  - "API設計"
  - "エンドポイント設計"
---

# API設計スキル

## RESTful設計

### リソース指向URL
```
✅ 正しい
GET    /users           # 一覧
POST   /users           # 作成
GET    /users/:id       # 詳細
PATCH  /users/:id       # 更新
DELETE /users/:id       # 削除

❌ 禁止
GET    /getUsers
POST   /createUser
```

### ネスト（深さ2まで）
```
GET    /users/:userId/posts           # OK
GET    /users/:userId/posts/:postId   # OK
GET    /users/:id/posts/:id/comments/:id/likes  # ❌ 深すぎ
```

## レスポンス形式

```typescript
// 成功
type SuccessResponse<T> = {
  success: true;
  data: T;
  meta?: { page?: number; total?: number; };
};

// エラー
type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

## HTTPステータスコード

| コード | 用途 |
|--------|------|
| 200 | 取得・更新成功 |
| 201 | 作成成功 |
| 204 | 削除成功 |
| 400 | リクエスト不正 |
| 401 | 未認証 |
| 403 | 権限なし |
| 404 | リソースなし |
| 422 | バリデーションエラー |
| 429 | レート制限 |
| 500 | サーバーエラー |

## エラーコード

```typescript
const ErrorCode = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
} as const;

const ErrorMessage = {
  AUTH_REQUIRED: 'ログインが必要です',
  VALIDATION_FAILED: '入力内容を確認してください',
  NOT_FOUND: 'リソースが見つかりません',
  FORBIDDEN: '権限がありません',
};
```

## バリデーション（Zod必須）

```typescript
const CreateUserSchema = z.object({
  email: z.string().email("メール形式が正しくありません"),
  password: z.string().min(8, "8文字以上で入力してください"),
});
```

## ページネーション

```typescript
// カーソルベース（推奨）
GET /posts?cursor=ulid_abc&limit=20

// レスポンス
{
  "data": [...],
  "meta": { "nextCursor": "ulid_xyz", "hasNext": true }
}
```
