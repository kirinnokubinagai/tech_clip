import { useCallback, useState } from "react";

/** トーストの種別 */
type ToastVariant = "success" | "error" | "info";

type ToastState = {
  visible: boolean;
  message: string;
  variant: ToastVariant;
};

/** トーストの初期状態 */
const INITIAL_STATE: ToastState = {
  visible: false,
  message: "",
  variant: "info",
};

/**
 * トースト通知を管理するカスタムフック
 *
 * @returns toast状態とshow/dismiss関数
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(INITIAL_STATE);

  const show = useCallback((message: string, variant: ToastVariant = "info") => {
    setToast({ visible: true, message, variant });
  }, []);

  const dismiss = useCallback(() => {
    setToast(INITIAL_STATE);
  }, []);

  return { toast, show, dismiss };
}
