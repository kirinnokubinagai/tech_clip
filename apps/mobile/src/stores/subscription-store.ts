import { create } from "zustand";

type SubscriptionStore = {
  /** プレミアムプラン加入状態 */
  isPremium: boolean;
  /** プレミアム状態を更新する */
  setIsPremium: (isPremium: boolean) => void;
};

/**
 * サブスクリプション状態を管理するストア
 * プレミアムユーザーの判定に使用
 */
export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  isPremium: false,
  setIsPremium: (isPremium: boolean) => set({ isPremium }),
}));
