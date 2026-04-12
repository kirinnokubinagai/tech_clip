/**
 * TechClip Mobile - Tailwind / NativeWind カラー設定
 *
 * ## 現状の注意
 * この設定はダークテーマの値のみを登録している。
 * ライトテーマ対応は docs/mobile-theme.md の移行タスク#3 で実施予定。
 *
 * ## Primary カラーについて
 * primary.DEFAULT = "#6366f1"（Indigo）は将来 "#14b8a6"（Teal）に変更予定。
 * ブランドカラー方針は docs/mobile-theme.md を参照すること。
 *
 * ## 新色を追加するルール
 * - 追加前に docs/mobile-theme.md のカラー方針を確認する
 * - グラデーション・ネオン・蛍光系カラーは禁止
 * - LIGHT_COLORS / DARK_COLORS（constants.ts）と値を同期させること
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // サーフェスカラー（ダークテーマ固有）
        // TODO(#855): ライトテーマ対応時に CSS 変数または dark: バリアントに移行する
        background: "#0a0a0f",
        surface: "#13131a",
        card: "#1a1a2e",
        // Primary カラー
        // TODO(#855): "#14b8a6"（Teal）に統一する（docs/mobile-theme.md 移行タスク#1 参照）
        primary: {
          DEFAULT: "#6366f1",
          light: "#818cf8",
          dark: "#4f46e5",
        },
        // ⚠️ この値 (#f59e0b=Amber) は constants.ts の accent (#14b8a6=Teal) と異なる。
        // TODO(#855): constants.ts と値を合わせたうえで、移行タスク#2 で削除する。
        accent: "#f59e0b",
        // テキストカラー（ダークテーマ固有）
        text: {
          DEFAULT: "#e2e8f0",
          muted: "#94a3b8",
          dim: "#64748b",
        },
        border: "#2d2d44",
        // セマンティックカラー（ライト/ダーク共通）
        success: "#22c55e",
        error: "#ef4444",
        warning: "#f59e0b",
      },
    },
  },
  plugins: [],
};
