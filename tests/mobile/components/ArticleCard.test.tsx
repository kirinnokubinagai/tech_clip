import { ArticleCard } from "@mobile/components/ArticleCard";
import { fireEvent, render } from "@testing-library/react-native";

/** テスト用の記事データ（thumbnailUrlはnullで画像レンダリングを回避） */
const BASE_ARTICLE = {
  id: "01JTEST000000000000000001",
  title: "React Nativeのパフォーマンス最適化ガイド",
  author: "tech_writer",
  source: "zenn" as const,
  publishedAt: "2025-03-15T09:00:00.000Z",
  excerpt: "React Nativeアプリのパフォーマンスを改善するための実践的なテクニックを紹介します。",
  thumbnailUrl: null,
  isFavorite: false,
};

describe("ArticleCard", () => {
  describe("レンダリング", () => {
    it("タイトルが正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(getByText("React Nativeのパフォーマンス最適化ガイド")).toBeDefined();
    });

    it("著者名が正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(getByText("tech_writer")).toBeDefined();
    });

    it("ソースバッジが正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(getByText("Zenn")).toBeDefined();
    });

    it("概要が正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(
        getByText(
          "React Nativeアプリのパフォーマンスを改善するための実践的なテクニックを紹介します。",
        ),
      ).toBeDefined();
    });

    it("サムネイルがnullの場合も正常にレンダリングできること", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={() => {}} />,
      );

      // Assert
      expect(queryByTestId("article-thumbnail")).toBeNull();
    });
  });

  describe("オプショナルフィールド", () => {
    it("著者名がnullの場合も正常にレンダリングできること", async () => {
      // Arrange
      const article = { ...BASE_ARTICLE, author: null };

      // Act
      const { getByText } = await render(<ArticleCard article={article} onPress={() => {}} />);

      // Assert
      expect(getByText("React Nativeのパフォーマンス最適化ガイド")).toBeDefined();
    });

    it("概要がnullの場合も正常にレンダリングできること", async () => {
      // Arrange
      const article = { ...BASE_ARTICLE, excerpt: null };

      // Act
      const { getByText } = await render(<ArticleCard article={article} onPress={() => {}} />);

      // Assert
      expect(getByText("React Nativeのパフォーマンス最適化ガイド")).toBeDefined();
    });

    it("公開日がnullの場合も正常にレンダリングできること", async () => {
      // Arrange
      const article = { ...BASE_ARTICLE, publishedAt: null };

      // Act
      const { getByText } = await render(<ArticleCard article={article} onPress={() => {}} />);

      // Assert
      expect(getByText("React Nativeのパフォーマンス最適化ガイド")).toBeDefined();
    });
  });

  describe("インタラクション", () => {
    it("カードタップ時にonPressが呼ばれること", async () => {
      // Arrange
      const onPress = jest.fn();
      const { getByTestId } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={onPress} />,
      );

      // Act
      await fireEvent.press(getByTestId("article-card"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("お気に入りボタンタップ時にonToggleFavoriteが呼ばれること", async () => {
      // Arrange
      const onToggleFavorite = jest.fn();
      const { getByTestId } = await render(
        <ArticleCard
          article={BASE_ARTICLE}
          onPress={() => {}}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      // Act
      await fireEvent.press(getByTestId("favorite-button"));

      // Assert
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    });

    /**
     * React Native Testing Library の fireEvent は GestureResponderEvent を渡さないため
     * e?.stopPropagation() はテスト環境では呼ばれない。
     * onPress が onToggleFavorite のみ呼ばれ、親の onPress が呼ばれないことを確認する。
     */
    it("お気に入りボタンタップ時にカード詳細遷移（onPress）が発生しないこと", async () => {
      // Arrange
      const onPress = jest.fn();
      const onToggleFavorite = jest.fn();
      const { getByTestId } = await render(
        <ArticleCard
          article={BASE_ARTICLE}
          onPress={onPress}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      // Act
      await fireEvent.press(getByTestId("favorite-button"));

      // Assert
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
    });

    it("お気に入り状態がtrueの場合にお気に入りアイコンが塗りつぶされること", async () => {
      // Arrange
      const article = { ...BASE_ARTICLE, isFavorite: true };

      // Act
      const { getByTestId } = await render(
        <ArticleCard article={article} onPress={() => {}} onToggleFavorite={() => {}} />,
      );

      // Assert
      expect(getByTestId("favorite-icon-filled")).toBeDefined();
    });

    it("お気に入り状態がfalseの場合にお気に入りアイコンがアウトラインであること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={() => {}} onToggleFavorite={() => {}} />,
      );

      // Assert
      expect(getByTestId("favorite-icon-outline")).toBeDefined();
    });
  });

  describe("日付フォーマット", () => {
    it("公開日がフォーマットされて表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(getByText("2025/03/15")).toBeDefined();
    });
  });
});
