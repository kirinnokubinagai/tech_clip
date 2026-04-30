---
name: harness-proactive-issue-triage
description: SessionStart 時 / pending_count==0 時 / Issue 番号なしの作業依頼時に、自動着手可能 Issue を即 spawn する。判定は `scripts/next-issue-candidates.sh` が完結させる。
triggers:
  - "harness-proactive-issue-triage"

  - "harness-proactive-issue-triage"
  - "次やって"
  - "次のissue"
  - "open issue"
  - "issue triage"
  - "セッション開始"
---

# プロアクティブ Issue 自律処理

## チェックタイミング

1. **SessionStart 時** — `clean-stale-team-members.sh` 後
2. **APPROVED で pending_count == 0** になった直後
3. **ユーザーから Issue 番号なしの作業依頼**（「次やって」「バグ直して」等）

## 判定 + 候補取得（1 コマンド）

```bash
bash scripts/next-issue-candidates.sh --json
```

出力形式:

```json
{
  "auto_assignable": [{"number": 1055, "title": "..."}, ...],
  "requires_human": [{"number": 1057, "title": "[release] v2.0.0..."}, ...]
}
```

判定ルール（スクリプト内に codified、`.claude/config.json` で調整可）:

- **要人間確認**（`requires_human`）: `release` / `requires-human` ラベル、または title に `go-no-go` / `store` / `production` / `smoke test` / `本番` を含む
- **自動着手可能**（`auto_assignable`）: 上記以外

## 動作

1. `auto_assignable` を全件、`harness-spawn-flow` で **確認なしで即 spawn**（同時 spawn 数の上限なし、ファイル競合がある Issue 以外）
2. 着手後、ユーザーへ事後報告（「Issue #N, #M に着手しました」）
3. `requires_human` のみユーザーに一覧提示（着手しない）

## 着手禁止条件（独断回避）

以下のときは spawn 前に `harness-orchestrator-self-audit` を通す:

- 既に `*-{N}` サブエージェントが team config に存在 → 二重 spawn 禁止
- ユーザーが「Issue #N をやめて」と明示的に指示 → `harness-agent-cleanup` を実行
- 複数 Issue が同じファイルを触る可能性が高い → 順次実行を判断

## 関連 skill

- spawn 自体: `harness-spawn-flow`
- 完了後 cleanup: `harness-agent-cleanup`
- 標準フロー外判断: `harness-orchestrator-self-audit`
