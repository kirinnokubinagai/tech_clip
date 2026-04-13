import { useCallback } from "react";
import { type ConfirmOptions, confirm } from "@/components/ConfirmDialog";

/** useConfirmのプリセットオプション（title, message, onConfirm以外） */
type ConfirmPreset = Partial<Omit<ConfirmOptions, "title" | "message" | "onConfirm">>;

/**
 * 確認ダイアログを表示するhook
 *
 * @param preset - プリセットオプション（呼び出し時にマージ・上書き可能）
 * @returns 確認ダイアログ表示関数
 */
export function useConfirm(preset: ConfirmPreset = {}) {
  return useCallback(
    (options: ConfirmOptions) => {
      confirm({ ...preset, ...options });
    },
    [preset],
  );
}
