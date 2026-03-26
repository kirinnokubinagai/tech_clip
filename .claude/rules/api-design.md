# API設計規約

## 🌐 RESTful設計

### リソース指向URL
```
✅ 正しい: リソース名は複数形
GET    /users           # ユーザー一覧
POST   /users           # ユーザー作成
GET    /users/:id       # ユーザー詳細
PATCH  /users/:id       # ユーザー更新
DELETE /users/:id       # ユーザー削除

❌ 禁止: 動詞を含む
GET    /getUsers
POST   /createUser
POST   /users/delete/:id
```

### ネストされたリソース
```
✅ 正しい: 関連リソースをネスト（深さ2まで）
GET    /users/:userId/posts           # ユーザーの投稿一覧
POST   /users/:userId/posts           # 投稿作成
GET    /users/:userId/posts/:postId   # 投稿詳細

❌ 禁止: 深すぎるネスト
GET    /users/:userId/posts/:postId/comments/:commentId/likes
```

---

## 📊 レスポンス形式

### 統一レスポンス構造
```typescript
/**
 * 成功レスポンス
 */
type SuccessResponse<T> = {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasNext?: boolean;
  };
};

/**
 * エラーレスポンス
 */
type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// ✅ 正しい使用例
// 成功時
{
  "success": true,
  "data": {
    "id": "ulid_123",
    "email": "user@example.com",
    "name": "テストユーザー"
  }
}

// エラー時
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "入力内容を確認してください",
    "details": {
      "email": "メールアドレスの形式が正しくありません"
    }
  }
}
```

---

## 🔢 HTTPステータスコード

### 成功レスポンス
| コード | 用途 | 例 |
|--------|------|-----|
| 200 OK | 取得・更新成功 | GET, PATCH |
| 201 Created | 作成成功 | POST |
| 204 No Content | 削除成功 | DELETE |

### クライアントエラー
| コード | 用途 | エラーコード |
|--------|------|-------------|
| 400 Bad Request | リクエスト不正 | INVALID_REQUEST |
| 401 Unauthorized | 未認証 | AUTH_REQUIRED |
| 403 Forbidden | 権限なし | FORBIDDEN |
| 404 Not Found | リソースなし | NOT_FOUND |
| 409 Conflict | 競合 | CONFLICT |
| 422 Unprocessable Entity | バリデーションエラー | VALIDATION_FAILED |
| 429 Too Many Requests | レート制限 | RATE_LIMIT_EXCEEDED |

### サーバーエラー
| コード | 用途 | エラーコード |
|--------|------|-------------|
| 500 Internal Server Error | サーバーエラー | INTERNAL_ERROR |
| 503 Service Unavailable | サービス停止中 | SERVICE_UNAVAILABLE |

---

## 🏷️ エラーコード定義

```typescript
/**
 * エラーコード一覧
 */
export const ErrorCode = {
  // 認証・認可
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',

  // バリデーション
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_REQUEST: 'INVALID_REQUEST',

  // リソース
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE: 'DUPLICATE',

  // サーバー
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

/**
 * エラーメッセージ（日本語）
 */
export const ErrorMessage: Record<string, string> = {
  AUTH_REQUIRED: 'ログインが必要です',
  AUTH_INVALID: '認証情報が正しくありません',
  AUTH_EXPIRED: 'セッションの有効期限が切れました。再度ログインしてください',
  FORBIDDEN: 'この操作を実行する権限がありません',

  VALIDATION_FAILED: '入力内容を確認してください',
  INVALID_REQUEST: 'リクエストが正しくありません',

  NOT_FOUND: 'リソースが見つかりません',
  CONFLICT: '競合が発生しました',
  DUPLICATE: 'すでに登録されています',

  INTERNAL_ERROR: 'サーバーエラーが発生しました',
  SERVICE_UNAVAILABLE: 'サービスが一時的に利用できません',
  RATE_LIMIT_EXCEEDED: 'リクエストが多すぎます。しばらく待ってから再度お試しください',
};
```

---

## ✅ バリデーション

### Zodスキーマ
```typescript
import { z } from "zod";

/**
 * ユーザー作成APIのスキーマ
 */
export const CreateUserSchema = z.object({
  email: z
    .string({ required_error: "メールアドレスは必須です" })
    .email("メールアドレスの形式が正しくありません")
    .max(255, "メールアドレスは255文字以内で入力してください"),

  password: z
    .string({ required_error: "パスワードは必須です" })
    .min(8, "パスワードは8文字以上で入力してください")
    .max(128, "パスワードは128文字以内で入力してください"),

  name: z
    .string({ required_error: "名前は必須です" })
    .min(1, "名前を入力してください")
    .max(100, "名前は100文字以内で入力してください")
    .trim(),

  age: z
    .number({ required_error: "年齢は必須です" })
    .int("年齢は整数で入力してください")
    .min(0, "年齢は0以上で入力してください")
    .max(150, "年齢は150以下で入力してください")
    .optional(),
});

/**
 * バリデーション実行
 */
export async function createUser(req: Request, res: Response) {
  try {
    const validated = CreateUserSchema.parse(req.body);

    // 処理...
    return res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: '入力内容を確認してください',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }
    throw error;
  }
}
```

---

## 📄 ページネーション

### カーソルベース（推奨）
```typescript
/**
 * カーソルベースページネーション
 */
type CursorPaginationParams = {
  cursor?: string;
  limit?: number;
};

type CursorPaginationResponse<T> = {
  data: T[];
  meta: {
    nextCursor: string | null;
    hasNext: boolean;
  };
};

// リクエスト例
GET /posts?cursor=ulid_abc123&limit=20

// レスポンス例
{
  "success": true,
  "data": [...],
  "meta": {
    "nextCursor": "ulid_xyz789",
    "hasNext": true
  }
}
```

### オフセットベース
```typescript
/**
 * オフセットベースページネーション
 * （総数が必要な場合のみ使用）
 */
type OffsetPaginationParams = {
  page?: number;
  limit?: number;
};

type OffsetPaginationResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// リクエスト例
GET /users?page=2&limit=20

// レスポンス例
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 🔍 フィルタリング・ソート

### クエリパラメータ
```typescript
/**
 * フィルタリング・ソート例
 */
GET /posts?status=published&sort=-createdAt&limit=20

// パラメータ説明
{
  status: "published",        // フィルタ: 公開済み
  sort: "-createdAt",         // ソート: 作成日降順（-は降順）
  limit: 20                   // 件数制限
}

/**
 * 複数条件フィルタ
 */
GET /posts?tags=tech,design&author=user123

{
  tags: ["tech", "design"],   // タグで絞り込み
  author: "user123"           // 著者で絞り込み
}
```

---

## 🔐 認証ヘッダー

```typescript
/**
 * Bearer トークン
 */
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

/**
 * ミドルウェアで検証
 */
async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'ログインが必要です',
      },
    });
  }

  const token = authHeader.substring(7);  // "Bearer " を除去

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_INVALID',
        message: '認証情報が正しくありません',
      },
    });
  }
}
```

---

## 📝 APIドキュメント

### OpenAPI (Swagger)
```typescript
/**
 * @openapi
 * /users:
 *   post:
 *     summary: ユーザー作成
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: Password123
 *               name:
 *                 type: string
 *                 example: テストユーザー
 *     responses:
 *       201:
 *         description: 作成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       422:
 *         description: バリデーションエラー
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
```

---

## ⚡ パフォーマンス最適化

### フィールド選択
```typescript
/**
 * 必要なフィールドのみ取得
 */
GET /users/123?fields=id,name,email

// レスポンス
{
  "success": true,
  "data": {
    "id": "ulid_123",
    "name": "テストユーザー",
    "email": "user@example.com"
    // passwordやcreatedAtは含まれない
  }
}
```

### ETag キャッシング
```typescript
/**
 * ETag でキャッシュ制御
 */
router.get('/users/:id', async (req, res) => {
  const user = await getUserById(req.params.id);
  const etag = generateETag(user);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();  // Not Modified
  }

  res.setHeader('ETag', etag);
  res.json({ success: true, data: user });
});
```

---

## ✅ API設計チェックリスト

### URL設計
- [ ] リソース指向のURL
- [ ] 複数形の名詞を使用
- [ ] 適切なHTTPメソッド（GET/POST/PATCH/DELETE）
- [ ] ネストは深さ2まで

### レスポンス
- [ ] 統一されたレスポンス形式
- [ ] 適切なHTTPステータスコード
- [ ] 日本語エラーメッセージ
- [ ] エラーコード定義

### バリデーション
- [ ] すべての入力をZodで検証
- [ ] 詳細なエラーメッセージ
- [ ] 422 ステータスコード

### ページネーション
- [ ] カーソルベース or オフセットベース
- [ ] limit パラメータ（デフォルト: 20〜50）
- [ ] meta 情報を含む

### セキュリティ
- [ ] Bearer トークン認証
- [ ] レート制限実装
- [ ] CORS 設定
- [ ] 入力サニタイゼーション

### ドキュメント
- [ ] OpenAPI スキーマ作成
- [ ] リクエスト/レスポンス例
- [ ] エラーコード一覧
