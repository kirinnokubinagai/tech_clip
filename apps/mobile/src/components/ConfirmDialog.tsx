import { Alert } from "react-native";

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

/** バリアントごとのボタンスタイル */
const VARIANT_BUTTON_STYLE: Record<ConfirmVariant, "destructive" | "default"> = {
  danger: "destructive",
  warning: "default",
};

/**
 * 破壊的操作用の確認ダイアログを表示する
 *
 * @param options - ダイアログ設定
 */
export function confirm({
  title,
  message,
  variant = "danger",
  confirmLabel = DEFAULT_CONFIRM_LABEL,
  cancelLabel = DEFAULT_CANCEL_LABEL,
  onConfirm,
  onCancel,
}: ConfirmOptions): void {
  Alert.alert(title, message, [
    {
      text: cancelLabel,
      style: "cancel",
      onPress: onCancel,
    },
    {
      text: confirmLabel,
      style: VARIANT_BUTTON_STYLE[variant],
      onPress: onConfirm,
    },
  ]);
}
