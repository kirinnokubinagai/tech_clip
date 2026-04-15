# エージェントハーネス

このファイルはプロジェクト全体の開発ルールを定義する。Claude Code・Codex いずれのエージェントもこのファイルのルールに従うこと。
特に `.claude/rules/` 配下は必要なものを必ず読み、実装とレビューに反映すること。

---

## ⚠️ オーケストレーター必須フロー（例外なし・いかなるタスクでも）

**この文書を読んでいるオーケストレーターは、以下のフローをいかなるタスクでも省略してはならない。**
「単純な1行修正」「docs だけの変更」「設定ファイルの追記」であっても例外はない。

### 技術的制約（必読）

**サブエージェントは他のサブエージェントを spawn できない。**
オーケストレーターが analyst・実装エージェント・レビュワーをすべて直接 spawn しなければならない。
analyst が内部で coder を spawn する、などのパターンは技術的に不可能であり試みてはならない。

### 必須 spawn 順序（タスク規模・種別を問わず）

```text
0. [active-issues チームが存在しない場合のみ1回]
   TeamCreate("active-issues")
   ※ 既に存在する場合は不要。Agent(team_name="active-issues") でそのまま追加できる

1. 各 Issue N:
   bash scripts/create-worktree.sh N desc

2. [同一メッセージで全員 background spawn]
   Agent(analyst,  name="issue-N-analyst",  team_name="active-issues", run_in_background=true, mode="acceptEdits")
   Agent(<実装エージェント>, name="issue-N-<role>", team_name="active-issues", run_in_background=true, mode="acceptEdits")
   Agent(<レビュワー>,       name="issue-N-<reviewer>", team_name="active-issues", run_in_background=true, mode="acceptEdits")

3. 複数 Issue は Step 1-2 を繰り返す（チームは同じ "active-issues"）

4. reviewer から "APPROVED: issue-N" SendMessage を受け取るたびに:
   - ユーザーへ「Issue #N が APPROVED されました（残り pending_count 件）」と報告
   - pending_count--
   - pending_count == 0 → ユーザーに「全 Issue 完了しました。新しい Issue がなければ『チームを片付けて』と言ってください」と報告
   - TeamDelete は自動で行わない

5. ユーザーが「チームを片付けて」などと指示したとき → TeamDelete("active-issues")
```

**orchestrator は spawn 後にポーリングしない。reviewer が GitHub レビューまで自己完結し、APPROVED 通知を orchestrator に送る。**

**TeamDelete は自動で行わない。ユーザーが明示的に指示したときのみ実行する。**（自動 TeamDelete は「新 Issue を追加しようとした瞬間にチームが消える」競合が防げないため）

### 変更種別ごとのエージェント選択（必須）

| 変更種別 | 実装エージェント | レビュワーエージェント |
|---|---|---|
| 機能実装・バグ修正・docs 変更 | `coder` | `reviewer` |
| インフラ・CI/CD・設定ファイル変更 | `infra-engineer` | `infra-reviewer` |
| フロントエンド・UI コンポーネント変更 | `ui-designer` | `ui-reviewer` |
| 変更種別が不明 | analyst に判断を委ねる | analyst に判断を委ねる |

### プロアクティブ Issue 自律処理（自動検出 + 人間確認）

オーケストレーターは以下のタイミングで `gh issue list --state open` を確認し、
未対応のオープン Issue をユーザーに提示する。

#### チェックタイミング

1. **SessionStart 時**
   `active-issues` チームの掃除後に gh issue list を実行し、
   自動割り当て可能 Issue があればユーザーに一覧提示する。
2. **APPROVED 通知を受けて pending_count が 0 になったとき**
   「全 Issue 完了しました」の直後にオープン Issue を再チェックし、
   続行候補を提示する。
3. **ユーザーから Issue 番号を含まない作業依頼が来たとき**
   （例: 「次やって」「バグを直して」）
   gh issue list で候補を出し、どれを処理するか確認する。

#### 自動割り当て可能 / 要人間確認 の判定

以下のいずれかに該当する Issue は **要人間確認**（勝手に着手禁止）とし、
一覧の別枠に表示してユーザーの判断を仰ぐ:

- `release` ラベルが付いている
- `requires-human` ラベルが付いている
- タイトルに `go-no-go` / `store` / `production` / `smoke test` を含む（大文字小文字無視）
- タイトルに `本番` を含む

これら以外は **自動割り当て可能 Issue** として一覧に出し、
ユーザーが処理指示を出したら「⚠️ オーケストレーター必須フロー」の
必須 spawn 順序（analyst + 実装 + reviewer 同一メッセージ background spawn）に流し込む。

なお、要人間確認 Issue でもユーザーが明示的に「やって」と指示した場合は着手してよい。
ただしオーケストレーターは着手前に「この Issue には `release` / `requires-human` ラベルが付いています。本当に進めますか？」と 1 回だけ確認する。

#### 重要な原則

- **提示して確認**が基本。完全無確認で自動着手はしない
  （セッション開始直後や pending_count 0 直後にユーザーが別意図を持つ可能性があるため）
- 既に `issue-<N>-*` エージェントが稼働中の Issue は二重 spawn しない
- `active-issues` チームが既に存在する場合は再作成せず、そのまま追加 spawn する
- 該当なしの場合は「対応可能なオープン Issue はありません」と報告する

#### 参考 gh コマンド

```bash
# 自動割り当て可能 Issue のみ抽出（jq が使える環境向け参考例）
gh issue list --state open --limit 100 \
  --json number,title,labels \
  --jq '.[] | select(
    ([.labels[].name] | index("release") | not) and
    ([.labels[].name] | index("requires-human") | not) and
    (.title | test("go-no-go|store|production|smoke test"; "i") | not) and
    (.title | contains("本番") | not)
  ) | "#\(.number) \(.title)"'
```

jq が使えない環境では `gh issue list --state open --limit 100 --json number,title,labels` の JSON 出力を手で読んで判定してよい。要人間確認 Issue も別途列挙すること。

---

## 絶対ルール

- GitHub Issue がない状態で作業を始めない
- Issue ごとに専用 worktree を使う（`scripts/create-worktree.sh` を使う）
- `main` で直接編集しない
- Git 操作は `cd <worktree>` または `git -C <worktree-path> ...` だけを使う
- `pnpm` / `node` / `biome` / `turbo` は原則 `cd <worktree> && direnv exec <worktree> ...` で実行する
- `git --git-dir=...`、`GIT_DIR`、`GIT_WORK_TREE` を使わない
- `git config core.bare` と `git config core.worktree` を変更しない
- 可能な限り TDD で進める
- Lint / Format は Biome を使う
- 破壊的な Git コマンドを使わない
- **レビューが通る前に push しない**（pre-push-review-guard.sh がブロックする）
- **push は必ず `bash scripts/push-verified.sh` を使う**（`git push origin HEAD` の直接実行は禁止）
- **`reviewer` が「全件 PASS（0件）」を返すまで push しない**（インフラは `infra-reviewer`、UI は `ui-reviewer`）（CRITICAL / HIGH / MEDIUM / LOW 問わず指摘が 1 件でも残れば修正ループを続ける）
  - **注意**: 「全件 PASS（0件）」とは CRITICAL / HIGH / MEDIUM / LOW のいずれも 0 件であることを意味する。LOW（改善提案）が 1 件でも残っている場合は PASS ではない
- **オーケストレーターは main ブランチ上でソースファイルを直接編集しない。worktree 上でもエージェントへの委譲を優先する**
- **TeamCreate("active-issues") を使う。TaskCreate / SendMessage も使用可**
- **orchestrator は spawn 後にポーリングしない。reviewer が GitHub レビューまで自己完結し、APPROVED 通知を orchestrator に送る**
- **TeamDelete は自動で行わない。ユーザーが明示的に指示したときのみ実行する**
- **active-issues チームが既に存在する場合は TeamDelete / 再作成は不要**（`Agent(team_name="active-issues", ...)` で新メンバーをそのまま追加できる。`TeamCreate` は存在しない場合のみ実行する）
- **すべてのエージェントを spawn するときは必ず `mode="acceptEdits"` を指定する**（実装系・レビュー系を問わず）
- **`.claude/.review-passed` マーカーの作成は reviewer 系エージェント（`reviewer` / `infra-reviewer` / `ui-reviewer`）のみに許可される。`coder` / `infra-engineer` / `ui-designer` / オーケストレーターがこのマーカーを作成することは禁止する**（このマーカーはレビュー PASS の証憑として `pre-push-review-guard.sh` がチェックするため、レビュワー以外が作成すると「レビューを通らずに push できる抜け道」になる）
- **レビュー PASS 後のマーカー作成・push・PR 作成は各レビュワーエージェントが担当する**（オーケストレーターは行わない）
- **作業開始前に必ず関連スキルを Skill ツールで呼ぶ**（機能実装・バグ修正開始時は `brainstorming`、Issue 作成時は `create-issue` 等、`.claude/skills/` 配下に該当するスキルがある場合は必ず呼ぶ。スキル定義が存在するのに呼ばずに作業を開始することは禁止する）

---

## Issue 対応の詳細フロー（参照用）

> **注意**: このセクションは詳細な説明を提供する参照用ドキュメントである。実際に従うべき必須フローは文書冒頭の「⚠️ オーケストレーター必須フロー」セクションに記載されている。

### Step 0: Issue の確認と分割判断

```bash
gh issue view <N>
```

Issue の内容を読み、**重い Issue かどうか**を判断する。

**重い Issue の判断基準:**
- 実装ファイルが 5 つ以上になりそう
- 独立した機能が複数含まれている

**重い場合は子 Issue に分割する:**

```bash
gh issue create \
  --title "子Issueのタイトル" \
  --body "親 Issue: #N

具体的な作業内容..." \
  --label "..."
```

子 Issue から先に実装・マージし、すべての子 Issue が完了したら親 Issue をクローズする。

---

### Step 1: チーム作成 + Worktree 作成

```bash
# 初回のみ（すでに active-issues チームがある場合はスキップ）
TeamCreate("active-issues")

bash scripts/create-worktree.sh <issue-number> <kebab-case-description>
# 例: bash scripts/create-worktree.sh 744 fix-hook-exit2-messages
```

これで `../issue-<N>` に worktree が作成され、`direnv allow` と `pnpm install` まで完了する。

---

### Step 2: エージェントを全員同時に background spawn

Agent ツールで 3 エージェントを同一メッセージで spawn する。analyst・coder(実装系)・reviewer(レビュー系)を同時に起動し、SendMessage で順序を制御する。

#### 機能実装・バグ修正の場合

```text
[同一メッセージで全員 background spawn]
Agent(analyst,
      name="issue-{N}-analyst",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} の設計を担当する。worktree: ../issue-{N}。設計完了後、SendMessage で coder に spec パスを通知する。")

Agent(coder,
      name="issue-{N}-coder",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} の実装を担当する。worktree: ../issue-{N}。analyst からの SendMessage を待機してから実装を開始すること。")

Agent(reviewer,
      name="issue-{N}-reviewer",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} のレビュー〜PR作成を担当する。worktree: ../issue-{N}。coder からの SendMessage を待機してからレビューを開始すること。")
```

analyst → coder → reviewer の順序は SendMessage の待機で自然に成立する。orchestrator は spawn 後この Issue については一切ポーリングしない。

#### インフラ・CI/CD 変更の場合

```text
[同一メッセージで全員 background spawn]
Agent(analyst,
      name="issue-{N}-analyst",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} の設計を担当する。worktree: ../issue-{N}。設計完了後、SendMessage で infra-engineer に spec パスを通知する。")

Agent(infra-engineer,
      name="issue-{N}-infra-engineer",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} の実装を担当する。worktree: ../issue-{N}。analyst からの SendMessage を待機してから実装を開始すること。")

Agent(infra-reviewer,
      name="issue-{N}-infra-reviewer",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} のレビュー〜PR作成を担当する。worktree: ../issue-{N}。infra-engineer からの SendMessage を待機してからレビューを開始すること。")
```

#### フロントエンド・UI 変更の場合

```text
[同一メッセージで全員 background spawn]
Agent(analyst,
      name="issue-{N}-analyst",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} の設計を担当する。worktree: ../issue-{N}。設計完了後、SendMessage で ui-designer に spec パスを通知する。")

Agent(ui-designer,
      name="issue-{N}-ui-designer",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} の実装を担当する。worktree: ../issue-{N}。analyst からの SendMessage を待機してから実装を開始すること。")

Agent(ui-reviewer,
      name="issue-{N}-ui-reviewer",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} のレビュー〜PR作成を担当する。worktree: ../issue-{N}。ui-designer からの SendMessage を待機してからレビューを開始すること。")
```

---

### Step 3: 完了通知の待機

各エージェントは自律的にフローを完結させる。orchestrator はポーリングしない。

reviewer が PR APPROVED を受けたら以下の順で処理する:
1. `SendMessage(to: "issue-{N}-coder", "APPROVED")` → coder 終了
2. worktree を削除する
3. `SendMessage(to: orchestrator, "APPROVED: issue-{N}")` → orchestrator がカウントを更新してユーザーに報告

orchestrator は通知を受けるたびに以下を行う:
- ユーザーへ「Issue #N が APPROVED されました（残り pending_count 件）」と報告
- pending_count が 0 になったら「全 Issue 完了しました。新しい Issue がなければ『チームを片付けて』と言ってください」と報告
- あわせて「プロアクティブ Issue 自律処理」セクションに従い、`gh issue list --state open` でオープン Issue を再チェックし、自動割り当て可能 Issue があれば「他に N 件オープン Issue があります。続けて処理する場合は番号を指定してください」と提示する（要人間確認 Issue は除外）
- **TeamDelete は自動で行わない**（新 Issue 追加との競合を防ぐため）

PR URL の確認が必要な場合は以下で直接照会する:

```bash
gh pr list --search "Issue #<N>"
# または
gh pr view <pr-number>
```

---

### Step 4: チームのクリーンアップ（ユーザー指示時のみ）

ユーザーから「チームを片付けて」などと指示があった場合のみ実行する:

```bash
TeamDelete("active-issues")
```

**自動的に TeamDelete しない。** 新 Issue を追加しようとした瞬間にチームが消える競合を防ぐため。

---

### SessionStart 時の確認

1. 前回セッションで `active-issues` チームが残っている場合は **TeamDelete / 再作成は不要**。`Agent(team_name="active-issues", ...)` で新メンバーを追加するだけでよい。`TeamCreate` は `active-issues` チームが存在しない場合のみ実行する。
2. `gh issue list --state open` を実行し、「プロアクティブ Issue 自律処理」セクションの判定に従って未対応 Issue をユーザーに提示する（提示のみ。自動着手はしない）。

---

## コンフリクト解消フロー（SendMessage ベース）

reviewer が origin/main とのコンフリクトを検知した場合、SendMessage で実装エージェントに返送する。

```text
reviewer → SendMessage(to: "issue-{N}-coder",
  "CONFLICT: origin/main とコンフリクトが発生しています。以下のファイルを解消してください: <ファイル一覧>")

coder がコンフリクト解消を担当:
  【Step A: 両側の意図を把握する】
  1. 現在の Issue（gh issue view <N>）を読み、このブランチが何をしようとしているか確認する
  2. git log origin/main --oneline -20 で main に入ったコミットを確認する
  3. コンフリクト箇所を読み、それぞれの変更が何を意図しているかを理解する

  【Step B: 解消方針を決める】
  - 両者の意図を両立できる場合 → 両方の変更を活かした形にマージする
  - 片方が明らかに優先されるべき場合 → 理由をコミットメッセージに残す
  - 判断が難しい場合 → より安全側（データ損失しない側）を選ぶ

  【Step C: 解消・再コミット】
  → git fetch origin && git merge origin/main（コンフリクト解消）
  → git commit する
  → SendMessage(to: "issue-{N}-reviewer", "impl-ready: <commit-hash>")

reviewer → 再レビューループへ（フェーズ 2 に戻る）
```

> **注意**: `pre-push-review-guard.sh` により、`.claude/.review-passed` マーカーがない状態での push はブロックされる。このマーカーの作成は reviewer 系エージェント（`reviewer` / `infra-reviewer` / `ui-reviewer`）のみに許可され、coder 系エージェント（`coder` / `infra-engineer` / `ui-designer`）およびオーケストレーターは作成してはならない。各レビュワーエージェントがマーカー作成・push・PR 作成を担当する。

---

## Issue ごとのエージェント終了順序

1. reviewer → coder に `SendMessage("APPROVED")` → coder 終了
2. reviewer → worktree を削除する (`git -C /main-worktree-path worktree remove {worktree} --force`)
3. reviewer → orchestrator に `SendMessage("APPROVED: issue-{N}")` → reviewer 終了
4. orchestrator → 全 Issue 完了を確認 → `TeamDelete("active-issues")`

---

## 複数 Issue の並列処理（TeamCreate + バックグラウンドエージェント）

複数の Issue を並列処理する場合は、**同じ `active-issues` チーム**に参加させる。Issue ごとにエージェント名を `issue-{N}-{role}` とすることで衝突を防ぐ。

### 手順

```bash
# 1. チームを1回だけ作成
TeamCreate("active-issues")

# 2. 各 Issue に worktree を作成する
bash scripts/create-worktree.sh <N1> <desc1>
bash scripts/create-worktree.sh <N2> <desc2>
```

```text
# 3. 各 Issue のエージェントを全員 background spawn（同一メッセージで）
Agent(analyst,  name="issue-{N1}-analyst",  team_name="active-issues", run_in_background=true, mode="acceptEdits", ...)
Agent(coder,    name="issue-{N1}-coder",    team_name="active-issues", run_in_background=true, mode="acceptEdits", ...)
Agent(reviewer, name="issue-{N1}-reviewer", team_name="active-issues", run_in_background=true, mode="acceptEdits", ...)

Agent(analyst,  name="issue-{N2}-analyst",  team_name="active-issues", run_in_background=true, mode="acceptEdits", ...)
Agent(coder,    name="issue-{N2}-coder",    team_name="active-issues", run_in_background=true, mode="acceptEdits", ...)
Agent(reviewer, name="issue-{N2}-reviewer", team_name="active-issues", run_in_background=true, mode="acceptEdits", ...)
```

各エージェントは SendMessage で自律的に連携する。orchestrator は spawn 後ポーリングせず、reviewer からの "APPROVED: issue-N" 通知を受けて全 Issue 完了を確認する。

### バックグラウンドエージェントの制約

worktree-isolation-guard.sh により以下の制限がある（mainブランチのオーケストレーターから兄弟 worktree への Edit/Write/Read/Grep/Glob がブロックされる。worktree 内で動作するバックグラウンドエージェントは影響を受けない）:

| ツール | 制約 |
|---|---|
| Edit / Write | mainブランチから兄弟 worktree へのアクセスはブロックされる |
| Read / Grep / Glob | mainブランチから兄弟 worktree へのアクセスはブロックされる |
| Bash（`cat`, `touch` 等） | worktree-isolation-guard の対象外（ただし他 hook による制約は受ける） |

**main ブランチ上での Edit/Write は全ファイルに対して禁止**（`.claude-user/` と `.omc/` を除く gitignore 済みファイルのみ許可）。
`.claude/**` や `scripts/` であっても必ず worktree 経由で変更すること。

なお `.omc/state/**` は worktree 上でも Edit/Write がブロックされる（is_blocked_file による）。
`.claude/.review-passed` は **reviewer 系エージェントのみが** Write ツールで作成すること（例: Write ツールで `{worktree}/.claude/.review-passed` を作成、内容は空でよい）。coder 系エージェントおよびオーケストレーターはこのマーカーを作成してはならない。

| 項目 | 詳細 |
|---|---|
| Worktree | `../issue-<N>`（Issue ごとに別々） |
| 完了後 | reviewer が worktree を削除し、orchestrator に APPROVED を通知する |

---

## Worktree の自動管理

- `check-worktrees.sh`（SessionStart hook）がマージ済み worktree を自動削除する
- reviewer が APPROVED 受信後に即時削除するため残骸が残らない
- クローズされた（マージなし）Issue の worktree は手動で削除する:

```bash
git worktree remove ../issue-<N>
```

---

## エージェント使用ルール

エージェントを使う場合は `.claude/agents/` 配下で定義されたもののみを使用する。
oh-my-claudecode やその他のプラグイン由来のエージェントは使用しない。

### 利用可能なエージェント一覧

| エージェント | 役割 |
|---|---|
| `analyst` | 要件定義・実装設計（brainstorming skill 使用）。完了後 coder に SendMessage |
| `coder` | コーディング・機能実装（TDD、SendMessage で reviewer と連携） |
| `reviewer` | コード+セキュリティレビュー・push・PR 作成・GitHub レビューポーリング・APPROVED 通知 |
| `ui-designer` | UI コンポーネント実装（SendMessage で ui-reviewer と連携） |
| `ui-reviewer` | UI/UX レビュー・push・PR 作成・GitHub レビューポーリング・APPROVED 通知 |
| `infra-engineer` | インフラ・CI/CD 設定（SendMessage で infra-reviewer と連携） |
| `infra-reviewer` | インフラレビュー・push・PR 作成・GitHub レビューポーリング・APPROVED 通知 |

### エージェント連携パターン

**TeamCreate / SendMessage を使用する。** Agent ツールで直接 spawn し、エージェント間は SendMessage で通信する。

- analyst → 実装エージェントへ SendMessage（`spec: <パス>\n方針: <サマリー>`）
- 実装エージェント → レビュワーへ SendMessage（`impl-ready: <commit-hash>`）
- レビュワー → 実装エージェントへ SendMessage（`APPROVED` / `CHANGES_REQUESTED: <内容>` / `CONFLICT: <内容>`）
- レビュワー → orchestrator へ SendMessage（`APPROVED: issue-{N}`）
- 各エージェントは Issue に紐づく worktree 内で動作させる
- 複数 Issue の場合は「複数 Issue の並列処理」セクションを参照

---

## 必須の起動手順

コーディング作業を始める前に、必ず以下を実行します。

```bash
bash ./.codex/run-session-start.sh
```

ファイルを編集する前に、必ず以下を実行します。

```bash
bash ./.codex/run-pre-edit.sh
```

リポジトリを変更しうるシェルコマンドを実行する前に、必ず以下を実行します。

```bash
bash ./.codex/run-pre-command.sh '<command>'
```

作業終了時には、必要に応じて以下を実行します。

```bash
bash ./.codex/run-stop.sh
```

## 参照元

- 全体ルール: [`CLAUDE.md`](./CLAUDE.md)
- 詳細な実装ルール: [`.claude/rules/`](./.claude/rules)
- 既存 hook 実装: [`.claude/hooks/`](./.claude/hooks)

---

## 話し方ルール

- ツール呼び出し前の予告を禁止する（「〜を読む」「〜を確認する」「〜をプッシュする」等）
- 作業ステップの実況を禁止する（「まず〜を確認してから〜する」等）
- 完了報告は最小限のみ許可する（完了した内容の詳細列挙は禁止）
- ツール呼び出しは予告なしに直接実行する

---

## 目的

[`.codex/`](./.codex) 配下のファイルは、Claude 用に既に存在する hook とルールを Codex からも同じように使えるようにするための薄いラッパーです。ルール本体を二重管理しないことを優先します。
