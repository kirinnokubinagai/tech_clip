import { render } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";

import type { ArticleCardArticle } from "../ArticleCard";
import { ArticleList } from "../ArticleList";

/** テスト用の記事データ */
const makeArticle = (id: string): ArticleCardArticle => ({
  id,
  title: `記事タイトル ${id}`,
  author: "著者名",
  source: "zenn" as const,
  publishedAt: "2025-03-15T09:00:00.000Z",
  excerpt: "記事の概要テキストです。",
  thumbnailUrl: null,
  isFavorite: false,
});

const ARTICLES = [makeArticle("1"), makeArticle("2"), makeArticle("3")];

function findAllByTestId(root: ReactTestInstance, testId: string): ReactTestInstance[] {
  return root.findAllByProps({ testID: testId });
}

describe("ArticleList", () => {
  describe("レンダリング", () => {
    it("記事リストが正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleList articles={ARTICLES} onPressArticle={() => {}} />);

      // Assert - FlashList/FlatListにdata propが正しく渡されていること
      const lists = UNSAFE_root.findAllByProps({ data: ARTICLES });
      expect(lists.length).toBeGreaterThan(0);
      expect(lists[0].props.data).toHaveLength(3);
    });

    it("記事が空の場合も正常にレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleList articles={[]} onPressArticle={() => {}} />);

      // Assert
      expect(findAllByTestId(UNSAFE_root, "article-card")).toHaveLength(0);
    });
  });

  describe("ローディング状態", () => {
    it("isLoadingがtrueの場合にスケルトンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ArticleList articles={[]} onPressArticle={() => {}} isLoading />,
      );

      // Assert
      const skeletons = findAllByTestId(UNSAFE_root, "article-skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("props", () => {
    it("onToggleFavoriteが渡された場合にArticleCardに伝達されること", () => {
      // Arrange
      const onToggleFavorite = jest.fn();

      // Act
      const { UNSAFE_root } = render(
        <ArticleList
          articles={ARTICLES}
          onPressArticle={() => {}}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      // Assert - 少なくとも1つのお気に入りボタンがレンダリングされていること
      const favoriteButtons = findAllByTestId(UNSAFE_root, "favorite-button");
      expect(favoriteButtons.length).toBeGreaterThan(0);
    });
  });
});
