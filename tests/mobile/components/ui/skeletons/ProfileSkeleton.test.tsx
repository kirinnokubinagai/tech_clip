import { render } from "@testing-library/react-native";

import { ProfileSkeleton } from "../../../../../apps/mobile/src/components/ui/skeletons/ProfileSkeleton";

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
