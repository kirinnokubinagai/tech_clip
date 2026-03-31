import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { ArticleCard } from "../../src/components/ArticleCard";
import type { ArticleCardArticle } from "../../src/components/ArticleCard";

/** テスト用の基本記事データ */
const BASE_ARTICLE: ArticleCardArticle = {
  id: "article-1",
  title: "TypeScriptの型システム入門",
  author: "テスト著者",
  source: "zenn",
  publishedAt: "2024-01-15T00:00:00.000Z",
  excerpt: "TypeScriptの型システムについて解説します。",
  thumbnailUrl: null,
  isFavorite: false,
};

describe("ArticleCard", () => {
  describe("レンダリング", () => {
    it("記事カードが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );

      // Assert
      expect(getByTestId("article-card")).toBeDefined();
    });

    it("記事タイトルが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );

      // Assert
      expect(getByText("TypeScriptの型システム入門")).toBeTruthy();
    });

    it("記事ソース（バッジ）が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );

      // Assert
      expect(getByText("zenn")).toBeTruthy();
    });

    it("著者が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );

      // Assert
      expect(getByText("テスト著者")).toBeTruthy();
    });

    it("概要が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );

      // Assert
      expect(getByText("TypeScriptの型システムについて解説します。")).toBeTruthy();
    });

    it("公開日がYYYY/MM/DD形式で表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );

      // Assert
      expect(getByText("2024/01/15")).toBeTruthy();
    });

    it("thumbnailUrlがnullの場合サムネイルが表示されないこと", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(
        <ArticleCard article={{ ...BASE_ARTICLE, thumbnailUrl: null }} onPress={jest.fn()} />,
      );

      // Assert
      expect(queryByTestId("article-thumbnail")).toBeNull();
    });

    it("thumbnailUrlが存在する場合サムネイルが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ArticleCard
          article={{ ...BASE_ARTICLE, thumbnailUrl: "https://example.com/img.png" }}
          onPress={jest.fn()}
        />,
      );

      // Assert
      expect(getByTestId("article-thumbnail")).toBeDefined();
    });

    it("authorがnullの場合著者が表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = await render(
        <ArticleCard article={{ ...BASE_ARTICLE, author: null }} onPress={jest.fn()} />,
      );

      // Assert
      expect(queryByText("テスト著者")).toBeNull();
    });

    it("publishedAtがnullの場合日付が表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = await render(
        <ArticleCard article={{ ...BASE_ARTICLE, publishedAt: null }} onPress={jest.fn()} />,
      );

      // Assert
      expect(queryByText("2024/01/15")).toBeNull();
    });
  });

  describe("お気に入りボタン", () => {
    it("onToggleFavoriteが未指定の場合お気に入りボタンが表示されないこと", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );

      // Assert
      expect(queryByTestId("favorite-button")).toBeNull();
    });

    it("onToggleFavoriteが指定された場合お気に入りボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} onToggleFavorite={jest.fn()} />,
      );

      // Assert
      expect(getByTestId("favorite-button")).toBeDefined();
    });

    it("isFavoriteがfalseの場合アウトラインアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ArticleCard
          article={{ ...BASE_ARTICLE, isFavorite: false }}
          onPress={jest.fn()}
          onToggleFavorite={jest.fn()}
        />,
      );

      // Assert
      expect(getByTestId("favorite-icon-outline")).toBeDefined();
    });

    it("isFavoriteがtrueの場合塗りつぶしアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ArticleCard
          article={{ ...BASE_ARTICLE, isFavorite: true }}
          onPress={jest.fn()}
          onToggleFavorite={jest.fn()}
        />,
      );

      // Assert
      expect(getByTestId("favorite-icon-filled")).toBeDefined();
    });

    it("お気に入りボタンタップ時にonToggleFavoriteが呼ばれること", async () => {
      // Arrange
      const onToggleFavorite = jest.fn();
      const { getByTestId } = await render(
        <ArticleCard
          article={BASE_ARTICLE}
          onPress={jest.fn()}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      // Act
      await fireEvent.press(getByTestId("favorite-button"));

      // Assert
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
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
  });

  describe("アクセシビリティ", () => {
    it("カードにaccessibilityLabelが設定されていること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );

      // Assert
      const card = getByTestId("article-card");
      expect(card.props.accessibilityLabel).toBe("TypeScriptの型システム入門");
    });
  });
});
