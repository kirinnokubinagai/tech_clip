# Release Candidate 回帰確認レポート (2026-04)

## メタ情報

- 実施日時: 2026-04-15 11:45 JST
- 実施者: issue-905-coder (CI エージェント)
- 対象コミット: 82cd4f50
- 対象ブランチ: main
- 親 Issue: #900 / 本 Issue: #905

---

## 1. Open PR 取り込み状況

親 Issue #900 に列挙された blocker PR および関連 Issue の最終状態を確認した。

### Blocker PR 一覧

| PR 番号 | タイトル | 最終状態 |
|---------|---------|---------|
| #895 | fix(ci): fix ZAP scan failures - sign-up HTTP 500 and active scan timeout | MERGED |
| #885 | refactor(ui): 主要画面の配色を共通カラートークン基準に整理 #856 | MERGED |
| #874 | feat(follows): フォロワー・フォロー中一覧を follow API に接続 #845 | MERGED |
| #873 | feat(profile): 他ユーザープロフィール画面を公開プロフィール API に接続 #844 | MERGED |
| #872 | feat(profile): 自分のプロフィール画面を auth state / users API に接続 #828 | MERGED |
| #867 | docs(product): README の対応ソース表記を実装状態に同期 #826 | MERGED |
| #879 | refactor(a11y): accessibilityLabel / accessibilityHint を翻訳キー経由に統一 #850 | MERGED |
| #876 | refactor(i18n): onboarding・ホーム・記事詳細のハードコード文言を翻訳キーへ移行 #848 | MERGED |
| #880 | test(i18n): 英語ロケールで主要画面が成立することを自動テストで保証 #851 | MERGED |
| #882 | test(api): セッション期限切れ・refresh失敗・非JSON応答の異常系テストを追加 #854 | MERGED |
| #890 | fix(ci): CI用の軽量nix devShellを分離してビルド安定性を向上 | CLOSED（not merged） |
| #892 | feat: PRコンフリクト自動検出・深層解消フロー実装 | MERGED |
| #899 | fix: poll スクリプトのエラーハンドリングと .gitignore 整備 | MERGED |

### Blocker Issue 一覧

| Issue 番号 | 内容 | 最終状態 |
|-----------|------|---------|
| #893 | ZAP scan failures | CLOSED |
| #897 | auto-merge fail-safe | CLOSED |
| #898 | uncached verification path | CLOSED |
| #856 | theme consistency | CLOSED |
| #828 | profile/self | CLOSED |
| #844 | profile/other | CLOSED |
| #845 | follows | CLOSED |
| #826 | README sync | CLOSED |

### 残存

#890 は CLOSED（not merged）。当 PR は CI 軽量化の試みであり、代替手段で対応済みのため影響なし。  
blocker として列挙された PR・Issue はすべて解消済み。

---

## 2. コード品質チェック結果

RELEASE_CHECKLIST セクション 1 を RC コミット（82cd4f50）上で実行した結果を記録する。

| 項目 | コマンド | 結果 | 備考 |
|------|---------|------|------|
| 全テスト（API） | `pnpm --filter @tech-clip/api test` | PASS (101 suites / 1486 tests) | vitest 4.1.1、所要 7.55s |
| 全テスト（Mobile） | `pnpm --filter @tech-clip/mobile test` | PASS (76 suites / 940 tests) | Jest、所要 16.4s |
| Biome check | `pnpm biome check .` | PASS | 420 ファイルチェック、エラー 0 件 |
| 型チェック API | `pnpm --filter @tech-clip/api typecheck` | PASS | tsc --noEmit、エラー 0 件 |
| 型チェック Mobile | `pnpm --filter @tech-clip/mobile typecheck` | PASS | tsc --noEmit、エラー 0 件 |
| API ビルド | `pnpm --filter @tech-clip/api build` | PASS | Total Upload: 3789.20 KiB / gzip: 630.09 KiB（1MB 制限内） |
| Expo export | `npx expo export` | FAIL | `react-native-css-interop/jsx-runtime` 解決エラー。NativeWind v4 の pnpm ホイスト問題。詳細は § 5 参照 |

### API ビルドサイズ

wrangler deploy --dry-run の結果: Total Upload 3789.20 KiB（gzip 630.09 KiB）。Cloudflare Workers の 1MB 制限以内。

### Expo export について

`npx expo export` 実行時に以下のエラーが発生した:

```
Error: Unable to resolve module react-native-css-interop/jsx-runtime from apps/mobile/app/(auth)/_layout.tsx:
react-native-css-interop could not be found within the project
```

`react-native-css-interop` は pnpm の `.pnpm` 内部にインストールされているが、Metro bundler のモジュール解決が pnpm の hoist 構造に対応していないことが原因と考えられる。  
この問題は実機ビルド（EAS Build）では発生しない可能性があるが、ローカルでの export は未確認のまま。  
後続 Issue #902/#903（ストアビルド）にて確認が必要。

---

## 3. セキュリティ監査結果

### .env の Git 履歴チェック

```bash
git log --all --full-history -- "*.env" "**/.env"
```

結果: 出力なし。.env ファイルの Git 履歴コミットは確認されなかった。PASS

### ハードコードシークレット grep

```bash
grep -rE "sk_live|sk_test|password\s*=|secret\s*=" apps/ packages/ --include="*.ts"
```

結果: 出力なし（テスト・スペック・モック・.d.ts を除外）。ハードコードシークレットは検出されなかった。PASS

> **検査範囲の制限（重要）**: 今回の grep は `--include="*.ts"` オプションにより `.ts` ファイルのみを対象としている。**`.tsx` / `.json` / `.yaml` / `.env` 等の設定ファイルは本 grep の対象外**であり、これらのファイルに含まれるシークレットは確認されていない。別途手動確認または追加 grep が必要。次回リリース監査では `--include="*.{ts,tsx,json,yaml,yml}"` 等に拡大することを推奨。

### pnpm audit --audit-level=high 結果

```
4 vulnerabilities found
Severity: 1 low | 2 moderate | 1 high
```

検出された脆弱性の詳細:

| 深刻度 | パッケージ | 内容 | パス |
|-------|-----------|------|------|
| high | nodemailer | addressparser の再帰呼び出しによる DoS 脆弱性 (GHSA-rcmh-qjqh-p98v) | apps__api>nodemailer |
| moderate | nodemailer | 意図しないドメインへのメール送信 | apps__api>nodemailer |
| moderate | nodemailer | SMTP コマンドインジェクション | apps__api>nodemailer |
| low | nodemailer | SMTP コマンドインジェクション（別経路） | apps__api>nodemailer |

対応方針: nodemailer のパッチバージョン（>=7.0.11）へのアップデートで解消可能。本リリースでは accepted risk とし、#905 後続でアップデート Issue を起票する（§ 5 参照）。nodemailer は `apps/api/package.json` の **`devDependencies`** に分類されており、`wrangler deploy` による Workers バンドルには含まれない。開発・テスト用メール送信（Mailpit 連携）にのみ使用されているため、本番環境への直接的な影響はない。

---

## 4. 主要導線 回帰確認

自動テスト（API: vitest 101 suites、Mobile: Jest 76 suites）でカバーされる導線はテスト結果を引用する。実機が必要な確認は #904 に引き継ぐ。

| 導線 | 手段 | 結果 | 備考 |
|------|------|------|------|
| 認証フロー（sign-up / sign-in / sign-out） | 自動テスト | PASS | API tests: auth routes 含む 1486 tests 全 PASS。#854 の異常系テストも含む |
| 記事一覧表示 | 自動テスト | PASS | API articles routes / Mobile ArticleList コンポーネントテスト PASS |
| 記事詳細表示 | 自動テスト | PASS | API article detail / Mobile ArticleDetail 関連テスト PASS |
| AI 要約 | 自動テスト（部分） | 対象外（#904 に引き継ぐ） | Workers AI の疎通確認は staging 環境が必要。#904 smoke test にて確認 |
| オフライン保存・閲覧 | 自動テスト | PASS | OfflineBanner.test.tsx PASS。実機での動作確認は #904 に引き継ぐ |
| プロフィール・フォロー（#828/#844/#845 関連） | 自動テスト | PASS | Mobile profile/follows 関連テスト PASS。実機 UI 確認は #904 に引き継ぐ |

### #904 への引き継ぎ事項

以下の導線は実機またはステージング環境が必要なため #904（staging / production smoke test）で確認する:

- AI 要約機能（Workers AI API 疎通）
- プッシュ通知（端末依存）
- オフライン保存・閲覧の実機動作
- アプリ起動時間・スクロール FPS 計測

---

## 5. Blocker / Accepted Risk / Follow-up 整理

### 残存 blocker

なし。blocker となる PR・Issue はすべて解消済み（§ 1 参照）。

### Accepted Risk（本リリースで受け入れるリスク）

| リスク | 根拠 |
|-------|------|
| nodemailer 脆弱性（high 1件 / moderate 2件 / low 1件） | nodemailer は開発・テスト用途（Mailpit連携）のみで使用。本番 API ではメール送信に使用していない。DoS リスクは開発環境限定と判断 |
| Expo export ローカル失敗 | **現時点では未確認**。EAS Build（クラウドビルド）では再現しない可能性が高いが、実際の再現有無は未確認。#902/#903 のストアビルド実行後に本レポート § 7 条件 1 のステータスを更新すること |
| i18n 英語 plural 形未対応（#977） | UI 表示のみの問題で機能に影響なし。次リリースで対応 |
| 残存ハードコード文言・相対時間表記（#958） | 画面表示のみの問題。次リリースで対応 |

### Follow-up Issue（次リリース以降）

- #977 fix(i18n): 英語 plural 形対応（1 day ago / 1 week ago）
- #958 bug(mobile/i18n): 残存ハードコード文言と相対時間表記の locale 非対応を解消する
- #822 epic(auth): モバイル認証トークン運用と API クライアントの堅牢性を強化する
- #821 epic(profile): プロフィール・フォロー導線をプレースホルダーから本実装へ置き換える（一部対応済み）
- nodemailer アップデート（>=7.0.11）: 脆弱性解消のため別途 Issue を起票する

---

## 6. Rollback / Incident / Monitoring 確認

### Rollback 手順の所在と実行可能性

| ドキュメント | 内容 | 最新性 |
|------------|------|-------|
| `docs/RELEASE_CHECKLIST.md` § 8 | API（Cloudflare Workers）/ DB（Drizzle） / Mobile（EAS / Store）ロールバック手順を記載 | 最新。`wrangler rollback <deployment-id>` コマンドが記載されており、wrangler 4.62.0 で実行可能 |
| `docs/DB_MIGRATION_ROLLBACK.md` | Turso/libSQL のマイグレーションロールバック詳細手順を記載 | 最新。`scripts/generate-rollback.sh` によるロールバック SQL 生成手順が記載済み |

`wrangler deployments list` の実行権限は Cloudflare アカウントへのログイン（`wrangler whoami`）が必要。本 Issue の範囲ではアカウント権限の実確認は対象外（#908 に委譲）。

### Incident 連絡先

本番シークレット・外部サービス設定確認（#908）の担当者が確認済みの場合、Slack #release-ops チャンネルにエスカレーションする。  
個人連絡先の記載は機密情報保護のため本レポートには含めない。

### Monitoring Dashboard

| 項目 | 参照先 |
|------|-------|
| Cloudflare Workers メトリクス | Cloudflare Dashboard > Workers & Pages > tech-clip-api > Analytics |
| Workers エラーログ | Cloudflare Dashboard > Workers & Pages > tech-clip-api > Logs（Real-time logs） |
| エラーレート閾値 | 1% 以下（`docs/RELEASE_CHECKLIST.md` § 7-3 参照） |
| 平均レスポンスタイム閾値 | 500ms 以下（`docs/RELEASE_CHECKLIST.md` § 7-3 参照） |

アクセス権は Cloudflare アカウントメンバーに限定される。#908 にて権限確認を実施すること。

---

## 7. 判定

**回帰確認としての判定: CONDITIONAL PASS**

### 条件

1. **Expo export ローカル失敗**（FAIL 項目）: #902/#903 の EAS Build にて解消を確認すること
2. **nodemailer high 脆弱性**: 次リリースまでに nodemailer >=7.0.11 へアップデートすること
3. **AI 要約・実機導線**: #904 staging smoke test にて全主要導線の実機確認を完了すること

### 判定根拠

- 全テスト（API 1486件 / Mobile 940件）が PASS であり、機能回帰は自動テストレベルで検出されない
- blocker PR・Issue はすべて解消済み
- Expo export の失敗はローカル環境固有の pnpm ホイスト問題と推測されるが、EAS Build での再現有無は**現時点で未確認**。#902/#903 完了後に確認が必要
- nodemailer 脆弱性は本番 API での使用なし（開発・テスト用途のみ）

---

## 8. 次アクション

### #901 go/no-go 最終判定への申し送り事項

- Expo export ローカル失敗の原因分析結果と EAS Build での再現有無
- nodemailer アップデートの対応状況
- #904 staging smoke test の結果（特に AI 要約・オフライン保存の実機確認）
- #908 本番シークレット・外部サービス設定の確認完了状況

### #904 staging/production smoke test への引き継ぎ事項

- AI 要約機能（Workers AI API 疎通確認）
- オフライン保存・閲覧の実機動作確認
- プロフィール・フォロー UI の実機確認
- プッシュ通知の動作確認
- アプリ起動時間・スクロール FPS の計測
- Cloudflare Workers モニタリング Dashboard のアクセス権確認
