import { fireEvent, render } from "@testing-library/react-native";

import { containsText, findByTestId, queryByTestId } from "@/test-helpers";

import { ArticleCard } from "../ArticleCard";

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
    it("タイトルが正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(containsText(UNSAFE_root, "React Nativeのパフォーマンス最適化ガイド")).toBe(true);
    });

    it("著者名が正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(containsText(UNSAFE_root, "tech_writer")).toBe(true);
    });

    it("ソースバッジが正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(containsText(UNSAFE_root, "zenn")).toBe(true);
    });

    it("概要が正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(
        containsText(
          UNSAFE_root,
          "React Nativeアプリのパフォーマンスを改善するための実践的なテクニックを紹介します。",
        ),
      ).toBe(true);
    });

    it("サムネイルがnullの場合も正常にレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "article-thumbnail")).toBeNull();
    });
  });

  describe("オプショナルフィールド", () => {
    it("著者名がnullの場合も正常にレンダリングできること", () => {
      // Arrange
      const article = { ...BASE_ARTICLE, author: null };

      // Act
      const { UNSAFE_root } = render(<ArticleCard article={article} onPress={() => {}} />);

      // Assert
      expect(containsText(UNSAFE_root, "React Nativeのパフォーマンス最適化ガイド")).toBe(true);
    });

    it("概要がnullの場合も正常にレンダリングできること", () => {
      // Arrange
      const article = { ...BASE_ARTICLE, excerpt: null };

      // Act
      const { UNSAFE_root } = render(<ArticleCard article={article} onPress={() => {}} />);

      // Assert
      expect(containsText(UNSAFE_root, "React Nativeのパフォーマンス最適化ガイド")).toBe(true);
    });

    it("公開日がnullの場合も正常にレンダリングできること", () => {
      // Arrange
      const article = { ...BASE_ARTICLE, publishedAt: null };

      // Act
      const { UNSAFE_root } = render(<ArticleCard article={article} onPress={() => {}} />);

      // Assert
      expect(containsText(UNSAFE_root, "React Nativeのパフォーマンス最適化ガイド")).toBe(true);
    });
  });

  describe("インタラクション", () => {
    it("カードタップ時にonPressが呼ばれること", () => {
      // Arrange
      const onPress = jest.fn();
      const { UNSAFE_root } = render(<ArticleCard article={BASE_ARTICLE} onPress={onPress} />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "article-card"));

      // Assert
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("お気に入りボタンタップ時にonToggleFavoriteが呼ばれること", () => {
      // Arrange
      const onToggleFavorite = jest.fn();
      const { UNSAFE_root } = render(
        <ArticleCard
          article={BASE_ARTICLE}
          onPress={() => {}}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "favorite-button"));

      // Assert
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    });

    it("お気に入り状態がtrueの場合にお気に入りアイコンが塗りつぶされること", () => {
      // Arrange
      const article = { ...BASE_ARTICLE, isFavorite: true };

      // Act
      const { UNSAFE_root } = render(
        <ArticleCard article={article} onPress={() => {}} onToggleFavorite={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "favorite-icon-filled")).toBeDefined();
    });

    it("お気に入り状態がfalseの場合にお気に入りアイコンがアウトラインであること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ArticleCard article={BASE_ARTICLE} onPress={() => {}} onToggleFavorite={() => {}} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "favorite-icon-outline")).toBeDefined();
    });
  });

  describe("日付フォーマット", () => {
    it("公開日がフォーマットされて表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleCard article={BASE_ARTICLE} onPress={() => {}} />);

      // Assert
      expect(containsText(UNSAFE_root, "2025/03/15")).toBe(true);
    });
  });
});
