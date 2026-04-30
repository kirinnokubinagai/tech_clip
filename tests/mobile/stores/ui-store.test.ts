jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { useUIStore } from "@mobile/stores/ui-store";
import * as SecureStore from "expo-secure-store";

const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;

describe("useUIStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItemAsync.mockResolvedValue(undefined);
    useUIStore.setState({
      sortOrder: "newest",
      filterSource: null,
      filterTag: null,
      hasSeenOnboarding: false,
      isOnboardingLoaded: false,
    });
  });

  describe("初期状態", () => {
    it("sortOrderの初期値が'newest'であること", () => {
      // Arrange & Act
      const state = useUIStore.getState();

      // Assert
      expect(state.sortOrder).toBe("newest");
    });

    it("filterSourceの初期値がnullであること", () => {
      // Arrange & Act
      const state = useUIStore.getState();

      // Assert
      expect(state.filterSource).toBeNull();
    });

    it("filterTagの初期値がnullであること", () => {
      // Arrange & Act
      const state = useUIStore.getState();

      // Assert
      expect(state.filterTag).toBeNull();
    });

    it("hasSeenOnboardingの初期値がfalseであること", () => {
      // Arrange & Act
      const state = useUIStore.getState();

      // Assert
      expect(state.hasSeenOnboarding).toBe(false);
    });

    it("isOnboardingLoadedの初期値がfalseであること", () => {
      // Arrange & Act
      const state = useUIStore.getState();

      // Assert
      expect(state.isOnboardingLoaded).toBe(false);
    });
  });

  describe("setSortOrder", () => {
    it("sortOrderを'oldest'に変更できること", () => {
      // Arrange
      const { setSortOrder } = useUIStore.getState();

      // Act
      setSortOrder("oldest");

      // Assert
      expect(useUIStore.getState().sortOrder).toBe("oldest");
    });

    it("sortOrderを'newest'に戻せること", () => {
      // Arrange
      useUIStore.setState({ sortOrder: "oldest" });
      const { setSortOrder } = useUIStore.getState();

      // Act
      setSortOrder("newest");

      // Assert
      expect(useUIStore.getState().sortOrder).toBe("newest");
    });
  });

  describe("setFilterSource", () => {
    it("filterSourceを設定できること", () => {
      // Arrange
      const { setFilterSource } = useUIStore.getState();

      // Act
      setFilterSource("zenn");

      // Assert
      expect(useUIStore.getState().filterSource).toBe("zenn");
    });

    it("filterSourceをnullにリセットできること", () => {
      // Arrange
      useUIStore.setState({ filterSource: "zenn" });
      const { setFilterSource } = useUIStore.getState();

      // Act
      setFilterSource(null);

      // Assert
      expect(useUIStore.getState().filterSource).toBeNull();
    });
  });

  describe("setFilterTag", () => {
    it("filterTagを設定できること", () => {
      // Arrange
      const { setFilterTag } = useUIStore.getState();

      // Act
      setFilterTag("react");

      // Assert
      expect(useUIStore.getState().filterTag).toBe("react");
    });

    it("filterTagをnullにリセットできること", () => {
      // Arrange
      useUIStore.setState({ filterTag: "react" });
      const { setFilterTag } = useUIStore.getState();

      // Act
      setFilterTag(null);

      // Assert
      expect(useUIStore.getState().filterTag).toBeNull();
    });
  });

  describe("resetFilters", () => {
    it("filterSourceとfilterTagをまとめてリセットできること", () => {
      // Arrange
      useUIStore.setState({ filterSource: "zenn", filterTag: "react" });
      const { resetFilters } = useUIStore.getState();

      // Act
      resetFilters();

      // Assert
      const state = useUIStore.getState();
      expect(state.filterSource).toBeNull();
      expect(state.filterTag).toBeNull();
    });

    it("sortOrderはリセットされないこと", () => {
      // Arrange
      useUIStore.setState({ sortOrder: "oldest", filterSource: "zenn" });
      const { resetFilters } = useUIStore.getState();

      // Act
      resetFilters();

      // Assert
      expect(useUIStore.getState().sortOrder).toBe("oldest");
    });
  });

  describe("setHasSeenOnboarding", () => {
    it("trueを設定するとhasSeenOnboardingがtrueになりSecureStoreに保存されること", async () => {
      // Arrange
      const { setHasSeenOnboarding } = useUIStore.getState();

      // Act
      await setHasSeenOnboarding(true);

      // Assert
      expect(useUIStore.getState().hasSeenOnboarding).toBe(true);
      expect(mockSetItemAsync).toHaveBeenCalledWith("hasSeenOnboarding", JSON.stringify(true));
    });

    it("falseを設定するとhasSeenOnboardingがfalseになりSecureStoreに保存されること", async () => {
      // Arrange
      useUIStore.setState({ hasSeenOnboarding: true });
      const { setHasSeenOnboarding } = useUIStore.getState();

      // Act
      await setHasSeenOnboarding(false);

      // Assert
      expect(useUIStore.getState().hasSeenOnboarding).toBe(false);
      expect(mockSetItemAsync).toHaveBeenCalledWith("hasSeenOnboarding", JSON.stringify(false));
    });
  });

  describe("loadOnboardingState", () => {
    it("SecureStoreにtrueが保存されている場合hasSeenOnboardingがtrueになること", async () => {
      // Arrange
      mockGetItemAsync.mockResolvedValue(JSON.stringify(true));
      const { loadOnboardingState } = useUIStore.getState();

      // Act
      await loadOnboardingState();

      // Assert
      const state = useUIStore.getState();
      expect(state.hasSeenOnboarding).toBe(true);
      expect(state.isOnboardingLoaded).toBe(true);
    });

    it("SecureStoreにfalseが保存されている場合hasSeenOnboardingがfalseになること", async () => {
      // Arrange
      mockGetItemAsync.mockResolvedValue(JSON.stringify(false));
      const { loadOnboardingState } = useUIStore.getState();

      // Act
      await loadOnboardingState();

      // Assert
      const state = useUIStore.getState();
      expect(state.hasSeenOnboarding).toBe(false);
      expect(state.isOnboardingLoaded).toBe(true);
    });

    it("SecureStoreにデータがない場合hasSeenOnboardingがfalseになること", async () => {
      // Arrange
      mockGetItemAsync.mockResolvedValue(null);
      const { loadOnboardingState } = useUIStore.getState();

      // Act
      await loadOnboardingState();

      // Assert
      const state = useUIStore.getState();
      expect(state.hasSeenOnboarding).toBe(false);
      expect(state.isOnboardingLoaded).toBe(true);
    });

    it("ロード後にisOnboardingLoadedがtrueになること", async () => {
      // Arrange
      mockGetItemAsync.mockResolvedValue(null);
      const { loadOnboardingState } = useUIStore.getState();

      // Act
      await loadOnboardingState();

      // Assert
      expect(useUIStore.getState().isOnboardingLoaded).toBe(true);
    });
  });
});
