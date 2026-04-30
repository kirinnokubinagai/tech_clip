import { ArticleDetailSkeleton } from "@mobile/components/ui/skeletons/ArticleDetailSkeleton";
import { render } from "@testing-library/react-native";

describe("ArticleDetailSkeleton", () => {
  describe("レンダリング", () => {
    it("記事詳細スケルトンがレンダリングできること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<ArticleDetailSkeleton />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });
});
