# エージェントワークフロー刷新 設計仕様

**Issue**: #919  
**日付**: 2026-04-14  
**ステータス**: 承認待ち

---

## 概要

オーケストレーターのコンテキスト肥大化を解消するため、エージェント構成とワークフローを刷新する。

### 現状の問題

- orchestrator が coder・code-reviewer・security-reviewer の全出力を受け取り、コンテキストが膨張する
- fix ループのたびに orchestrator のコンテキストに結果が積み重なる
- reviewer が 2 体（code-reviewer + security-reviewer）あり、並列 spawn のコストが高い

### 解決方針

- orchestrator は analyst を sequential spawn するだけ、coder・reviewer は background spawn
- coder ↔ reviewer 間をファイルベース通信（`/tmp/`）で直接やり取りさせる
- reviewer が PASS 後に push + PR 作成まで担当
- orchestrator のコンテキストには `pr-url` のみが残る

---

## エージェント構成

| 変更前 | 変更後 | 変更内容 |
|---|---|---|
| `requirements-analyst` | `analyst` | 改名・`Agent` ツール追加 |
| `code-reviewer` + `security-reviewer` | `reviewer` | 1 体に統合・push + PR 作成を担当 |
| `coder` | `coder` | ファイル通信対応・fix ループを reviewer と直接行う |

---

## ファイル通信プロトコル

### ディレクトリ

```
/tmp/tech-clip-issue-{N}/
```

issue ごとに独立したディレクトリを使用する。git に乗らず PR を汚さない。

### ファイル定義

| ファイル名 | 書く人 | 内容 | タイミング |
|---|---|---|---|
| `spec.md` | analyst | 要件・実装方針・技術的注意点 | analyst 完了時 |
| `coder-ready` | coder | 現在のコミットハッシュ（1行） | 実装/修正完了・コミット後 |
| `review-result.json` | reviewer | `{"commit":"<hash>","status":"PASS"\|"FAIL","issues":[...]}` | レビュー完了後 |
| `pr-url` | reviewer | PR URL（1行） | push + PR 作成完了後 |

### 通信フロー

```
analyst:  spec.md を書く → 終了

coder:    spec.md を読む
          実装 → コミット → coder-ready にコミットハッシュを書く
          review-result.json をポーリング（短い Bash 呼び出しを繰り返す）
          FAIL → issues を修正 → コミット → coder-ready を上書き → ポーリング再開
          PASS → 終了

reviewer: spec.md を読む
          coder-ready をポーリング
          新しいコミットハッシュを検知 → レビュー実行
          FAIL → review-result.json に書く → coder-ready をポーリング再開
          PASS → push-verified.sh → gh pr create → pr-url に書く → 終了

orchestrator: pr-url をポーリング → PR URL 取得 → ScheduleWakeup
```

### ポーリング実装方針

- 各ポーリングは `[ -f <file> ]` + 内容確認の**短い Bash 呼び出し**を繰り返す
- `sleep` を含む長い Bash ループは使わない（Bash タイムアウト 2 分のため）
- エージェントセッション上限は 5 時間であり、通常の実装・レビューサイクルには十分

---

## 各エージェントの詳細フロー

### orchestrator

```
1. gh issue view {N} でイシュー内容を読む
2. bash scripts/create-worktree.sh {N} {description}
3. mkdir -p /tmp/tech-clip-issue-{N}/
4. Agent(analyst, mode="acceptEdits")  ← 完了を待つ
5. Agent(coder, background=true, mode="acceptEdits")
6. Agent(reviewer, background=true, mode="acceptEdits")
7. /tmp/tech-clip-issue-{N}/pr-url をポーリング
8. PR URL 取得 → ScheduleWakeup(300秒, "PR #{N} GitHub レビュー確認")

── GitHub レビュー待機ループ ──
9. 起きたら: gh pr view {PR番号} --json reviews で確認
   - PENDING          → ScheduleWakeup(300秒) でまた眠る
   - APPROVED         → ユーザーに完了報告 → 終了
   - CHANGES_REQUESTED →
       レビューコメントを読む
       /tmp/tech-clip-issue-{N}/ の coder-ready・review-result.json を削除（リセット）
       Agent(coder, background=true, "GitHubレビューのfeedback: ...")
       Agent(reviewer, background=true)
       /tmp/tech-clip-issue-{N}/pr-url をポーリング（既存 PR への push なので同じ URL が書かれる）
       → 9 に戻る
```

### analyst

```
1. worktree パス・issue 番号・issue 内容を受け取る
2. CLAUDE.md・必要な rules を読む
3. 要件を整理し実装方針を決定する
4. /tmp/tech-clip-issue-{N}/spec.md に書く
   - 実装する機能の概要
   - 技術的な注意点
   - テスト方針
5. orchestrator に 1 行サマリを返す → 終了
```

**tools**: `Read`, `Bash`, `Grep`, `Glob`, `Write`  
※ `Write` はこの Agent のみ `/tmp/` への書き込みで使用

### coder

```
1. /tmp/tech-clip-issue-{N}/spec.md を読む（存在するまでポーリング）
2. TDD で実装（Red → Green → Refactor）
3. pnpm lint をクリアする
4. コミットする
5. コミットハッシュを /tmp/tech-clip-issue-{N}/coder-ready に書く
6. /tmp/tech-clip-issue-{N}/review-result.json をポーリング
   - 自分のコミットハッシュと一致する結果が来たら読む
   - PASS  → 終了
   - FAIL  → issues の内容を読んで修正 → コミット
             → coder-ready を新しいコミットハッシュで上書き → 6 に戻る
```

**tools**: `Read`, `Edit`, `Write`, `Bash`, `Grep`, `Glob`

### reviewer

```
1. /tmp/tech-clip-issue-{N}/spec.md を読む（存在するまでポーリング）
2. /tmp/tech-clip-issue-{N}/coder-ready をポーリング（新しいコミットハッシュが来るまで）
3. 変更されたファイルを読み、以下すべてをチェック:
   - coding-standards.md
   - testing.md
   - api-design.md（該当する場合）
   - database.md（該当する場合）
   - security.md
   - frontend-design.md（該当する場合）
4. lint・テストを実行する
5. /tmp/tech-clip-issue-{N}/review-result.json に結果を書く
   - FAIL → 2 に戻る（新しい coder-ready を待つ）
   - PASS →
       touch {worktree}/.claude/.review-passed
       cd {worktree} && bash scripts/push-verified.sh
       gh pr create --title "..." --body "..."
       /tmp/tech-clip-issue-{N}/pr-url に PR URL を書く
       → 終了
```

**tools**: `Read`, `Bash`, `Grep`, `Glob`  
※ `Write` は `/tmp/` への書き込みのみで使用

---

## CLAUDE.md の変更

### 変更が必要な箇所

1. **オーケストレーターの役割**セクション: 新しいワークフローに更新
2. **エージェント一覧テーブル**: `requirements-analyst` → `analyst`、`code-reviewer`+`security-reviewer` → `reviewer`
3. **Issue 対応の完全フロー**: Step 2 を新フローに書き換え
4. **エージェント使用ルール**: 利用可能エージェント一覧を更新

### 変更しない箇所

- worktree 作成フロー（変更なし）
- 絶対ルール（変更なし）
- push-verified.sh の使用義務（変更なし、reviewer が担当）
- `.review-passed` マーカーの仕組み（変更なし、reviewer が作成）

---

## CHANGES_REQUESTED 時の挙動

GitHub レビューで変更要求が来た場合:

1. orchestrator がレビューコメントを読む
2. `/tmp/` のファイルをリセット（coder-ready・review-result.json を削除）
3. coder を background spawn（feedback を prompt に含める）
4. reviewer を background spawn
5. 既存の PR に新しいコミットが push される（PR は再作成しない）
6. reviewer は push のみ行い、同じ PR URL を `pr-url` に書く
7. orchestrator は同じ PR をポーリングし続ける

---

## 技術的注意事項

### ネストの深さ

- orchestrator → analyst: 1 階層（問題なし）
- orchestrator → coder: 1 階層（問題なし）
- orchestrator → reviewer: 1 階層（問題なし）

すべて orchestrator から直接 spawn するため、ネストの問題は発生しない。

### セッションタイムアウト

- Bash コマンド: デフォルト 2 分（1 回の呼び出しで sleep せず短いチェックを繰り返す）
- エージェントセッション: 5 時間
- GitHub レビュー待機: ScheduleWakeup を使うため orchestrator のセッションは消費しない

### 複数 Issue 並列処理

- `/tmp/tech-clip-issue-{N}/` が issue ごとに独立しているため並列処理に対応
- orchestrator が複数の analyst を `background=true` で spawn すれば並列実行可能

---

## 変更ファイル一覧

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `.claude/agents/requirements-analyst.md` | 改名・更新 | `analyst.md` に改名、`Agent` ツール削除（不要に）、spec.md 書き込みフロー追加 |
| `.claude/agents/code-reviewer.md` | 削除 | `reviewer.md` に統合 |
| `.claude/agents/security-reviewer.md` | 削除 | `reviewer.md` に統合 |
| `.claude/agents/reviewer.md` | 新規作成 | code-reviewer + security-reviewer 統合、push + PR 作成フロー追加 |
| `.claude/agents/coder.md` | 更新 | ファイル通信フロー追加 |
| `CLAUDE.md` | 更新 | オーケストレーターワークフロー全体を新フローに書き換え |
