---
name: harness-gate-markers
description: Codified Gate Automation の中核。`.claude/gate-rules.json` を唯一の真実とし、scripts/gate/* がレビュー gate と E2E gate の判定とマーカー作成を行う。マーカーは HEAD SHA 1 行形式で、push 前後で検証される。
triggers:
  - "harness-gate-markers"

  - "harness-gate-markers"
  - "gate-rules"
  - "review-passed"
  - "e2e-passed"
  - "create-review-marker"
  - "create-e2e-marker"
  - "evaluate-paths"
  - "ゲート"
  - "マーカー"
---

# Codified Gate Automation（コード化ゲート自動化）

push 可否・E2E 実行要否の判断は **すべてスクリプトが決定する**。orchestrator・サブエージェントいずれも「軽微だから skip」「テストなしで push」などと独断判断することは禁止。

## 唯一の真実: `.claude/gate-rules.json`

| セクション | 用途 |
|---|---|
| `review_gate.required_paths` | review gate を起動するパス群 |
| `review_gate.auto_pass_paths` | docs 等 review 不要なパス群 |
| `e2e_gate.always_required_paths` | E2E 実行を強制するパス群 |
| `e2e_gate.auto_skip_paths` | E2E を自動 skip するパス群 |
| `e2e_gate.content_pattern_check` | testID 等の content pattern チェック |
| `ci_path_filters` | CI workflow の job 選択パス群 |
| `test_coverage_gate.test_required_paths` | production code に対応する test を強制するパス群 |

`gate-rules.json` を変更した際は、`ci.yml` の `changes` ジョブと `pr-e2e-android.yml` の `paths:` も同期させること。

## ゲートスクリプト

| スクリプト | 役割 | 呼び出し元 |
|---|---|---|
| `scripts/gate/evaluate-paths.sh [base_ref]` | diff を評価して JSON を stdout に出力 | hooks, reviewer |
| `scripts/gate/create-review-marker.sh --agent <name>` | lint/typecheck/test を実行し `.claude/.review-passed` を生成 | reviewer 系 |
| `scripts/gate/create-e2e-marker.sh --agent <name> [--maestro-result <xml>]` | E2E gate を評価し `.claude/.e2e-passed` を生成（skip/full） | e2e-reviewer |
| `scripts/gate/run-maestro-and-create-marker.sh --agent <name> [--shard <N>/<TOTAL>]` | Maestro 全 flow（または shard 分）実行 → create-e2e-marker.sh を呼ぶ | e2e-reviewer |
| `scripts/gate/aggregate-e2e-shards.sh --agent <name> --shard-total <TOTAL>` | 全 shard 結果を集約して `.e2e-passed` を生成 | 代表 e2e-reviewer |
| `scripts/gate/auto-fix.sh` | CHANGES_REQUESTED フィードバックを元に lint/typecheck エラーを自動修正 | coder 系 |
| `scripts/gate/check-claude-review-mode.sh` | claude-review bot が動作しているか判定（`auto` / `manual` を stdout） | reviewer 系 |

## マーカー形式（HEAD SHA 1 行）

`.claude/.review-passed` および `.claude/.e2e-passed` はいずれも **HEAD SHA を 1 行だけ含むテキストファイル**。

```
<full-40-char-HEAD-SHA>
```

末尾の改行は許容するが、それ以外の文字（JSON、コメント、空行、`skip:` プレフィックス等）は **不正形式として扱われ push がブロックされる**。

E2E gate を skip する場合は **マーカーを作成しない**。`pre-push-e2e-guard.sh` は `evaluate-paths.sh` を実行して E2E 必要性を判定し、不要なら marker 不在でも push を許可する。

## マーカー一致チェック（push 前後）

`pre-push-review-guard.sh` および `pre-push-e2e-guard.sh` は以下を **すべて** 検証する:

1. marker ファイルが存在する（E2E は必要時のみ）
2. marker の SHA == ローカル HEAD SHA（push 対象 commit と一致）
3. marker の SHA == `git ls-remote origin <branch>` で得られる remote HEAD SHA（push 完了直後の post-push チェック）

3 のチェックは push 直後に hook から非同期で発火し、不一致なら `STUCK: marker/remote SHA mismatch` を reviewer に通知する。

## ログの分離

旧 JSON marker に含まれていた lint/typecheck/test 統計・タイムスタンプ・agent 名は `.claude/last-review.log` / `.claude/last-e2e.log` に JSON Lines 形式で append する。これらはデバッグ用で hook はチェックしない。

## サブエージェントが守るべきルール

- **`create-review-marker.sh` の実行は reviewer 系サブエージェントのみ許可**（coder/infra-engineer/ui-designer は禁止）
- **`run-maestro-and-create-marker.sh` の実行は `e2e-reviewer` のみ許可**
- **スクリプトが exit 0 を返したときのみ push に進む**（exit 1 = 修正が必要）
- **「このケースは特別だから skip していい」と独断判断する禁止**。`evaluate-paths.sh` の判定に従う
- **marker が HEAD SHA と不一致の場合は push できない**。commit 後に必ずスクリプトを再実行する
- **push 後は post-push hook が remote HEAD と marker の一致を再検証する**。不一致時は reviewer に `STUCK` 通知が飛ぶ
- **手動で `echo <SHA> > .claude/.review-passed` のような書き込みは禁止**。必ず scripts/gate/* 経由で作成する

## test coverage gate（pre-commit 強制）

`.husky/pre-commit` が `check-test-coverage.sh --staged` を呼び、`test_required_paths` に該当する production code を test なしで commit しようとすると物理ブロックする。

「test は後でまとめて」という mental model は禁止。production code と test code は同 commit で同梱すること。

## maestro 強制（E2E 必要時）

E2E 影響あり（`e2e_gate.always_required_paths` にマッチ）の変更を含む push は、`.claude/.e2e-passed` マーカー（HEAD SHA 一致）がなければ `pre-push-e2e-guard.sh` が物理ブロックする。マーカー作成は e2e-reviewer による Maestro 全 flow PASS 確認が前提。

## 関連 skill

- push 手順: `harness-push-protocol`
- E2E shard 実行: `harness-e2e-shard-execution`
- 自動修正: `auto-fix.sh`（review-pre-check の延長）
