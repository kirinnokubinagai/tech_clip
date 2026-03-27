import { fireEvent, render } from "@testing-library/react-native";

<<<<<<< HEAD
import type { ArticleListItem } from "@/types/article";

import { ArticleCard } from "../ArticleCard";

/** テスト用モック記事データ */
function createMockArticle(overrides: Partial<ArticleListItem> = {}): ArticleListItem {
  return {
    id: "test-article-1",
    url: "https://zenn.dev/test/articles/example",
    title: "テスト記事タイトル",
    excerpt: "テスト記事の要約テキストです。",
    author: "テスト著者",
    source: "zenn",
    thumbnailUrl: "https://example.com/thumb.jpg",
    readingTimeMinutes: 5,
    isRead: false,
    isFavorite: false,
    isPublic: false,
    publishedAt: new Date().toISOString(),
    savedBy: "user-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ArticleCard", () => {
  describe("レンダリング", () => {
    it("記事タイトルが表示されること", () => {
      // Arrange
      const article = createMockArticle({ title: "React Nativeの最新動向" });
      const onToggleFavorite = jest.fn();

      // Act
      const { getByText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(getByText("React Nativeの最新動向")).toBeDefined();
    });

    it("ソースバッジが表示されること", () => {
      // Arrange
      const article = createMockArticle({ source: "zenn" });
      const onToggleFavorite = jest.fn();

      // Act
      const { getByText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(getByText("Zenn")).toBeDefined();
    });

    it("読了時間が表示されること", () => {
      // Arrange
      const article = createMockArticle({ readingTimeMinutes: 10 });
      const onToggleFavorite = jest.fn();

      // Act
      const { getByText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(getByText("10分")).toBeDefined();
    });

    it("著者名が表示されること", () => {
      // Arrange
      const article = createMockArticle({ author: "山田太郎" });
      const onToggleFavorite = jest.fn();

      // Act
      const { getByText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(getByText("山田太郎")).toBeDefined();
    });

    it("要約テキストが表示されること", () => {
      // Arrange
      const article = createMockArticle({ excerpt: "これは要約テキストです" });
      const onToggleFavorite = jest.fn();

      // Act
      const { getByText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(getByText("これは要約テキストです")).toBeDefined();
    });

    it("excerptがnullの場合、要約テキストが表示されないこと", () => {
      // Arrange
      const article = createMockArticle({ excerpt: null });
      const onToggleFavorite = jest.fn();

      // Act
      const { queryByText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(queryByText("テスト記事の要約テキストです。")).toBeNull();
    });

    it("authorがnullの場合、著者名が表示されないこと", () => {
      // Arrange
      const article = createMockArticle({ author: null });
      const onToggleFavorite = jest.fn();

      // Act
      const { queryByText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(queryByText("テスト著者")).toBeNull();
    });

    it("readingTimeMinutesがnullの場合、読了時間が表示されないこと", () => {
      // Arrange
      const article = createMockArticle({ readingTimeMinutes: null });
      const onToggleFavorite = jest.fn();

      // Act
      const { queryByText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(queryByText("5分")).toBeNull();
    });
  });

  describe("お気に入りボタン", () => {
    it("お気に入りボタンのアクセシビリティラベルが正しいこと（未お気に入り）", () => {
      // Arrange
      const article = createMockArticle({ isFavorite: false });
      const onToggleFavorite = jest.fn();

      // Act
      const { getByLabelText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(getByLabelText("お気に入りに追加")).toBeDefined();
    });

    it("お気に入りボタンのアクセシビリティラベルが正しいこと（お気に入り済み）", () => {
      // Arrange
      const article = createMockArticle({ isFavorite: true });
      const onToggleFavorite = jest.fn();

      // Act
      const { getByLabelText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(getByLabelText("お気に入りを解除")).toBeDefined();
    });

    it("お気に入りボタン押下時にコールバックが呼ばれること", () => {
      // Arrange
      const article = createMockArticle({ id: "article-123", isFavorite: false });
      const onToggleFavorite = jest.fn();

      // Act
      const { getByLabelText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );
      fireEvent.press(getByLabelText("お気に入りに追加"));

      // Assert
      expect(onToggleFavorite).toHaveBeenCalledWith("article-123", true);
    });

    it("お気に入り済みの記事で解除コールバックが呼ばれること", () => {
      // Arrange
      const article = createMockArticle({ id: "article-456", isFavorite: true });
      const onToggleFavorite = jest.fn();

      // Act
      const { getByLabelText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );
      fireEvent.press(getByLabelText("お気に入りを解除"));

      // Assert
      expect(onToggleFavorite).toHaveBeenCalledWith("article-456", false);
    });
  });

  describe("アクセシビリティ", () => {
    it("記事カードにアクセシビリティラベルが設定されていること", () => {
      // Arrange
      const article = createMockArticle({ title: "アクセシブルな記事" });
      const onToggleFavorite = jest.fn();

      // Act
      const { getByLabelText } = render(
        <ArticleCard article={article} onToggleFavorite={onToggleFavorite} />,
      );

      // Assert
      expect(getByLabelText("アクセシブルな記事を開く")).toBeDefined();
=======
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
>>>>>>> origin/main
    });
  });
});
