---
name: impl-wait-for-spec
description: フェーズ 0: analyst からの spec 受信待機。SendMessage で spec パスと方針を受け取ってから実装を開始する。coder/infra-engineer/ui-designer 共通。
triggers:
  - "impl-wait-for-spec"

  - "impl-wait-for-spec"
  - "spec待機"
---

# spec 受信待機スキル

analyst からの SendMessage を待機し、spec を受け取ってから実装を開始する。

## 待機するメッセージ

analyst から以下の形式で SendMessage が届く:

```
spec: <spec ファイルのパス>
方針: <実装サマリー>
```

## 受信後の処理

1. `spec: <path>` に記載されたパスを Read ツールで読み込む
2. spec の内容を理解し、実装方針を確認する
3. 実装を開始する（フェーズ 1 へ）

## 注意

- analyst からのメッセージが届くまで他の作業を開始してはならない
- analyst が spawn されていない場合は orchestrator に確認する
