import { fireEvent, render } from "@testing-library/react-native";

import { ArticleCard } from "../ArticleCard";

/** テスト用の記事データ */
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
};

describe("ArticleCard", () => {
  describe("レンダリング", () => {
    it("記事タイトルが表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={MOCK_ARTICLE} />);

      // Assert
      expect(getByText("React Hooksの基礎")).toBeDefined();
    });

    it("ソース名が表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<ArticleCard article={MOCK_ARTICLE} />);

      // Assert
      expect(getByText("zenn")).toBeDefined();
    });

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
    });
  });

  describe("オプショナルフィールド", () => {
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
    });
  });

  describe("インタラクション", () => {
    it("onPress指定時にタップでコールバックが呼ばれること", () => {
      // Arrange
      const onPress = jest.fn();

      // Act
      const { getByText } = render(<ArticleCard article={MOCK_ARTICLE} onPress={onPress} />);
      fireEvent.press(getByText("React Hooksの基礎"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
