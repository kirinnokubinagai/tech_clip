---
name: harness-conflict-resolution
description: reviewer が origin/main との conflict を検知したときの SendMessage ベース解消フロー。直接 coder に差し戻さず analyst に投げ、両側意図を両立した spec を作って coder に渡す。BEHIND は reviewer が自動追従。
triggers:
  - "harness-conflict-resolution"

  - "harness-conflict-resolution"
  - "CONFLICT_INVESTIGATE"
  - "CONFLICT_RESOLVE"
  - "CONFLICT_RESOLVED"
  - "コンフリクト"
  - "merge conflict"
---

# コンフリクト解消フロー（SendMessage ベース）

reviewer が origin/main との conflict を検知した場合、**直接 coder に差し戻すのではなく analyst に調査を依頼する**。analyst が両側の変更意図を調査して両立方針の spec を作成し、coder に渡す。

## BEHIND の自動追従

reviewer は `mergeStateStatus == BEHIND` を検知した場合、coder への差し戻しを行わず、自動で `git fetch && git merge origin/main` → re-push を行う。race 回避のため re-push 前に upstream 一致を確認する。

## DIRTY（実コンフリクト）の対応フロー

```text
[polling 中に conflict 検知]
reviewer → SendMessage(to: "analyst-{N}",
  "CONFLICT_INVESTIGATE: origin/main との間に conflict が発生しました。ファイル: <ファイル一覧>")
```

### analyst の調査プロトコル

#### Step A: 両側の変更意図を 1 コマンドで把握する

```bash
bash scripts/skills/conflict-investigate.sh
```

スクリプトが自動で:

1. dry-run merge で conflict files を特定
2. HEAD 側 commit 履歴 (`git log HEAD ^origin/main`)
3. origin/main 側 commit 履歴 (`git log origin/main ^HEAD`)
4. ファイルごとに両側で触ったコミットと diff

を Markdown で stdout に出力する。analyst はこれを Read してそのまま使える。

#### Step B: 両立解消方針を決める

- 両者の意図を両立できる場合 → 両方の変更を活かした実装方針を作る（**片方のみ採用は原則禁止**）
- 両立できない箇所がある場合 → `SendMessage(to: "team-lead", "QUESTION_FOR_USER: <内容>")` で orchestrator に bubble up（orchestrator が `AskUserQuestion` で人間ユーザーに設計判断を仰ぐ）

#### Step C: conflict 解消 spec を作成する

`/tmp/issue-{N}-conflict-spec.md` を作成（両側の意図・両立解消方針・コード例を記述）。

#### Step D: coder に CONFLICT_RESOLVE を送信する

```
SendMessage(to: "coder-{N}", "CONFLICT_RESOLVE: spec=/tmp/issue-{N}-conflict-spec.md")
```

### coder の実装

#### Step E: spec に従って両立マージを実装する

1. spec を Read ツールで読み込む
2. `git fetch origin && git merge origin/main`（conflict 箇所を spec の方針で両立解消）
3. spec の方針で解消できない箇所がある場合:
   - `SendMessage(to: "analyst-{N}", "CONFLICT_INVESTIGATE: <状況説明>")` を送信
   - analyst からの `CONFLICT_RESOLVE_DESIGN:` 応答を受信するまで待機
   - 応答の方針を適用してから解消を完了
   - `CONFLICT_RESOLVE_DESIGN:` に "不要" が含まれる場合（本 Issue の変更が main で不要と判定）:
     `SendMessage(to: "reviewer-{N}", "ABORT: CONFLICT_INVESTIGATE の結果、本 Issue の変更は不要と判断されました。<analyst の理由>")` を送信
4. `git commit` する（push しない）
5. `SendMessage(to: "reviewer-{N}", "CONFLICT_RESOLVED: <commit-hash>")` を送信

### reviewer の解消結果監査

1. 解消 commit の diff を読む（`git show <commit-hash>`）
2. 監査ポイント: 片側採用になっていないか、両側の意図が両立されているか
3. 問題あり → `SendMessage(to: "coder-{N}", "CHANGES_REQUESTED: <理由>")` → coder がやり直し
4. 問題なし → 通常レビュー（lint / test / 観点チェック → push → 再 polling）

## 「両側意図両立」の判定基準

- 片方の変更が他方を完全に上書きしている → NG（両立できる方法を再検討）
- Issue A の仕様と main の変更がロジック層で矛盾する → 設計レベルで analyst に CONFLICT_INVESTIGATE を投げる
- 純粋な文言・インデント・import 順の衝突 → 両方取り込みで OK

## フロー図

```
[polling 中に conflict 検知]
reviewer → analyst: CONFLICT_INVESTIGATE
  analyst:
    1. 両側の commit 履歴読む
    2. 変更意図を要約
    3. 両立解消 spec 作成
    4. coder に CONFLICT_RESOLVE
  coder:
    5. spec に従って両立マージ実装
    6. commit
    7. reviewer に CONFLICT_RESOLVED
  reviewer:
    8. 解消結果監査 → 問題なし → 通常フロー復帰
```

## 注意事項

- `pre-push-review-guard.sh` により、`.claude/.review-passed` マーカーがない状態での push はブロックされる
- このマーカーの作成は reviewer 系サブエージェントのみ（coder/conflict-resolver は禁止）
- conflict-resolver として spawn された場合も push 禁止で `CONFLICT_RESOLVED: <commit-hash>` を reviewer に通知する

## 関連 skill

- マーカー保護: `harness-gate-markers`
- push 手順: `harness-push-protocol`
- analyst の調査一般: `conflict-resolver`（既存）
