---
name: harness-multi-lane-parallel
description: 1 Issue 内でファイル所有権が重ならない複数の独立作業を、同 role の coder/reviewer を複数レーンで並列起動して捌くための運用。レーン命名規約・file ownership・統合レビュー・E2E レーン専用ルールを定める。
triggers:
  - "harness/multi-lane-parallel"
  - "並列実行"
  - "複数レーン"
  - "lane"
  - "parallel lane"
---

# 複数レーン並列（1 Issue 大規模並列作業）

1 Issue 内でファイル所有権が重ならない複数の独立作業がある場合、**同 role の coder/reviewer を複数レーンで並列起動**できる。

## 命名規約

- 単独: `issue-{N}-{role}`（既存）
- レーン: `issue-{N}-{role}-{lane}`（lane は `api` / `mobile` / `ci` / `docs` / `test` 等）

lane は `[a-zA-Z0-9][a-zA-Z0-9-]*` の英数字ハイフン文字列。

## 必須条件

1. **analyst は 1 体のみ** (`issue-{N}-analyst`)。lane 分割しない
2. **spec にレーン分けを明記**: analyst が spec 内で各 lane の「触って OK」ファイルパス集合を非重複に定義
3. **file ownership 厳格遵守**: 各 coder は自 lane の集合以外に絶対触らない
4. **reviewer は 1 体が全 lane の impl-ready を集約**: 全 lane から受信後に統合レビュー
5. **push は reviewer 1 回のみ**: lane ごとに push してはならない

## E2E レーン専用ルール

E2E 影響あり（`tests/e2e/maestro/**` / testID / locales 変更を含む）lane は **必ず e2e-reviewer を経由** する。

### 流れ

```text
E2E レーン coder ─┐
                  ├─ impl-ready (lane 付き) ─→ e2e-reviewer (1 体) ─→ 全 flow PASS なら e2e-approved ─→ reviewer
E2E レーン coder ─┘
non-E2E レーン coder ──── impl-ready ────────────────────────────────────────────────→ reviewer (統合)
```

- E2E 変更を含む全 lane の coder は `impl-ready` を **e2e-reviewer** に送る（reviewer に直接送らない）
- e2e-reviewer は **1 Issue につき 1 体のみ**（emulator バッティング防止）。集約管理は `/tmp/e2e-impl-ready-{issue}.json` で行う
- ただし shard 単位の並列実行は別軸として認められる（`harness/e2e-shard-execution` 参照）
- 全 shard 完了後、代表 e2e-reviewer (shard1) が aggregator スクリプトで `.claude/.e2e-passed` を生成し、reviewer へ `e2e-approved: <hash>` を送信
- 1 shard でも FAIL なら aggregator が exit 1 → 代表 e2e-reviewer が CHANGES_REQUESTED を coder に返す
- reviewer は e2e-approved を「全 E2E lane の impl-ready」として扱い、non-E2E lane の impl-ready も揃い次第統合レビューを開始する

## 適用基準

- 大 Issue かつ「サブ Issue 分割するほどではない」中規模並列化
- file partition が明確にできる（レーン間 overlap 無し）
- analyst が spec でレーン定義を厭わない

## 関連 skill

- spawn 順序: `harness/spawn-flow`
- E2E shard 並列: `harness/e2e-shard-execution`
- 統合レビュー: `review/code-review`, `review/push-and-pr`
