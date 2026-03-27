import { fireEvent, render } from "@testing-library/react-native";

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
    });
  });
});
