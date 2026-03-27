import { fireEvent, render } from "@testing-library/react-native";

import { ArticleCard } from "../ArticleCard";

/** テスト用の記事データ */
const BASE_ARTICLE = {
  id: "01JTEST000000000000000001",
  title: "React Nativeのパフォーマンス最適化ガイド",
  author: "tech_writer",
  source: "zenn" as const,
  publishedAt: "2025-03-15T09:00:00.000Z",
  excerpt: "React Nativeアプリのパフォーマンスを改善するための実践的なテクニックを紹介します。",
  thumbnailUrl: "https://example.com/thumbnail.jpg",
  isFavorite: false,
};

describe("ArticleCard", () => {
  describe("レンダリング", () => {
    it("タイトルが正しく表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(getByText("React Nativeのパフォーマンス最適化ガイド")).toBeDefined();
    });

    it("著者名が正しく表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(getByText("tech_writer")).toBeDefined();
    });

    it("ソースバッジが正しく表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(getByText("zenn")).toBeDefined();
    });

    it("概要が正しく表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(
        getByText(
          "React Nativeアプリのパフォーマンスを改善するための実践的なテクニックを紹介します。",
        ),
      ).toBeDefined();
    });

    it("サムネイル画像が表示されること", () => {
      // Arrange & Act
      const { getByTestId } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(getByTestId("article-thumbnail")).toBeDefined();
    });
  });

  describe("オプショナルフィールド", () => {
    it("著者名がnullの場合も正常にレンダリングできること", () => {
      // Arrange
      const article = { ...BASE_ARTICLE, author: null };

      // Act
      const { getByText } = render(<ArticleCard article={article} onPress={() => {}} />);

      // Assert
      expect(getByText("React Nativeのパフォーマンス最適化ガイド")).toBeDefined();
    });

    it("概要がnullの場合も正常にレンダリングできること", () => {
      // Arrange
      const article = { ...BASE_ARTICLE, excerpt: null };

      // Act
      const { getByText } = render(<ArticleCard article={article} onPress={() => {}} />);

      // Assert
      expect(getByText("React Nativeのパフォーマンス最適化ガイド")).toBeDefined();
    });

    it("サムネイルがnullの場合も正常にレンダリングできること", () => {
      // Arrange
      const article = { ...BASE_ARTICLE, thumbnailUrl: null };

      // Act
      const { queryByTestId } = render(<ArticleCard article={article} onPress={() => {}} />);

      // Assert
      expect(queryByTestId("article-thumbnail")).toBeNull();
    });

    it("公開日がnullの場合も正常にレンダリングできること", () => {
      // Arrange
      const article = { ...BASE_ARTICLE, publishedAt: null };

      // Act
      const { getByText } = render(<ArticleCard article={article} onPress={() => {}} />);

      // Assert
      expect(getByText("React Nativeのパフォーマンス最適化ガイド")).toBeDefined();
    });
  });

  describe("インタラクション", () => {
    it("カードタップ時にonPressが呼ばれること", () => {
      // Arrange
      const onPress = jest.fn();
      const { getByTestId } = render(<ArticleCard article={BASE_ARTICLE} onPress={onPress} />);

      // Act
      fireEvent.press(getByTestId("article-card"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("お気に入りボタンタップ時にonToggleFavoriteが呼ばれること", () => {
      // Arrange
      const onToggleFavorite = jest.fn();
      const { getByTestId } = render(
        <ArticleCard
          article={BASE_ARTICLE}
          onPress={() => {}}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      // Act
      fireEvent.press(getByTestId("favorite-button"));

      // Assert
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    });

    it("お気に入り状態がtrueの場合にお気に入りアイコンが塗りつぶされること", () => {
      // Arrange
      const article = { ...BASE_ARTICLE, isFavorite: true };

      // Act
      const { getByTestId } = render(
        <ArticleCard article={article} onPress={() => {}} onToggleFavorite={() => {}} />,
      );

      // Assert
      expect(getByTestId("favorite-icon-filled")).toBeDefined();
    });

    it("お気に入り状態がfalseの場合にお気に入りアイコンがアウトラインであること", () => {
      // Arrange & Act
      const { getByTestId } = render(
        <ArticleCard article={BASE_ARTICLE} onPress={() => {}} onToggleFavorite={() => {}} />,
      );

      // Assert
      expect(getByTestId("favorite-icon-outline")).toBeDefined();
    });
  });

  describe("日付フォーマット", () => {
    it("公開日がフォーマットされて表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(getByText("2025/03/15")).toBeDefined();
    });
  });
});
