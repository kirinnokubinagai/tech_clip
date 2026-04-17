# GitHub Webhook セットアップ手順

Issue #1052 Part C: Cloudflare Workers Webhook Receiver の設定手順。

## 概要

GitHub から PR イベント（pull_request / pull_request_review / issue_comment）を受信し、
3 条件 AND 判定（CI run 完了 + claude-review job 完了 + ラベル付与 + 判定コメント）を
Cloudflare Workers 内で実行して verdict を評価する。

## 1. Cloudflare Workers Secrets の設定

```bash
# GitHub Webhook HMAC-SHA256 シークレット（任意の文字列を設定）
wrangler secret put GITHUB_WEBHOOK_SECRET

# GitHub API アクセストークン（verdict 判定用）
wrangler secret put GITHUB_TOKEN
```

GITHUB_TOKEN は以下のスコープが必要:
- `repo` (または `pull_requests: read`, `checks: read`, `issues: read`)

## 2. GitHub Webhook の登録

GitHub リポジトリの Settings > Webhooks > Add webhook:

| 項目 | 値 |
|------|-----|
| Payload URL | `https://<your-worker>.workers.dev/webhooks/github` |
| Content type | `application/json` |
| Secret | Step 1 で設定した GITHUB_WEBHOOK_SECRET と同じ値 |
| Events | 以下を選択 |

選択するイベント:
- Pull requests
- Pull request reviews
- Issue comments

## 3. 動作確認

```bash
# Webhook 配信ログを確認
# GitHub: Settings > Webhooks > Recent Deliveries

# Workers ログを確認
wrangler tail
```

## 4. Fallback: Polling Watcher

Webhook が失敗した場合のフォールバックとして `scripts/polling-watcher.sh` を使用する。

orchestrator が定期的に実行:
```bash
bash scripts/polling-watcher.sh /path/to/worktree
```

state ファイルは `.omc/polling/pr-<PR_NUMBER>.json` に保存される（`.omc/polling/README.md` 参照）。
