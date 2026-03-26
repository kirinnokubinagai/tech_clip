# セキュリティ規約

## 🔐 パスワード管理

### ハッシュ化（必須）
```typescript
import { hash, compare } from "bcrypt";

/**
 * パスワードをハッシュ化
 * コスト12以上を使用（推奨: 12〜14）
 */
async function hashPassword(password: string): Promise<string> {
  const SALT_ROUNDS = 12;
  return await hash(password, SALT_ROUNDS);
}

/**
 * パスワード検証
 */
async function verifyPassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return await compare(plainPassword, hashedPassword);
}
```

### パスワードポリシー
```typescript
/**
 * パスワード要件
 */
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false  // プロジェクトに応じて
};

// ❌ 禁止: 平文保存
const user = { password: "Password123" };

// ❌ 禁止: 弱いハッシュ（MD5, SHA1）
const hash = md5(password);

// ✅ 正しい: bcryptでハッシュ化
const hashedPassword = await hashPassword(password);
```

---

## 🎫 認証・認可

### JWT トークン
```typescript
/**
 * トークン有効期限
 */
const TOKEN_EXPIRY = {
  accessToken: '15m',    // 15分〜1時間
  refreshToken: '7d',    // 7日〜30日
};

/**
 * JWTトークン生成
 */
function generateAccessToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: TOKEN_EXPIRY.accessToken }
  );
}

/**
 * リフレッシュトークン生成
 */
function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: TOKEN_EXPIRY.refreshToken }
  );
}
```

### Cookie設定（推奨）
```typescript
/**
 * HTTPOnly Cookie でトークン保存
 */
function setAuthCookie(c: Context, token: string) {
  setCookie(c, 'auth_token', token, {
    httpOnly: true,      // ✅ JavaScriptからアクセス不可
    secure: true,        // ✅ HTTPS のみ
    sameSite: 'Strict',  // ✅ CSRF対策
    maxAge: 60 * 15,     // 15分
    path: '/',
  });
}

// ❌ 禁止: localStorage にトークン保存
localStorage.setItem('token', token);  // XSS で盗まれる

// ❌ 禁止: httpOnly なしのCookie
setCookie(c, 'token', token, { httpOnly: false });
```

---

## ✅ 入力バリデーション（必須）

### Zod使用
```typescript
import { z } from "zod";

/**
 * ユーザー登録スキーマ
 */
const RegisterSchema = z.object({
  email: z
    .string()
    .email("メールアドレスの形式が正しくありません")
    .max(255, "メールアドレスは255文字以内で入力してください"),

  password: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください")
    .max(128, "パスワードは128文字以内で入力してください")
    .regex(/[A-Z]/, "大文字を含めてください")
    .regex(/[a-z]/, "小文字を含めてください")
    .regex(/[0-9]/, "数字を含めてください"),

  name: z
    .string()
    .min(1, "名前を入力してください")
    .max(100, "名前は100文字以内で入力してください")
    .trim(),
});

/**
 * バリデーション実行
 */
function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ValidationError(
      "入力内容を確認してください",
      result.error.errors
    );
  }

  return result.data;
}
```

### サニタイゼーション
```typescript
/**
 * HTMLエスケープ
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ✅ 正しい: エスケープ後に表示
const safeTitle = escapeHtml(userInput);

// ❌ 禁止: 生の入力をそのまま表示
<div>{userInput}</div>
```

---

## 🛡️ SQLインジェクション対策

### ORM使用（必須）
```typescript
import { db } from "@/lib/database";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * ✅ 正しい: ORMでパラメータ化
 */
async function getUserByEmail(email: string) {
  return await db.query.users.findFirst({
    where: eq(users.email, email),
  });
}

/**
 * ❌ 禁止: 生SQLに直接埋め込み
 */
async function getUserByEmailUnsafe(email: string) {
  // SQLインジェクションの脆弱性！
  return await db.execute(
    `SELECT * FROM users WHERE email = '${email}'`
  );
}

/**
 * ✅ 正しい: プリペアドステートメント
 */
async function getUserByEmailSafe(email: string) {
  return await db.execute(
    sql`SELECT * FROM users WHERE email = ${email}`
  );
}
```

---

## 🚫 XSS対策

### React自動エスケープ
```tsx
/**
 * ✅ 正しい: React は自動でエスケープ
 */
function UserProfile({ name }: { name: string }) {
  return <div>{name}</div>;  // 自動エスケープされる
}

/**
 * ❌ 禁止: dangerouslySetInnerHTML
 */
function UnsafeComponent({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * ✅ 正しい: サニタイズライブラリ使用
 */
import DOMPurify from "dompurify";

function SafeComponent({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

---

## 🔑 認可（Authorization）

### リソース所有者チェック
```typescript
/**
 * 投稿の所有者チェック
 */
async function deletePost(postId: string, userId: string) {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post) {
    throw new NotFoundError("投稿が見つかりません");
  }

  // ✅ 所有者チェック（必須）
  if (post.authorId !== userId) {
    throw new ForbiddenError("この投稿を削除する権限がありません");
  }

  await db.delete(posts).where(eq(posts.id, postId));
}
```

### ロールベースアクセス制御（RBAC）
```typescript
/**
 * ロール定義
 */
enum Role {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
}

/**
 * 権限チェック
 */
function requireRole(requiredRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole) {
      throw new UnauthorizedError("ログインが必要です");
    }

    const roleHierarchy = {
      [Role.ADMIN]: 3,
      [Role.MODERATOR]: 2,
      [Role.USER]: 1,
    };

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      throw new ForbiddenError("この操作を実行する権限がありません");
    }

    next();
  };
}

// 使用例
router.delete('/posts/:id', requireRole(Role.MODERATOR), deletePost);
```

---

## 🔐 機密情報の扱い

### 環境変数
```typescript
/**
 * ✅ 正しい: 環境変数から読み込み
 */
const JWT_SECRET = process.env.JWT_SECRET!;
const DATABASE_URL = process.env.DATABASE_URL!;
const API_KEY = process.env.STRIPE_API_KEY!;

// 起動時に必須環境変数をチェック
const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
  'STRIPE_API_KEY',
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(`環境変数 ${varName} が設定されていません`);
  }
});

/**
 * ❌ 禁止: ハードコード
 */
const secret = "my-secret-key-123";  // 絶対ダメ！
const apiKey = "sk_live_abc123";     // 絶対ダメ！
```

### .env ファイル
```bash
# .env.example （リポジトリにコミット可）
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=postgresql://user:pass@localhost:5432/db
STRIPE_API_KEY=your_stripe_key_here

# .env （.gitignore に追加、コミット禁止）
JWT_SECRET=actual_secret_value
DATABASE_URL=postgresql://...
STRIPE_API_KEY=sk_live_...
```

---

## 📋 ログ出力の注意

### 安全なログ
```typescript
import { logger } from "@/lib/logger";

/**
 * ✅ 正しい: 機密情報を除外
 */
logger.info("ユーザーログイン成功", {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
});

/**
 * ❌ 禁止: 機密情報をログに出力
 */
console.log("Password:", password);              // 絶対ダメ！
console.log("Token:", token);                    // 絶対ダメ！
console.log("Credit Card:", creditCardNumber);   // 絶対ダメ！
logger.debug("User data:", { ...user, password }); // ダメ！

/**
 * ✅ 正しい: 機密情報をマスク
 */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}

logger.info("ユーザー登録", {
  email: maskEmail(user.email),  // "te***@example.com"
});
```

---

## 🌐 CORS設定

```typescript
/**
 * CORS設定
 */
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * ❌ 禁止: すべてのオリジンを許可
 */
app.use(cors({ origin: '*' }));  // 本番環境では絶対ダメ！
```

---

## 🔒 HTTPS強制

```typescript
/**
 * 本番環境でHTTPS強制
 */
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
```

---

## 🛡️ レート制限

```typescript
import rateLimit from 'express-rate-limit';

/**
 * API レート制限
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分
  max: 100,                  // 100リクエスト/15分
  message: 'リクエストが多すぎます。しばらく待ってから再度お試しください。',
});

/**
 * ログインレート制限（厳しめ）
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,  // 5回/15分
  message: 'ログイン試行回数が上限に達しました。15分後に再度お試しください。',
});

app.use('/api/', apiLimiter);
app.post('/api/auth/login', loginLimiter, loginHandler);
```

---

## ✅ セキュリティチェックリスト

### 認証・認可
- [ ] パスワードはbcryptでハッシュ化（コスト12以上）
- [ ] JWTトークンに適切な有効期限
- [ ] HTTPOnly Cookie でトークン保存
- [ ] リソース所有者チェック実装

### 入力バリデーション
- [ ] すべての入力をZodでバリデーション
- [ ] HTMLエスケープ処理
- [ ] SQL インジェクション対策（ORM使用）

### 機密情報
- [ ] 環境変数で管理
- [ ] .env を .gitignore に追加
- [ ] ログに機密情報を出力しない

### ネットワーク
- [ ] CORS 設定適切
- [ ] HTTPS 強制（本番環境）
- [ ] レート制限実装

### その他
- [ ] 依存パッケージの脆弱性チェック（npm audit）
- [ ] セキュリティヘッダー設定（helmet.js）
- [ ] CSRFトークン実装
