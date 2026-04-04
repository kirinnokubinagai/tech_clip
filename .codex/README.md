# Codex ローカルハーネス

このディレクトリは、Codex でも Claude と同じリポジトリガードを使えるようにするためのものです。

## 入口

- `bash ./.codex/run-session-start.sh`
  - リモートとの差分確認
  - worktree 健全性チェック
  - 実装順序チェック
- `bash ./.codex/run-pre-command.sh '<command>'`
  - シークレット混入チェックを実行
  - 危険コマンドチェックを実行
- `bash ./.codex/run-pre-edit.sh`
  - `main` での編集を防止
- `bash ./.codex/run-stop.sh`
  - 未コミット変更の警告

## 設計方針

- ルールロジックはここに重複実装しない
- 実際のチェック本体は [`.claude/hooks/`](../.claude/hooks) に置く
- Codex 側はそれを呼び出すラッパーだけを持つ

## なぜ settings.json をそのまま置かないのか

Codex は Claude の `settings.json` 形式をそのまま解釈する前提ではありません。見た目だけ同じファイルを置いても、実際には何も実行されない可能性があります。

このため、このディレクトリでは「Codex から実行できるシェルラッパー」を正として、既存の Claude hook を再利用しています。
