---
name: e2e-write-maestro-flow
description: Maestro YAML フローを新規作成・修正するときのルール。テキスト指定 (text) ではなく id 指定 (testID) を必須とする。React Native 側に testID 属性を追加する責務もここで定義。
triggers:
  - "e2e/write-maestro-flow"
  - "maestro yaml"
  - "maestro 作成"
  - "e2e flow"
  - "testID"
---

# Maestro Flow 作成ルール

`tests/e2e/maestro/**/*.yaml` を新規作成・修正するときに必ず従うこと。

## 絶対ルール: テキスト指定禁止、`id:` 指定必須

セレクタは **必ず testID（`id:`）で指定** する。`text:` / 文字列直書き指定は禁止。

### ✅ 正しい（id 指定）

```yaml
- tapOn:
    id: "settings-tab"
- assertVisible:
    id: "logout-button"
- tapOn:
    id: "confirm-dialog-ok"
- inputText: "test@example.com"  # 直前にフォーカス済みの入力フィールドへ（id 指定で focus 後に使う）
```

### ❌ 禁止（text 指定 / 文字列直書き）

```yaml
- tapOn: "ログアウト"          # ❌ テキスト直指定
- tapOn:
    text: "ログアウト"         # ❌ text プロパティ
- assertVisible: "完全一致テキスト"   # ❌ 文字列直渡し
- assertVisible:
    text: "完全一致テキスト"  # ❌
```

### なぜ id 指定か

- **i18n / locale 変更に強い**: テキストが翻訳されても testID は不変
- **DOM/ツリー変化に強い**: 文言リファクタで E2E が壊れない
- **意図の明示**: testID に「目的」を込められる（`logout-button` vs `ログアウト`）
- **flaky 削減**: 部分一致やフォーカスずれで誤動作しない

## React Native 側の責務（必須セット）

Maestro YAML に新規 `id:` を書くときは、対応する React コンポーネントに **必ず `testID` 属性** を同コミットで追加する:

```tsx
// apps/mobile/app/(tabs)/settings.tsx
<Pressable testID="settings-tab" onPress={onPress}>
  ...
</Pressable>

<Button testID="logout-button" onPress={handleLogout}>
  ログアウト
</Button>

// apps/mobile/src/components/ConfirmDialog.tsx
<Pressable testID="confirm-dialog-ok" onPress={onConfirm}>
  ...
</Pressable>
```

`gate-rules.json` の `e2e_gate.content_pattern_check` で testID 含有チェックがされる。

## testID 命名規約

| 種別 | パターン | 例 |
|---|---|---|
| 画面（screen / tab） | `<feature>-<screen>` | `home-tab`, `article-list-screen` |
| ボタン | `<context>-<action>-button` | `logout-button`, `article-share-button` |
| 入力フィールド | `<context>-<field>-input` | `auth-email-input`, `profile-name-input` |
| ダイアログ | `<dialog>-<role>` | `confirm-dialog-ok`, `confirm-dialog-cancel` |
| リストアイテム | `<list>-item-<index or id>` | `article-item-0`, `notification-item-abc123` |

- **kebab-case** 統一
- 半角英数字・ハイフンのみ
- 動的 ID（DB の id 等）を含める場合は固定 prefix を付ける

## Maestro 2.3.0 syntax ホワイトリスト

**OK なコマンド**:
- `launchApp:`, `launchApp: { clearState: true }`
- `assertVisible: { id: "..." }`
- `tapOn: { id: "..." }`
- `waitForAnimationToEnd: { timeout: N }`
- `takeScreenshot: path/to/file`
- `openLink: scheme://path`
- `inputText: "..."`（直前に id 指定で focus 済みの想定）
- `pressKey: Enter`
- `scroll`
- `runFlow:`（外部 YAML 呼び出し）

**NG なコマンド**（CHANGES_REQUESTED の対象）:
- `assertVisible: { text: ..., timeout: ... }` — timeout は assertVisible 内に書けない
- `extendedWaitUntil:` — Maestro 2.3.0 で silently skip される
- `type:` — 未対応
- `tapOn: "テキスト"` / `assertVisible: "テキスト"` — id 指定必須

## 例外（やむを得ず text 指定が必要な場合）

外部 SDK のダイアログなど testID を付与不能な要素のみ、`text:` 指定を許可する。コメントで理由を明記:

```yaml
# 外部認証 SDK のシステムダイアログ (testID 付与不可)
- tapOn:
    text: "Cancel"
```

それ以外で `text:` を使った場合、e2e-reviewer は CHANGES_REQUESTED で差し戻す。

## 関連

- `harness/e2e-shard-execution` — Maestro 実行の shard 並列
- `gate-rules.json` の `e2e_gate.content_pattern_check` — testID 含有チェック
- e2e-reviewer はこのルールに沿ってフェーズ 1 の静的検証を行う
