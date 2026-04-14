# モバイル認証トークン保存・失効・再認証方針

親 Issue: #822  
初出: #852（設計文書作成）  
本改訂: #822（現行実装との同期）

---

## 1. トークン保存戦略

### 採用: expo-secure-store

モバイルアプリのトークン保存には `expo-secure-store` を採用する。

| 項目 | expo-secure-store | AsyncStorage |
|------|-------------------|--------------|
| 保存先 | iOS: Keychain / Android: Keystore | 平文ファイル (SQLite) |
| 暗号化 | OS レベルで暗号化済み | 暗号化なし |
| Jailbreak/Root 時のリスク | 低（ハードウェア保護） | 高（平文読み取り可） |
| 適したデータ | 認証トークン・機密情報 | 非機密の設定値・キャッシュ |

**実装箇所**: `apps/mobile/src/lib/secure-store.ts`

```
TOKEN_KEY        = "auth_token"        # Better Auth セッショントークン
REFRESH_TOKEN_KEY = "refresh_token"   # 独自リフレッシュトークン
```

### 保存データの最小化原則

- SecureStore には **トークン文字列のみ** を保存する
- ユーザー情報（user オブジェクト）は Zustand ストアのメモリ上にのみ保持する
- アプリ再起動時はトークンから `/api/auth/session` 経由でセッションを復元する

---

## 2. トークン種別と有効期限

### アクセストークン（Better Auth セッショントークン）

| 項目 | 値 |
|------|-----|
| 生成元 | Better Auth（`betterAuth()`） |
| 保存場所 | DB: `sessions.token` / クライアント: SecureStore |
| 有効期限 | Better Auth デフォルト（7日）※ `sessions.expiresAt` で管理 |
| 失効条件 | expiresAt 到達 / サーバー側でのセッション削除 |

> **現状の課題**: Better Auth の `session.expiresAt` がデフォルト設定（7日）のまま。
> モバイルアプリとしてより短い有効期限（例: 1時間）を設定すべきか検討が必要。
> → 派生 Issue 候補: **アクセストークン有効期限の短縮**

### リフレッシュトークン（独自実装）

| 項目 | 値 |
|------|-----|
| 生成元 | `generateRefreshToken()` (crypto.getRandomValues, 24バイト / 48文字 hex, 192bit エントロピー) |
| 保存場所 | DB: `refresh_tokens.token_hash`（SHA-256 ハッシュ） / クライアント: SecureStore |
| 有効期限 | セッションの `expiresAt` に準拠 |
| 失効条件 | セッション期限到達 / トークン再利用検知 / 明示的なサインアウト |

---

## 3. リフレッシュフロー

### 正常系: 自動リフレッシュ

```
クライアント                    APIサーバー
    |                              |
    |-- GET /api/* (with token) -->|
    |                              |-- 401 Unauthorized
    |<-- 401 ----------------------|
    |                              |
    |-- POST /api/auth/refresh --> |
    |   { refreshToken: "..." }    |-- tokenHash で DB 照合
    |                              |-- リフレッシュトークンをローテーション
    |<-- { token, refreshToken } --|
    |                              |
    |-- GET /api/* (new token) --> |
    |<-- 200 OK ------------------|
```

**実装箇所**: `apps/mobile/src/lib/api.ts` の `apiFetch()` / `refreshAccessToken()`

- 401 受信 → `refreshAccessToken()` 呼び出し
- リフレッシュ成功 → 新トークンで元リクエストをリトライ（1回のみ）
- リフレッシュ後のリトライも 401 → `SessionExpiredError` をスロー

### 異常系: リフレッシュ失敗

```
refreshAccessToken() が失敗する条件:
  - SecureStore にリフレッシュトークンなし → SessionExpiredError
  - /api/auth/refresh が非2xx → SessionExpiredError
  - レスポンスが期待形式でない → SessionExpiredError
  - ネットワークエラー → SessionExpiredError

SessionExpiredError が伝播する先:
  - apiFetch() → SessionExpiredError をスロー
  - useAuthStore.checkSession() → clearAuthTokens() + sessionExpiredMessage 設定
  - useAuthStore.handleSessionExpired() → clearAuthTokens() + sessionExpiredMessage 設定
```

**UI への反映**:
- `sessionExpiredMessage` が非 null の場合、ログイン画面でメッセージを表示
- メッセージ表示後は `clearSessionExpiredMessage()` を呼び出してクリア

### apiFetch のエラー分類

`apiFetch` は非 2xx / 非 JSON / ネットワーク失敗をすべて型付きエラーで表現する。
上位レイヤ（Zustand ストア、画面）はインスタンスチェックで分岐する。

| エラークラス | 発生条件 | 上位での扱い |
|---|---|---|
| `SessionExpiredError` | 401 受信後のリフレッシュが失敗 / リトライ後も 401 | ログアウト + `sessionExpiredMessage` |
| `ApiHttpError` | 非 2xx かつ業務エラー JSON 形式（`{success:false,error:...}`）でない応答 | 画面でエラートースト表示など |
| `ApiParseError` | 2xx だが JSON パース失敗（Content-Type 不整合含む） | 同上 |
| `ApiNetworkError` | fetch 自体の失敗、タイムアウト（15 秒） | 同上 |

業務エラー JSON（`{success:false,error:{code,message}}`）は例外として扱わず、呼び出し側が
`success === false` を見て分岐する設計。

**実装箇所**: `apps/mobile/src/lib/api.ts`

---

## 4. トークンローテーションと再利用検知

### ローテーション戦略

リフレッシュトークンは **毎回ローテーション** する。

```
[1回目] refreshToken: A → 使用後、DB上で A → B に更新
          previous_token_hash = hash(A), token_hash = hash(B)

[2回目] refreshToken: B → 使用後、DB上で B → C に更新
```

**実装箇所**: `apps/api/src/routes/auth.ts` の `POST /refresh`

### 再利用（リプレイ攻撃）検知

```
攻撃者が古い refreshToken: A を使って /api/auth/refresh を呼び出す:
  → DB で token_hash に一致なし
  → previous_token_hash で A が発見される
  → 該当レコードと関連セッションを強制失効（expiresAt を過去日時に設定）
  → AUTH_EXPIRED エラーを返す
```

この仕組みにより、盗まれたリフレッシュトークンによる不正アクセスを検知・無効化できる。

---

## 5. セッション終了フロー

### サインアウト

```
クライアント:
  1. POST /api/auth/sign-out を呼び出す（Authorization: Bearer <token>）
  2. 応答を受け取った後（成功/失敗を問わず）clearAuthTokens() を実行
     → SecureStore から token と refreshToken を削除
  3. Zustand ストアをリセット (user: null, session: null, isAuthenticated: false)
  ※ サーバー到達不能・API エラー時もローカルクリアは必ず実行される

サーバー:
  - POST /api/auth/sign-out ハンドラ（apps/api/src/routes/auth.ts）が
    Bearer トークンに紐づく sessions 行を削除する
  - refresh_tokens は onDelete: cascade で自動削除される
  - 該当 sessions 行が存在しない場合も冪等に 200 を返す
```

**実装箇所**:
- クライアント: `apps/mobile/src/stores/auth-store.ts` の `signOut()`
- サーバー: `apps/api/src/routes/auth.ts` の `POST /sign-out`

### アカウント削除

```
  1. DELETE /api/users/me を呼び出す
  2. サーバー: users テーブルから削除（ON DELETE CASCADE で sessions, refresh_tokens も連鎖削除）
  3. clearAuthTokens() → SecureStore クリア
  4. Zustand ストアをリセット
```

---

## 6. セッション復元フロー（アプリ起動時）

```
アプリ起動
  → useAuthStore.checkSession() 呼び出し
    → SecureStore から token を取得
    → token がない → isAuthenticated: false で終了（ログイン画面へ）
    → token あり → GET /api/auth/session を呼び出す
      → 成功 → user/session を Zustand に設定
      → SessionExpiredError → clearAuthTokens() + sessionExpiredMessage 設定
      → その他エラー → clearAuthTokens() + isAuthenticated: false
```

---

## 7. 脅威モデルと対策

### 7.1 Jailbreak / Root 対策

| 脅威 | 対策 | 状態 |
|------|------|------|
| SecureStore のデータ読み取り | iOS Keychain / Android Keystore による OS レベル暗号化 | 実装済み |
| リフレッシュトークンの盗難 | トークンローテーション + 再利用検知による強制失効 | 実装済み |
| アプリバイナリの改ざん | Expo EAS による署名 (AppStore/PlayStore 経由配布) | 実装済み |

> **現状のギャップ**: Jailbreak 検知ライブラリ（例: `expo-secure-store` の `requireAuthentication` オプション、または `jail-monkey`）は未導入。
> → 派生 Issue 候補: **Jailbreak/Root 検知の導入検討**

### 7.2 XSS / JSI インジェクション対策（React Native）

React Native はブラウザの DOM を持たないため、従来の XSS は基本的に発生しない。
ただし以下の点を考慮する：

| 脅威 | 対策 | 状態 |
|------|------|------|
| WebView 経由の JSI 攻撃 | WebView 未使用、または `originWhitelist` で制限 | 現時点で WebView 未使用 |
| サードパーティ npm パッケージ経由の悪意あるコード | `pnpm audit` の定期実行 | CI で要確認 |
| deeplink 経由の不正トークン注入 | `techclip://` スキームの trusted origins 制限 | 実装済み（`apps/api/src/auth/index.ts`） |

### 7.3 ネットワーク攻撃対策

| 脅威 | 対策 | 状態 |
|------|------|------|
| MITM（中間者攻撃） | HTTPS 強制（Cloudflare Workers のデフォルト） | 実装済み |
| トークン傍受 | Authorization: Bearer ヘッダー（HTTPS 上） | 実装済み |
| タイムアウトによる DoS | `REQUEST_TIMEOUT_MS = 15000` ms で AbortController | 実装済み |

---

## 8. 現実装のギャップと派生 Issue 候補

現時点で epic #822 のスコープ外として残っている検討事項を参考情報として列挙する。

| 優先度 | 課題 | 詳細 |
|--------|------|------|
| 中 | アクセストークン有効期限の明示的な設定 | Better Auth のデフォルト（7日）を明示的に設定し、モバイルユースケースに適した値（例: 1時間）を検討する |
| 中 | Jailbreak/Root 検知の導入検討 | ハイリスクユーザー向けのセキュリティ強化として検討。ただし UX への影響も考慮が必要 |
| 低 | リフレッシュトークン有効期限の独立した設定 | 現状はセッションの `expiresAt` をそのまま使用している。リフレッシュトークン専用の有効期限（例: 30日）を別途設けることを検討 |

---

## 9. アーキテクチャ概要図

```
┌─────────────────────────────────────────────┐
│  React Native (Expo)                         │
│                                              │
│  ┌──────────────┐    ┌────────────────────┐  │
│  │ Zustand      │    │ expo-secure-store  │  │
│  │ auth-store   │    │                    │  │
│  │ - user       │    │ - "auth_token"     │  │
│  │ - session    │    │ - "refresh_token"  │  │
│  │ - isAuth...  │    └────────────────────┘  │
│  └──────┬───────┘             ↑              │
│         │                     │              │
│  ┌──────▼───────────────────────────────┐    │
│  │ lib/api.ts (apiFetch)                │    │
│  │ - Bearer token 自動付与              │    │
│  │ - 401 → refreshAccessToken()        │    │
│  │ - SessionExpiredError → logout       │    │
│  └──────────────────────────────────────┘    │
└────────────────────┬────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────┐
│  Cloudflare Workers + Hono API               │
│                                              │
│  POST /api/auth/sign-in                      │
│    └─ Better Auth + refresh_tokens 発行      │
│                                              │
│  POST /api/auth/refresh                      │
│    └─ トークンローテーション + 再利用検知    │
│                                              │
│  GET  /api/auth/session                      │
│    └─ セッション検証                         │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Turso (libSQL)                         │  │
│  │ - sessions (Better Auth 管理)          │  │
│  │ - refresh_tokens (独自実装)            │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```
