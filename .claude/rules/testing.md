# テスト規約

テストコードの書き方に関する規約。

---

## 📁 ファイル配置

```
tests/
├── api/              # API テスト（apps/api/src/ 配下の実装に対応）
│   ├── routes/       # ルートテスト
│   ├── middleware/   # ミドルウェアテスト
│   ├── services/     # サービステスト（parsers/ サブディレクトリ含む）
│   ├── db/           # スキーマ・シードテスト（schema/ サブディレクトリ含む）
│   ├── lib/          # ユーティリティテスト
│   ├── auth/         # 認証テスト
│   ├── validators/   # バリデータテスト
│   ├── cron/         # Cronジョブテスト
│   └── integration/  # 統合テスト
├── mobile/           # Mobile テスト（apps/mobile/ 配下の実装に対応）
│   ├── screens/      # 画面テスト
│   ├── components/   # コンポーネントテスト（ui/ サブディレクトリ含む）
│   ├── stores/       # ストアテスト
│   ├── hooks/        # フックテスト
│   └── lib/          # ユーティリティテスト（utils/ も含む）
└── e2e/              # E2Eテスト（既存のまま）
```

**規約：**
- テストファイルは `tests/` ディレクトリに集約する
- `*.test.ts` または `*.test.tsx` 形式
- 実装ファイルのディレクトリ構造に対応したサブディレクトリに配置する
- importパスは `tests/` から実装ファイルへの相対パスを使用する（例: `../../../apps/api/src/routes/articles`）
- `@/` エイリアスは jest/vitest の moduleNameMapper 設定により引き続き利用可能

---

## 🏷️ 命名規則

```typescript
describe("User", () => {
  describe("create", () => {
    // ✅ 正しい：「〜すること」形式（日本語）
    it("有効なデータで作成できること", () => {});
    it("メールが空の場合エラーになること", () => {});
    it("重複メールの場合エラーになること", () => {});
  });

  describe("update", () => {
    it("名前を更新できること", () => {});
    it("存在しないユーザーの場合エラーになること", () => {});
  });
});
```

**規約：**
- `describe`: クラス名 → メソッド名の階層構造
- `it`: 「〜できること」「〜になること」で終わる日本語
- テスト名だけで何をテストしているか理解できるようにする

---

## 🎨 AAA パターン（必須）

```typescript
it("ユーザーを作成できること", () => {
  // Arrange（準備）: テストデータ・前提条件を用意
  const input = {
    email: "test@example.com",
    password: "Password123",
    name: "テストユーザー"
  };

  // Act（実行）: テスト対象の処理を実行
  const result = User.create(input);

  // Assert（検証）: 結果を検証
  expect(result.isOk()).toBe(true);
  expect(result.value.email).toBe(input.email);
  expect(result.value.name).toBe(input.name);
});
```

**規約：**
- Arrange/Act/Assert を明確に分離
- コメントで区切りを明示
- 1テストケースにつき1つの Assert が理想

---

## 🧪 テストコードの構造

### 基本構造
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { User } from "./user";

describe("User.create", () => {
  // ✅ 正常系
  it("有効なデータで作成できること", () => {
    const result = User.create({
      email: "test@example.com",
      password: "Password123",
      name: "テストユーザー"
    });

    expect(result.isOk()).toBe(true);
    expect(result.value).toMatchObject({
      email: "test@example.com",
      name: "テストユーザー"
    });
  });

  // ✅ 異常系
  it("メール形式不正でエラーになること", () => {
    const result = User.create({
      email: "invalid-email",
      password: "Password123",
      name: "テストユーザー"
    });

    expect(result.isErr()).toBe(true);
    expect(result.error.message).toContain("メール");
  });

  // ✅ 境界値テスト
  it("パスワードが7文字の場合エラーになること", () => {
    const result = User.create({
      email: "test@example.com",
      password: "Pass123",  // 7文字
      name: "テストユーザー"
    });

    expect(result.isErr()).toBe(true);
  });
});
```

**規約：**
- 正常系・異常系・境界値を必ず含める
- テスト間の依存を作らない（独立して実行可能）

---

## 🎭 モック・スタブ

### モック使用規約
```typescript
import { describe, it, expect, vi } from "vitest";
import { sendEmail } from "@/lib/email";

// ✅ 正しい: モック定義を明示
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn()
}));

describe("registerUser", () => {
  it("登録後にウェルカムメールを送信すること", async () => {
    const result = await registerUser({
      email: "test@example.com",
      password: "Password123",
      name: "テストユーザー"
    });

    expect(result.isOk()).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith({
      to: "test@example.com",
      subject: expect.stringContaining("ようこそ"),
      body: expect.any(String)
    });
  });
});
```

**規約：**
- 外部依存（DB、API等）は必ずモック
- モックの呼び出しを検証
- モックの戻り値を明示的に設定

---

## 📐 アサーション

### アサーションの書き方
```typescript
// ✅ 正しい: 明確なアサーション
expect(result.isOk()).toBe(true);
expect(result.value.id).toBeDefined();
expect(result.value.email).toBe("test@example.com");

// ✅ 正しい: オブジェクトの部分一致
expect(result.value).toMatchObject({
  email: "test@example.com",
  name: "テストユーザー"
});

// ✅ 正しい: 配列の検証
expect(users).toHaveLength(3);
expect(users).toContainEqual({ id: "123", name: "テスト" });

// ❌ 禁止: 曖昧なアサーション
expect(result).toBeTruthy();  // 何を検証しているか不明確
expect(user).toBeDefined();   // 具体的な値を検証すべき
```

**規約：**
- 具体的な値を検証
- `toBeTruthy()`/`toBeFalsy()` は避ける
- エラーメッセージの内容も検証

---

## 🚫 禁止パターン

```typescript
// ❌ テストをスキップ
it.skip("このテストは後で修正する", () => {});
test.todo("実装予定のテスト");

// ❌ テストを無効化
// it("重要なテスト", () => {});

// ❌ 曖昧なテスト名
it("動作すること", () => {});
it("テスト1", () => {});

// ❌ console.log でデバッグ
it("テスト", () => {
  console.log(result);  // デバッグ用コードを残さない
  expect(result).toBe(true);
});

// ❌ 複数の関心事を1つのitに詰め込む
it("ユーザー操作全般", () => {
  // 作成、更新、削除を1つのテストで検証 → 分離すべき
});
```

**規約：**
- テストのスキップ禁止
- デバッグコードを残さない
- 1つのテストで1つの関心事のみ検証
