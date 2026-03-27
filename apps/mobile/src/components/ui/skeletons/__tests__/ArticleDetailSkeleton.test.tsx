import { render } from "@testing-library/react-native";

import { ArticleDetailSkeleton } from "../ArticleDetailSkeleton";

describe("ArticleDetailSkeleton", () => {
  describe("レンダリング", () => {
    it("記事詳細スケルトンがレンダリングできること", () => {
      // Arrange & Act
      const { toJSON } = render(<ArticleDetailSkeleton />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });
});
