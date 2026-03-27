import { render } from "@testing-library/react-native";

import { ProfileSkeleton } from "../ProfileSkeleton";

describe("ProfileSkeleton", () => {
  describe("レンダリング", () => {
    it("プロフィールスケルトンがレンダリングできること", () => {
      // Arrange & Act
      const { toJSON } = render(<ProfileSkeleton />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });
});
