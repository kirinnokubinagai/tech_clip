import { create } from "zustand";

type SortOrder = "newest" | "oldest";

type UIState = {
  sortOrder: SortOrder;
  filterSource: string | null;
  filterTag: string | null;
  setSortOrder: (order: SortOrder) => void;
  setFilterSource: (source: string | null) => void;
  setFilterTag: (tag: string | null) => void;
  resetFilters: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  sortOrder: "newest",
  filterSource: null,
  filterTag: null,
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setFilterSource: (filterSource) => set({ filterSource }),
  setFilterTag: (filterTag) => set({ filterTag }),
  resetFilters: () => set({ filterSource: null, filterTag: null }),
}));
