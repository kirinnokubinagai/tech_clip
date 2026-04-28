# 曖昧仕様は一次情報で確認する

orchestrator・全サブエージェント共通ルール。

仕様 / API / SDK / ツールの挙動について不確実な事柄は、推測 / 記憶で答えず、以下で検証してから動く:

1. `claude-code-guide` エージェント (Claude Code / Agent SDK / Anthropic API)。orchestrator のみ直接呼べる、サブエージェントは team-lead に依頼。
2. `WebFetch` で公式ドキュメント直読み
3. `WebSearch` で公式ドキュメント / リファレンス検索

推測値を「動かなかったら直す」と書くな。やむを得ず仮置きする場合は「未確認」と明示する。
