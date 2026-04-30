import { useColorScheme } from "react-native";

import { DARK_COLORS, LIGHT_COLORS } from "@/lib/constants";

/**
 * 現在の OS テーマに対応したカラートークンを返すフック
 *
 * `useColorScheme()` が `"dark"` を返したときのみ `DARK_COLORS` を返し、
 * それ以外（`"light"` / `null` / `undefined`）はすべて `LIGHT_COLORS` を返す。
 *
 * @returns OS テーマ連動のカラートークンオブジェクト
 */
export function useColors() {
  const colorScheme = useColorScheme();
  return colorScheme === "dark" ? DARK_COLORS : LIGHT_COLORS;
}

/** useColors() の戻り値型 */
export type ThemeColors = ReturnType<typeof useColors>;
