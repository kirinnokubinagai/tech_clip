import { ArticleListSkeleton } from "@mobile/components/ui/skeletons/ArticleListSkeleton";
import { render } from "@testing-library/react-native";

describe("ArticleListSkeleton", () => {
  describe("レンダリング", () => {
    it("デフォルトで5件のスケルトンが表示されること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<ArticleListSkeleton />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });

    it("指定した件数のスケルトンが表示されること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<ArticleListSkeleton count={3} />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });

    it("count=1で最小レンダリングできること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<ArticleListSkeleton count={1} />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });
});
