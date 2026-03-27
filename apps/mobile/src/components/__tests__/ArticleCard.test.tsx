import { fireEvent, render } from "@testing-library/react-native";

import { ArticleCard } from "../ArticleCard";

/** テスト用の記事データ */
<<<<<<< HEAD
const MOCK_ARTICLE = {
  id: "article_001",
  userId: "user_01",
  url: "https://example.com/article-1",
  source: "zenn",
  title: "React Hooksの基礎",
  author: "テスト著者",
  excerpt: "React Hooksについての概要です",
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: false,
  isFavorite: false,
  isPublic: false,
  publishedAt: "2024-01-15T00:00:00.000Z",
  createdAt: "2024-01-15T00:00:00.000Z",
  updatedAt: "2024-01-15T00:00:00.000Z",
=======
const BASE_ARTICLE = {
  id: "01JTEST000000000000000001",
  title: "React Nativeのパフォーマンス最適化ガイド",
  author: "tech_writer",
  source: "zenn" as const,
  publishedAt: "2025-03-15T09:00:00.000Z",
  excerpt: "React Nativeアプリのパフォーマンスを改善するための実践的なテクニックを紹介します。",
  thumbnailUrl: "https://example.com/thumbnail.jpg",
  isFavorite: false,
>>>>>>> origin/main
};

describe("ArticleCard", () => {
  describe("レンダリング", () => {
<<<<<<< HEAD
    it("記事タイトルが表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={MOCK_ARTICLE} />);

      // Assert
      expect(getByText("React Hooksの基礎")).toBeDefined();
    });

    it("ソース名が表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={MOCK_ARTICLE} />);
=======
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
>>>>>>> origin/main

      // Assert
      expect(getByText("zenn")).toBeDefined();
    });

<<<<<<< HEAD
    it("概要が表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={MOCK_ARTICLE} />);

      // Assert
      expect(getByText("React Hooksについての概要です")).toBeDefined();
    });

    it("著者名が表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={MOCK_ARTICLE} />);

      // Assert
      expect(getByText("テスト著者")).toBeDefined();
=======
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
>>>>>>> origin/main
    });
  });

  describe("オプショナルフィールド", () => {
<<<<<<< HEAD
    it("excerptがnullの場合でもレンダリングできること", () => {
      // Arrange
      const articleWithoutExcerpt = { ...MOCK_ARTICLE, excerpt: null };

      // Act
      const { getByText } = render(<ArticleCard article={articleWithoutExcerpt} />);

      // Assert
      expect(getByText("React Hooksの基礎")).toBeDefined();
    });

    it("authorがnullの場合でもレンダリングできること", () => {
      // Arrange
      const articleWithoutAuthor = { ...MOCK_ARTICLE, author: null };

      // Act
      const { getByText, queryByText } = render(<ArticleCard article={articleWithoutAuthor} />);

      // Assert
      expect(getByText("React Hooksの基礎")).toBeDefined();
      expect(queryByText("テスト著者")).toBeNull();
    });

    it("readingTimeMinutesがnullの場合でもレンダリングできること", () => {
      // Arrange
      const articleWithoutTime = { ...MOCK_ARTICLE, readingTimeMinutes: null };

      // Act
      const { getByText } = render(<ArticleCard article={articleWithoutTime} />);

      // Assert
      expect(getByText("React Hooksの基礎")).toBeDefined();
    });
  });

  describe("状態表示", () => {
    it("既読の場合に既読表示がされること", () => {
      // Arrange
      const readArticle = { ...MOCK_ARTICLE, isRead: true };

      // Act
      const { getByText } = render(<ArticleCard article={readArticle} />);

      // Assert
      expect(getByText("既読")).toBeDefined();
    });

    it("未読の場合に既読表示がされないこと", () => {
      // Arrange & Act
      const { queryByText } = render(<ArticleCard article={MOCK_ARTICLE} />);

      // Assert
      expect(queryByText("既読")).toBeNull();
=======
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
>>>>>>> origin/main
    });
  });

  describe("インタラクション", () => {
<<<<<<< HEAD
    it("onPress指定時にタップでコールバックが呼ばれること", () => {
      // Arrange
      const onPress = jest.fn();

      // Act
      const { getByText } = render(<ArticleCard article={MOCK_ARTICLE} onPress={onPress} />);
      fireEvent.press(getByText("React Hooksの基礎"));
=======
    it("カードタップ時にonPressが呼ばれること", () => {
      // Arrange
      const onPress = jest.fn();
      const { getByTestId } = render(<ArticleCard article={BASE_ARTICLE} onPress={onPress} />);

      // Act
      fireEvent.press(getByTestId("article-card"));
>>>>>>> origin/main

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });
<<<<<<< HEAD
=======

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
>>>>>>> origin/main
  });
});
