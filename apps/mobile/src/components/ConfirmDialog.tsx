import { Modal, Pressable, Text, View } from "react-native";
import { create } from "zustand";

import { useColors } from "@/hooks/use-colors";

/** 確認ダイアログのバリアント */
type ConfirmVariant = "danger" | "warning";

/** 確認ダイアログのオプション */
export type ConfirmOptions = {
  title: string;
  message: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

/** dangerバリアントのデフォルト確認ラベル */
const DEFAULT_CONFIRM_LABEL = "削除する";

/** キャンセルボタンのデフォルトラベル */
const DEFAULT_CANCEL_LABEL = "キャンセル";

/**
 * Confirm dialog の表示状態を管理する store
 * `confirm()` がグローバルに呼ばれたときに `<ConfirmDialogHost />` が拾って Modal を出す
 */
type ConfirmDialogState = {
  options: ConfirmOptions | null;
  open: (options: ConfirmOptions) => void;
  close: () => void;
};

const useConfirmDialogStore = create<ConfirmDialogState>((set) => ({
  options: null,
  open: (options) => set({ options }),
  close: () => set({ options: null }),
}));

/**
 * 破壊的操作用の確認ダイアログを表示する
 *
 * 内部実装は React Native の Modal + Pressable。AlertDialog ではなく独自 modal を
 * 使うことで testID をボタンに付与可能 (E2E テストで id-based selector を使うため)。
 *
 * @param options - ダイアログ設定
 */
export function confirm(options: ConfirmOptions): void {
  useConfirmDialogStore.getState().open(options);
}

/**
 * Confirm dialog をグローバルにレンダリングする host component
 * root layout に 1 度だけ配置する
 */
export function ConfirmDialogHost() {
  const options = useConfirmDialogStore((s) => s.options);
  const close = useConfirmDialogStore((s) => s.close);
  const colors = useColors();

  if (!options) {
    return null;
  }

  const {
    title,
    message,
    variant = "danger",
    confirmLabel = DEFAULT_CONFIRM_LABEL,
    cancelLabel = DEFAULT_CANCEL_LABEL,
    onConfirm,
    onCancel,
  } = options;

  function handleCancel() {
    close();
    onCancel?.();
  }

  function handleConfirm() {
    close();
    onConfirm();
  }

  const confirmBgClass = variant === "danger" ? "bg-error" : "bg-primary";

  return (
    <Modal
      transparent
      animationType="fade"
      visible={true}
      onRequestClose={handleCancel}
      testID="confirm-dialog"
    >
      <Pressable
        testID="confirm-dialog-backdrop"
        onPress={handleCancel}
        className="flex-1 items-center justify-center bg-black/60 px-8"
      >
        <Pressable
          testID="confirm-dialog-content"
          onPress={() => undefined}
          className="w-full max-w-md rounded-2xl bg-surface p-6"
          style={{ backgroundColor: colors.surface }}
        >
          <Text testID="confirm-dialog-title" className="text-lg font-bold text-text mb-2">
            {title}
          </Text>
          <Text testID="confirm-dialog-message" className="text-base text-text-muted mb-6">
            {message}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              testID="confirm-dialog-cancel-button"
              onPress={handleCancel}
              className="flex-1 items-center justify-center rounded-lg border border-border py-3"
              accessibilityRole="button"
            >
              <Text className="text-base font-medium text-text">{cancelLabel}</Text>
            </Pressable>
            <Pressable
              testID="confirm-dialog-confirm-button"
              onPress={handleConfirm}
              className={`flex-1 items-center justify-center rounded-lg py-3 ${confirmBgClass}`}
              accessibilityRole="button"
            >
              <Text className="text-base font-medium text-white">{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
