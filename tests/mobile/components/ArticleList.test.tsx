import { render, screen } from "@testing-library/react-native";

import type { ArticleCardArticle } from "../../../apps/mobile/src/components/ArticleCard";
import { ArticleList } from "../../../apps/mobile/src/components/ArticleList";

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

describe("ArticleList", () => {
  describe("レンダリング", () => {
    it("記事リストが正しく表示されること", async () => {
      // Arrange & Act
      await render(<ArticleList articles={ARTICLES} onPressArticle={() => {}} />);

      // Assert - 3件の記事タイトルがレンダリングされていること
      expect(screen.getByText(/記事タイトル 1/)).toBeDefined();
      expect(screen.getByText(/記事タイトル 2/)).toBeDefined();
      expect(screen.getByText(/記事タイトル 3/)).toBeDefined();
    });

    it("記事が空の場合も正常にレンダリングできること", async () => {
      // Arrange & Act
      const { queryAllByTestId } = await render(
        <ArticleList articles={[]} onPressArticle={() => {}} />,
      );

      // Assert
      expect(queryAllByTestId("article-card")).toHaveLength(0);
    });
  });

  describe("ローディング状態", () => {
    it("isLoadingがtrueの場合にスケルトンが表示されること", async () => {
      // Arrange & Act
      const { getAllByTestId } = await render(
        <ArticleList articles={[]} onPressArticle={() => {}} isLoading />,
      );

      // Assert
      const skeletons = getAllByTestId("article-skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("props", () => {
    it("onToggleFavoriteが渡された場合にArticleCardに伝達されること", async () => {
      // Arrange
      const onToggleFavorite = jest.fn();

      // Act
      const { getAllByTestId } = await render(
        <ArticleList
          articles={ARTICLES}
          onPressArticle={() => {}}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      // Assert - 少なくとも1つのお気に入りボタンがレンダリングされていること
      const favoriteButtons = getAllByTestId("favorite-button");
      expect(favoriteButtons.length).toBeGreaterThan(0);
    });
  });
});
