---
name: owasp-check
description: OWASP Top 10チェック。Webアプリの主要脆弱性を検出。
triggers:
  - "owasp"
  - "OWASP"
  - "脆弱性チェック"
---

# OWASP Top 10 チェックスキル

## OWASP Top 10 (2021)

### A01: アクセス制御の不備
```typescript
// ❌ 脆弱
app.delete('/posts/:id', async (req, res) => {
  await db.delete(posts).where(eq(posts.id, req.params.id));
});

// ✅ 安全: 所有者チェック
app.delete('/posts/:id', async (req, res) => {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, req.params.id) });
  if (post.authorId !== req.user.id) {
    throw new ForbiddenError("権限がありません");
  }
  await db.delete(posts).where(eq(posts.id, req.params.id));
});
```

### A02: 暗号化の失敗
- [ ] パスワードはbcrypt（MD5/SHA1禁止）
- [ ] HTTPS必須
- [ ] 機密データは暗号化して保存

### A03: インジェクション
```typescript
// ❌ SQLインジェクション
db.execute(sql.raw(`SELECT * FROM users WHERE email = '${email}'`));

// ✅ パラメータ化
db.select().from(users).where(eq(users.email, email));
```

### A04: 安全でない設計
- [ ] 脅威モデリング実施
- [ ] 最小権限の原則
- [ ] 多層防御

### A05: セキュリティ設定ミス
- [ ] デフォルト認証情報を変更
- [ ] 不要な機能を無効化
- [ ] エラーメッセージに詳細を含めない

### A06: 脆弱で古いコンポーネント
```bash
# 脆弱性チェック
npm audit
```

### A07: 認証の不備
- [ ] 強力なパスワードポリシー
- [ ] ブルートフォース対策（レート制限）
- [ ] MFA対応

### A08: ソフトウェアとデータの整合性の不備
- [ ] 依存関係の整合性確認
- [ ] CI/CDパイプラインの保護

### A09: セキュリティログとモニタリングの不備
- [ ] ログイン試行のログ
- [ ] 不審なアクティビティの検知
- [ ] アラート設定

### A10: SSRF（サーバーサイドリクエストフォージェリ）
```typescript
// ❌ 脆弱: ユーザー入力URLをそのまま使用
const response = await fetch(userProvidedUrl);

// ✅ 安全: 許可リストでチェック
const allowedHosts = ['api.example.com'];
const url = new URL(userProvidedUrl);
if (!allowedHosts.includes(url.host)) {
  throw new Error("許可されていないホストです");
}
```

## 出力フォーマット

```markdown
## OWASP Top 10 チェック結果

| カテゴリ | 状態 | 問題 | 対策 |
|----------|------|------|------|
| A01 アクセス制御 | ✅/❌ | ... | ... |
| A02 暗号化 | ✅/❌ | ... | ... |
| ... | ... | ... | ... |

### 検出された脆弱性
...

### 推奨対策
...
```
