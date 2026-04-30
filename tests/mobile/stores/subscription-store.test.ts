import { useSubscriptionStore } from "@mobile/stores/subscription-store";

describe("useSubscriptionStore", () => {
  beforeEach(() => {
    useSubscriptionStore.setState({
      isPremium: false,
    });
  });

  describe("初期状態", () => {
    it("isPremiumの初期値がfalseであること", () => {
      // Arrange & Act
      const state = useSubscriptionStore.getState();

      // Assert
      expect(state.isPremium).toBe(false);
    });
  });

  describe("setIsPremium", () => {
    it("trueを設定するとisPremiumがtrueになること", () => {
      // Arrange
      const { setIsPremium } = useSubscriptionStore.getState();

      // Act
      setIsPremium(true);

      // Assert
      expect(useSubscriptionStore.getState().isPremium).toBe(true);
    });

    it("falseを設定するとisPremiumがfalseになること", () => {
      // Arrange
      useSubscriptionStore.setState({ isPremium: true });
      const { setIsPremium } = useSubscriptionStore.getState();

      // Act
      setIsPremium(false);

      // Assert
      expect(useSubscriptionStore.getState().isPremium).toBe(false);
    });

    it("trueからfalseへ変更できること", () => {
      // Arrange
      useSubscriptionStore.setState({ isPremium: true });
      const { setIsPremium } = useSubscriptionStore.getState();

      // Act
      setIsPremium(false);

      // Assert
      expect(useSubscriptionStore.getState().isPremium).toBe(false);
    });
  });
});
