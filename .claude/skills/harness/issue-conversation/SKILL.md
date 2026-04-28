---
name: harness-issue-conversation
description: ユーザーと orchestrator が対話して Issue を登録・割り振り・スコープ調整するための進め方。新規依頼の聞き取り、既存 Issue 探索、子 Issue への分割判断、ラベル選定、本人確認の流れを定める。
triggers:
  - "harness/issue-conversation"
  - "issue登録"
  - "issueを作って"
  - "issue作成"
  - "新しい機能"
  - "新しいバグ"
  - "やりたいこと"
  - "新規 issue"
---

# Issue 登録・割り振りの対話フロー

ユーザーは Issue を一方的に投げるだけでなく、orchestrator と会話しながら Issue を登録・スコープ調整・割り振りする。orchestrator は以下の段取りで進める。

## 段取り

### Step 0: 依頼の聞き取り

ユーザーが「〜したい」「〜が気になる」「〜のバグ」と言ってきたら、まず以下を整理する:

- 何が現状で、何が望ましいか（現状 / あるべき姿）
- 触る可能性のあるレイヤ（API / Mobile / Infra / UI / E2E）
- 緊急度（バグなのか、改善なのか、新機能なのか）
- 想定スコープ（1 Issue か、複数 Issue 分割か）

不明点があれば `AskUserQuestion` で 1〜3 問だけ確認する（過剰な聞き取りは禁止）。

### Step 1: 既存 Issue の探索

```bash
gh issue list --state open --search "<keyword>"
gh issue list --state all --search "<keyword>" --limit 20  # closed も確認
```

重複 / 関連 Issue があればユーザーに提示し、新規作成か既存に追記かを確認する。

### Step 2: 子 Issue への分割判断

以下に該当する場合は **親 Issue + 複数の子 Issue** に分割する:

- 実装ファイルが 5 つ以上になりそう
- 独立した機能が複数含まれている（例: API 追加 + Mobile UI + 設定画面）
- レイヤが分かれる（API / Mobile / Infra / E2E）

子 Issue を先に実装・マージし、すべて完了してから親 Issue をクローズする。

### Step 3: Issue 作成

`create-issue` skill を呼び出して登録する。本文には以下を含める:

- 親 Issue 参照（`親 Issue: #N`）
- 受け入れ条件（Acceptance Criteria）
- 触る可能性のあるパス
- スコープ外の項目（明示的に書く）

### Step 4: ラベル付け

| ラベル | 用途 |
|---|---|
| `bug` | バグ修正 |
| `feature` | 新機能 |
| `chore` | 雑務（依存更新、refactor 等） |
| `docs` | ドキュメントのみ |
| `release` | リリース判断が必要（自動着手禁止） |
| `requires-human` | 人間判断が必要（自動着手禁止） |

### Step 5: 着手判断

ユーザーが「すぐやって」と言った場合 → `harness/spawn-flow` で即 spawn。
「あとでやる」「他のあと」と言った場合 → Issue は登録するだけで spawn は次のチェックタイミング（pending_count==0 / SessionStart）に委ねる。

## ユーザーとの会話で守ること

- ユーザーが曖昧に述べたとき、勝手に Issue を作らない（必ず確認 1 回入れる）
- 既存 Issue がある場合は重複作成しない
- 受け入れ条件が不明確なまま spawn しない
- 「子 Issue に分けるか」の判断はユーザーと合意してから登録する

## 関連 skill

- Issue 自動着手判定: `harness/proactive-issue-triage`
- Issue 作成テンプレート: `create-issue`
- 着手後の spawn: `harness/spawn-flow`
- 設計対話: `brainstorming` / `ui-design-dialogue`
