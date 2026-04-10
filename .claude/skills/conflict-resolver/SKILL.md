---
name: conflict-resolver
description: origin/mainとのconflictを検出し、両方の変更意図を汲んでインテリジェントに解消する。finishスキルから自動的に呼ばれる。
triggers:
  - conflict解消
  - コンフリクト解消
  - merge main
  - mainに追いつく
---

# Conflict Resolver

## 概要

worktreeで作業中にorigin/mainが進んでいる場合、conflictを検出して解消します。
片方を盲目的に選ぶのではなく、**両方の変更意図を理解した上でマージ**します。

---

## 手順

### Step 1: 最新mainを取得

```bash
git fetch origin main
```

### Step 2: mainとの差分を確認

```bash
git log HEAD..origin/main --oneline
```

出力が空なら mainに追いついているので **終了**（conflict-resolverの処理不要）。

差分がある場合は Step 3 へ。

### Step 3: ドライランでconflict確認

```bash
git merge --no-commit --no-ff origin/main
```

- **conflictなし** → `git merge --abort` で元に戻し、clean mergeできることを確認して Step 5 へ
- **conflictあり** → Step 4 へ

### Step 4: Conflictを1ファイルずつインテリジェントに解消

```bash
# conflictしているファイル一覧を取得
git diff --name-only --diff-filter=U
```

各conflictファイルに対して以下を実行する:

#### 4-1. 背景コンテキストを収集

```bash
# mainで最近何が起きたかを確認
git log origin/main --oneline -10

# このブランチが実装しているIssueを確認（ブランチ名から推定）
git branch --show-current

# conflictファイルのコミット履歴（このブランチ）
git log HEAD --oneline --follow -- <file>

# conflictファイルのコミット履歴（main側）
git log origin/main --oneline --follow -- <file>
```

#### 4-2. conflict内容を読む

Readツールでファイルを読み、conflict markersを確認する:

```
<<<<<<< HEAD
（このブランチの変更 = 自分の実装）
=======
（origin/mainの変更 = mainで進んだ内容）
>>>>>>> origin/main
```

#### 4-3. 解消方針を決定

以下の判断基準で解消する:

| ケース | 解消方針 |
|--------|---------|
| 異なる行・異なる関数への変更 | **両方取り込む**（独立した変更） |
| import文の追加が競合 | **両方のimportを保持** |
| 同じ関数の内部実装が競合 | **featureブランチの実装を優先**し、mainの構造変更（型変更・引数追加等）は反映 |
| 型定義・インターフェースの変更が競合 | より厳密/広い型を選択し、両方の意図を満たす型を設計 |
| 削除（main）vs 変更（feature）が競合 | **変更側を優先**（削除は取り消しが難しい） |
| ロジックが根本的に相反する | **ユーザーに確認を求める**（自動解消しない） |

#### 4-4. coderエージェントに解消を委譲

**必ず `coder` エージェントを使ってファイルを書き換える**（直接Editしない）。

coderエージェントへの指示に以下を含める:
1. このブランチが実装しているIssueの内容
2. mainで追加された変更の内容
3. 解消方針（上記判断基準）
4. conflict markersを含む現在のファイル内容
5. **conflict markersを一切残さず**、完全に解消した状態で書き込むこと

#### 4-5. 解消確認

```bash
# conflict markersが残っていないことを確認
grep -r "<<<<<<\|=======\|>>>>>>>" <file>
```

出力があれば解消が不完全 → 4-4 を再実行。

### Step 5: マージコミットを作成

```bash
git add <解消したファイル一覧>
git commit -m "$(cat <<'EOF'
merge: resolve conflicts with origin/main

Conflicted files:
- <ファイル1>: <HEAD側の変更内容> vs <main側の変更内容> → <取った方針>
- <ファイル2>: ...

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Step 6: テストでregression確認

```bash
pnpm turbo test
```

- **テストPASS** → conflict解消完了。finishスキルに戻る。
- **テストFAIL** → 解消が誤っている可能性がある。失敗したテストを確認し、4-3〜4-4 を再実行。

---

## 禁止事項

- `git checkout --ours` / `git checkout --theirs` の一括適用（片方を丸ごと捨てる）
- conflict markersが残った状態でのコミット
- テスト未確認でのfinish続行
- 根本的に相反するロジック変更を自動判断すること（→ユーザーに確認）

---

## ユーザー確認が必要なケース

以下のケースは自動解消せず、ユーザーに状況を説明して判断を仰ぐ:

- ビジネスロジックの根本的な変更が競合している
- データベーススキーマの変更が競合している
- 同じAPIエンドポイントの仕様が両方で変わっている
- セキュリティに関わるコードが競合している
