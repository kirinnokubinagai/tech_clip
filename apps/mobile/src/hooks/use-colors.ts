import { useColorScheme } from "react-native";

import { DARK_COLORS, LIGHT_COLORS } from "@/lib/constants";

/** ライトモード対応完了まで強制ダーク固定 */
const FORCE_DARK_MODE = true;

/**
 * 現在のテーマに対応したカラートークンを返すフック
 *
 * useColorScheme でシステムテーマを取得し、ライト/ダーク対応のカラーセットを返す。
 *
 * TODO(#891): ライトモード対応完了後に `FORCE_DARK_MODE` 定数と強制ダーク分岐を除去する
 *
 * @returns テーマ連動のカラートークンオブジェクト
 */
export function useColors() {
  const colorScheme = useColorScheme();
  if (FORCE_DARK_MODE) {
    return DARK_COLORS;
  }
  return colorScheme === "dark" ? DARK_COLORS : LIGHT_COLORS;
}
