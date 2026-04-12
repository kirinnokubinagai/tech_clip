# モバイルアプリ テーマカラー設計方針

## 概要

TechClip モバイルアプリのライト / ダークテーマにおけるブランドカラーの設計方針を明文化する。
現状の色設計の問題点を整理し、今後の変更判断の基準を定める。

---

## 現状の問題点

### 1. Primary カラーのブランド分裂

| テーマ | Primary 色 | 色相 |
|--------|-----------|------|
| ライト (`LIGHT_COLORS.primary`) | `#14b8a6` | Teal（青緑） |
| ダーク (`DARK_COLORS.primary`) | `#6366f1` | Indigo（青紫） |

ブランドを象徴する Primary カラーが、ライト / ダークで異なる色相を使用しており、
ブランド統一感が失われている。

### 2. tailwind.config.js がダーク専用

`tailwind.config.js` の `colors` 定義はダークテーマの値のみが登録されており、
ライトテーマでの NativeWind ユーティリティクラス利用が想定されていない。

### 3. ライトテーマが事実上無効

`app/(tabs)/_layout.tsx` に以下のコードがあり、ライトテーマが強制的に無効化されている。

```typescript
// TODO: ライトモード対応時に `|| true` を除去
const isDark = colorScheme === "dark" || true;
```

`article/[id].tsx` も `DARK_COLORS` のみを参照し、ライトテーマ対応コードが存在しない。

---

## カラー方針の定義

### Primary（ブランドメインカラー）

**決定事項: `#14b8a6`（Teal）をブランド Primary として統一する**

- ライト / ダーク共通のブランドアイデンティティを表現する
- CTA ボタン、選択状態、リンク、アクティブタブに使用する
- Indigo（`#6366f1`）は `DARK_COLORS.primary` から削除し Teal に統一する

```
Primary スケール（Tailwind Teal ベース）
  primary-50:  #f0fdfa  ← ライト: 薄い背景
  primary-100: #ccfbf1
  primary-200: #99f6e4
  primary-300: #5eead4  ← primaryLight（ライト）
  primary-400: #2dd4bf
  primary-500: #14b8a6  ← PRIMARY（両テーマ共通）
  primary-600: #0d9488  ← primaryDark（ライト）
  primary-700: #0f766e  ← primaryDark（ダーク）
  primary-800: #115e59
  primary-900: #134e4a
  primary-950: #042f2e  ← ダーク: 薄い強調背景
```

### Accent（アクセントカラー）

**決定事項: `#14b8a6`（Teal）を Primary と兼用し、独立した Accent は廃止する**

- 現在 `SEMANTIC_COLORS.accent` = `#14b8a6` は Primary と同一値
- Primary / Accent の二重管理を廃止し、`primary` トークンに一本化する
- 独立した Accent カラーが必要な場合は Secondary として別途定義する

### Surface（サーフェスカラー）

サーフェスはテーマ固有の色であり、ライト / ダークで異なる値を持つ。

| トークン | ライト | ダーク | 用途 |
|---------|--------|--------|------|
| `background` | `#fafaf9` | `#0a0a0f` | 全体の背景 |
| `surface` | `#ffffff` | `#13131a` | セクション / ヘッダー背景 |
| `card` | `#ffffff` | `#1a1a2e` | カード / モーダル背景 |
| `border` | `#e7e5e4` | `#2d2d44` | 区切り線 / 枠線 |

サーフェスカラーは **テーマ切替時に必ず切り替わる**ことを前提に設計する。
`const` で固定せず、`useColorScheme` の値に基づいて動的に選択する。

### Semantic（セマンティックカラー）

セマンティックカラーはライト / ダーク共通で同一値を使用する。
色だけで意味を伝えないよう、アイコンやラベルと組み合わせること。

| トークン | 値 | 用途 | 現在の定義場所 |
|---------|-----|------|--------------|
| `success` | `#22c55e` | 成功状態（完了、OK） | `SEMANTIC_COLORS` |
| `error` | `#ef4444` | エラー状態、危険操作 | `SEMANTIC_COLORS` |
| `warning` | `#f59e0b` | 警告、注意が必要な状態 | `SEMANTIC_COLORS` |
| `info` | `#3b82f6` | 情報、ヒント | `LIGHT_COLORS` / `DARK_COLORS`（タスク #7 で `SEMANTIC_COLORS` に移行予定） |
| `favorite` | `#ef4444` | お気に入り / いいね（赤） | `SEMANTIC_COLORS` |

> **注意**: `info` は現状 `LIGHT_COLORS` / `DARK_COLORS` に定義されている。
> 両テーマで同一値（`#3b82f6`）を使用しており、将来 `SEMANTIC_COLORS` に集約する予定（移行タスク #7）。

セマンティックカラーの `successSurface` / `dangerSurface` はテーマ固有のため、
ライト / ダークそれぞれに定義する（現状どおり `LIGHT_COLORS` / `DARK_COLORS` に含める）。

### テキストカラー

| トークン | ライト | ダーク | 用途 |
|---------|--------|--------|------|
| `text` | `#1c1917` | `#e2e8f0` | 本文テキスト |
| `textMuted` | `#57534e` | `#94a3b8` | 補助テキスト、説明文 |
| `textDim` | `#78716c` | `#64748b` | 非アクティブ状態、メタ情報 |

---

## 新色を追加する際のルール

### 追加できる状況

1. **既存トークンでカバーできない意味的な状態**が新たに生まれたとき
   - 例: `premium`（有料機能の強調）、`caution`（warningより軽微な注意）
2. **ブランドの第2アクセントカラー**（Secondary）が製品上必要になったとき

### 追加してはいけない状況

- 既存トークンで表現可能なケース（色の微調整だけで新トークン不要）
- デザインの気分転換や「見た目が良い」だけの理由
- グラデーション・ネオン・蛍光系カラー（AIっぽい印象を生むため禁止）

### 追加手順

1. `docs/mobile-theme.md`（本ドキュメント）の該当セクションにトークンを追記する
2. `apps/mobile/src/lib/constants.ts` の `ThemeColors` 型と `LIGHT_COLORS` / `DARK_COLORS`（またはSEMANTIC_COLORS）に追加する
3. `apps/mobile/tailwind.config.js` に対応するユーティリティクラスを追加する
4. 使用箇所のコンポーネントに NativeWind クラスまたはトークン参照を追加する

---

## 移行タスク

以下は今後のチケットで対応する作業一覧。

| # | 内容 | 関連ファイル |
|---|------|-------------|
| 1 | `DARK_COLORS.primary` を `#6366f1` → `#14b8a6` に変更 | `constants.ts`, `tailwind.config.js` |
| 2 | `SEMANTIC_COLORS.accent` を削除し `primary` に一本化 | `constants.ts`, `tailwind.config.js` |
| 3 | `tailwind.config.js` にライトテーマ対応の CSS 変数 or `dark:` バリアントを追加 | `tailwind.config.js`, `global.css` |
| 4 | `_layout.tsx` の `|| true` を除去し、`useColorScheme` に完全対応 | `_layout.tsx` |
| 5 | `article/[id].tsx` のカラー参照をテーマ動的切替に対応 | `article/[id].tsx` |
| 6 | `ThemeColors` 型から `accent` トークンを削除（Primary 一本化後） | `constants.ts` |
| 7 | `LIGHT_COLORS.info` / `DARK_COLORS.info` を `SEMANTIC_COLORS` に移動 | `constants.ts` |

---

## 参照

- 実装ファイル: `apps/mobile/src/lib/constants.ts`
- Tailwind 設定: `apps/mobile/tailwind.config.js`
- デザイン規約: `.claude/rules/frontend-design.md`
- 親 Issue: #823
