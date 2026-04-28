---
name: harness-proactive-issue-triage
description: SessionStart 時 / pending_count==0 時 / Issue 番号なしの作業依頼時に、`gh issue list` から自動着手可能 Issue を検出して即座に spawn する判定ロジックと優先度算定。チェーン処理を支える中核スキル。
triggers:
  - "harness/proactive-issue-triage"
  - "次やって"
  - "次のissue"
  - "open issue"
  - "issue triage"
  - "セッション開始"
---

# プロアクティブ Issue 自律処理

orchestrator は以下のタイミングで `gh issue list --state open` を確認し、自動割り当て可能な未対応 Issue を **確認なしで即座に** サブエージェントへ流し込む。

## チェックタイミング

1. **SessionStart 時**: `active-issues` チームの掃除後に実行。spawn 対象があれば即 spawn。
2. **APPROVED 通知で pending_count == 0**: 「全 Issue 完了」報告の直後にチェーン実行。
3. **ユーザーから Issue 番号を含まない作業依頼が来たとき**（「次やって」「バグを直して」等）: 候補から最も若い番号を自動選択。

## 自動割り当て可能 / 要人間確認 の判定

**要人間確認**（勝手に着手禁止、一覧提示のみ）:

- `release` ラベルが付いている
- `requires-human` ラベルが付いている
- タイトルに `go-no-go` / `store` / `production` / `smoke test` を含む（大文字小文字無視）
- タイトルに `本番` を含む

これら以外は **自動割り当て可能** とみなし、ユーザー指示なしで `harness/spawn-flow` の必須 spawn 順序に流し込む。

要人間確認 Issue でもユーザーが明示的に「やって」と指示した場合は着手してよい。ただし着手前に「この Issue には `release` / `requires-human` ラベルが付いています。本当に進めますか？」と 1 回だけ確認する。

## Issue 自動選定アルゴリズム

### Step 1: 候補列挙

```bash
gh issue list --state open --limit 100 --json number,title,labels
```

要人間確認 Issue を除外する。

### Step 2: 依存関係解析

各 Issue の body/title から以下を抽出:

- 直近マージされた PR の follow-up Issue は **最優先**
- `Closes #` / `Blocks #` / `See #` 参照を解析して依存順序を決める
- 参照が見つからない場合は依存優先度を 0 とみなし、Issue 番号昇順を既定順序として採用

### Step 3: 競合リスク算出

各 Issue body で言及されたファイルパスを抽出し、進行中 PR と同じファイルを触る Issue は並行不可とする。

### Step 4: 優先度算出

```
スコア = (依存優先度) + (ラベル優先度: bug > feature > chore > docs)
       - (issue 番号大きさペナルティ)
       - (epic ペナルティ)
```

epics（分割が必要な大きな Issue）は「分割が必要」と報告してスキップする。

### Step 5: 並行スロット決定

**同時実行数の上限はない**。Step 3 でファイル競合と判定された Issue 以外はすべて同一バッチで spawn する。

### Step 6: サブエージェント spawn

各 Issue に対して `harness/spawn-flow` の必須 spawn 順序を実行する。

### Step 7: 自律実行 → ユーザー事後報告

spawn 後はユーザーに「Issue #N, #M に着手しました」と事後報告する。pending_count が 0 になったら次バッチを自動判定して自律継続する。

## 重要な原則

- **自動着手**が基本。自動割り当て可能 Issue は確認なしで即座に spawn する
- 着手した Issue は事後にユーザーへ報告する
- ユーザーが SessionStart 直後や pending_count 0 直後に別意図を伝えた場合は、現行の spawn を継続しつつユーザーの新指示を優先タスクとして受け付ける
- ユーザーが明示的に「Issue #N への着手をやめて」と指示した場合は `shutdown_request` を送って終了させる（`harness/agent-cleanup` 参照）
- 既に `issue-<N>-*` サブエージェントが稼働中の Issue は二重 spawn しない
- **reviewer を新規 spawn する前に、必ず team config の既存メンバー一覧を確認する。`issue-{N}-reviewer` がエントリされていればそのまま `SendMessage` で `impl-ready` を送ること**（ping は送らない、polling 中で応答できないため）
- `active-issues` チームが既に存在する場合は再作成しない（`Agent(team_name="active-issues", ...)` で追加 spawn する）

## 参考 gh コマンド

jq が使える環境向け:

```bash
gh issue list --state open --limit 100 \
  --json number,title,labels \
  --jq '.[] | select(
    ([.labels[].name] | index("release") | not) and
    ([.labels[].name] | index("requires-human") | not) and
    (.title | test("go-no-go|store|production|smoke test"; "i") | not) and
    (.title | contains("本番") | not)
  ) | "#\(.number) \(.title)"'
```

jq が使えない環境では `gh issue list --state open --limit 100 --json number,title,labels` の JSON 出力を手で読んで判定してよい。

## next-issue-candidates.sh

APPROVED 受信後は `bash scripts/next-issue-candidates.sh` を実行して候補 Issue を取得する。spawn 自体は orchestrator の責任。
