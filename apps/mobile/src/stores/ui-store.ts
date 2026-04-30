import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

/** SecureStoreキー: オンボーディング表示済みフラグ */
const ONBOARDING_SEEN_KEY = "hasSeenOnboarding";

type SortOrder = "newest" | "oldest";

type UIState = {
  sortOrder: SortOrder;
  filterSource: string | null;
  filterTag: string | null;
  hasSeenOnboarding: boolean;
  isOnboardingLoaded: boolean;
  setSortOrder: (order: SortOrder) => void;
  setFilterSource: (source: string | null) => void;
  setFilterTag: (tag: string | null) => void;
  resetFilters: () => void;
  setHasSeenOnboarding: (value: boolean) => Promise<void>;
  loadOnboardingState: () => Promise<void>;
};

export const useUIStore = create<UIState>((set) => ({
  sortOrder: "newest",
  filterSource: null,
  filterTag: null,
  hasSeenOnboarding: false,
  isOnboardingLoaded: false,
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setFilterSource: (filterSource) => set({ filterSource }),
  setFilterTag: (filterTag) => set({ filterTag }),
  resetFilters: () => set({ filterSource: null, filterTag: null }),

  /**
   * オンボーディング表示済みフラグを設定し、SecureStoreに永続化する
   *
   * @param value - trueに設定するとオンボーディングを表示しない
   */
  setHasSeenOnboarding: async (value: boolean) => {
    await SecureStore.setItemAsync(ONBOARDING_SEEN_KEY, JSON.stringify(value));
    set({ hasSeenOnboarding: value });
  },

  /**
   * SecureStoreからオンボーディング状態を読み込む
   * アプリ起動時に呼び出す
   *
   * `pm clear` (Maestro clearState) で SharedPreferences が消えても
   * Android Keystore のキーが残るため SecureStore が throw する場合がある。
   * その場合は未表示扱いにして isOnboardingLoaded を必ず true にする。
   */
  loadOnboardingState: async () => {
    try {
      const stored = await SecureStore.getItemAsync(ONBOARDING_SEEN_KEY);
      const hasSeenOnboarding = stored !== null ? JSON.parse(stored) : false;
      set({ hasSeenOnboarding, isOnboardingLoaded: true });
    } catch {
      set({ hasSeenOnboarding: false, isOnboardingLoaded: true });
    }
  },
}));
