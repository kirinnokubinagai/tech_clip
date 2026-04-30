# Branch Protection セットアップ手順

このドキュメントは `main` / `stage` branch に GitHub Ruleset を適用する手順を説明します。
Ruleset は管理者権限が必要な操作のため、CI ではなく手動で一度だけ実施します。

## 前提条件

- GitHub repository の admin 権限
- `gh` CLI がインストール済み (`gh auth status` でログイン確認)

## 現状

| Branch | Ruleset | 状態 |
|---|---|---|
| `main` | `main-protection-with-admin-bypass` (id=14698666) | **設定済み・変更不要** |
| `stage` | `stage-protection-with-admin-bypass` | **要設定** |

## stage branch への Ruleset 適用

### GitHub UI での手順

1. リポジトリの **Settings** → **Rules** → **Rulesets** を開く
2. **New branch ruleset** をクリック
3. 以下の値を設定する:

| 項目 | 値 |
|---|---|
| Name | `stage-protection-with-admin-bypass` |
| Target branches | `refs/heads/stage` |
| Enforcement status | Active |
| Bypass list | Repository admin (Pull request only) |
| Require status checks to pass | `CI / ci-gate` |
| Strict required status checks policy | OFF |

4. **Create** をクリックして保存

### gh CLI での手順（要 admin token）

```bash
GITHUB_REPOSITORY="owner/repo"  # 実際のリポジトリ名に変更

gh api "repos/${GITHUB_REPOSITORY}/rulesets" \
  --method POST \
  --header "Accept: application/vnd.github+json" \
  --field name='stage-protection-with-admin-bypass' \
  --field target=branch \
  --field enforcement=active \
  --field 'conditions[ref_name][include][]=refs/heads/stage' \
  --field 'rules[][type]=required_status_checks' \
  --field 'rules[][parameters][required_status_checks][][context]=CI / ci-gate' \
  --field 'rules[][parameters][strict_required_status_checks_policy]=false' \
  --field 'bypass_actors[][actor_id]=2' \
  --field 'bypass_actors[][actor_type]=RepositoryRole' \
  --field 'bypass_actors[][bypass_mode]=pull_request'
```

### 設定後の確認

```bash
bash scripts/ci/verify-branch-protection.sh
```

`OK: main and stage rulesets present` が表示されれば設定完了。

## main branch の Ruleset（参考・変更不要）

既存 Ruleset `main-protection-with-admin-bypass` (id=14698666) の構成:

- Target: `refs/heads/main`
- Required status checks: `CI / ci-gate`
- Bypass: Repository admin (pull request only)

## ロールバック

stage ruleset を削除する場合:

```bash
GITHUB_REPOSITORY="owner/repo"
RULESET_ID=$(gh api "repos/${GITHUB_REPOSITORY}/rulesets" --jq '.[] | select(.name=="stage-protection-with-admin-bypass") | .id')
gh api "repos/${GITHUB_REPOSITORY}/rulesets/${RULESET_ID}" --method DELETE
```
