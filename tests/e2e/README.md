# TechClip E2E Tests (Maestro)

Maestroを使ったE2Eテストフロー集。実機またはシミュレーターで動作確認する。

## 前提条件

```bash
# Maestro CLI のインストール
curl -Ls "https://get.maestro.mobile.dev" | bash
```

## 実行方法

```bash
# 全フローを実行
maestro test tests/e2e/flows/

# 特定フローを実行
maestro test tests/e2e/flows/01-onboarding.yaml

# タグでフィルター
maestro test --tags smoke tests/e2e/flows/

# デバッグモード（スクリーンショット保存）
maestro test --debug-output tests/e2e/output/ tests/e2e/flows/
```

## フロー一覧

| ファイル | 説明 | タグ |
|---------|------|------|
| `01-onboarding.yaml` | 初回起動オンボーディング | smoke |
| `02-auth-login.yaml` | ログインフロー | smoke, auth |
| `03-auth-register.yaml` | 新規登録フロー | auth |
| `04-article-save.yaml` | 記事保存フロー | smoke, article |
| `05-article-detail.yaml` | 記事詳細・お気に入り | article |
| `06-profile-edit.yaml` | プロフィール編集 | profile |
| `07-settings.yaml` | 設定画面・ログアウト | settings |
| `08-search.yaml` | 検索フロー | search |

## 環境設定

`.env.yaml` をこのディレクトリに作成して認証情報を設定:

```yaml
# tests/e2e/.env.yaml (コミット禁止)
TEST_EMAIL: test@example.com
TEST_PASSWORD: TestPass123!
```

## CI/CD 統合

```bash
# GitHub Actions での実行例
maestro cloud --apiKey $MAESTRO_API_KEY tests/e2e/flows/
```
