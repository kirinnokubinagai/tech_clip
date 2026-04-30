import { ProfileSkeleton } from "@mobile/components/ui/skeletons/ProfileSkeleton";
import { render } from "@testing-library/react-native";

describe("ProfileSkeleton", () => {
  describe("レンダリング", () => {
    it("プロフィールスケルトンがレンダリングできること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<ProfileSkeleton />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });
});
