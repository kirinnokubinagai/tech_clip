import { render } from "@testing-library/react-native";

import { ArticleListSkeleton } from "../ArticleListSkeleton";

describe("ArticleListSkeleton", () => {
  describe("レンダリング", () => {
    it("デフォルトで5件のスケルトンが表示されること", () => {
      // Arrange & Act
      const { toJSON } = render(<ArticleListSkeleton />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });

    it("指定した件数のスケルトンが表示されること", () => {
      // Arrange & Act
      const { toJSON } = render(<ArticleListSkeleton count={3} />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });

    it("count=1で最小レンダリングできること", () => {
      // Arrange & Act
      const { toJSON } = render(<ArticleListSkeleton count={1} />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });
});
