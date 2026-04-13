import { useColorScheme } from "react-native";

import { DARK_COLORS, LIGHT_COLORS } from "@/lib/constants";

/**
 * 現在のテーマに対応したカラートークンを返すフック
 *
 * useColorScheme でシステムテーマを取得し、ライト/ダーク対応のカラーセットを返す。
 * TODO: ライトモード対応完了後に `|| true` を除去する
 *
 * @returns テーマ連動のカラートークンオブジェクト
 */
export function useColors() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark" || true;
  return isDark ? DARK_COLORS : LIGHT_COLORS;
}
