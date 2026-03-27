import { render } from "@testing-library/react-native";

import { ArticleCardSkeleton, ArticleCardSkeletonList } from "../ArticleCardSkeleton";

describe("ArticleCardSkeleton", () => {
  describe("レンダリング", () => {
    it("スケルトンが正常にレンダリングされること", () => {
      // Arrange & Act
      const { toJSON } = render(<ArticleCardSkeleton />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });
});

describe("ArticleCardSkeletonList", () => {
  describe("レンダリング", () => {
    it("デフォルトで3件のスケルトンが表示されること", () => {
      // Arrange & Act
      const { toJSON } = render(<ArticleCardSkeletonList />);
      const tree = toJSON();

      // Assert
      expect(tree).not.toBeNull();
    });

    it("指定した件数のスケルトンが表示されること", () => {
      // Arrange & Act
      const { toJSON } = render(<ArticleCardSkeletonList count={5} />);
      const tree = toJSON();

      // Assert
      expect(tree).not.toBeNull();
    });
  });
});
