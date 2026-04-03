import { render } from "@testing-library/react-native";

import { ArticleDetailSkeleton } from "../../../../../apps/mobile/src/components/ui/skeletons/ArticleDetailSkeleton";

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
