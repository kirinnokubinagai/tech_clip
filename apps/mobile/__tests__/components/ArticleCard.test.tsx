import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

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

/**
 * propsでReactTestInstanceを検索するヘルパー
 */
function findByTestId(root: ReactTestInstance, testId: string): ReactTestInstance {
  return root.findByProps({ testID: testId });
}

function queryByTestId(root: ReactTestInstance, testId: string): ReactTestInstance | null {
  const results = root.findAllByProps({ testID: testId });
  return results.length > 0 ? results[0] : null;
}

describe("ArticleCard", () => {
  describe("レンダリング", () => {
    it("記事カードが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />);

      // Assert
      expect(findByTestId(UNSAFE_root, "article-card")).toBeDefined();
    });

    it("記事タイトルが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );
      const texts = UNSAFE_getAllByType(Text).flatMap((n) => n.props.children);

      // Assert
      expect(texts).toContain("TypeScriptの型システム入門");
    });

    it("記事ソース（バッジ）が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );
      const texts = UNSAFE_getAllByType(Text).flatMap((n) => n.props.children);

      // Assert
      expect(texts).toContain("zenn");
    });

    it("著者が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );
      const texts = UNSAFE_getAllByType(Text).flatMap((n) => n.props.children);

      // Assert
      expect(texts).toContain("テスト著者");
    });

    it("概要が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );
      const texts = UNSAFE_getAllByType(Text).flatMap((n) => n.props.children);

      // Assert
      expect(texts).toContain("TypeScriptの型システムについて解説します。");
    });

    it("公開日がYYYY/MM/DD形式で表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />,
      );
      const texts = UNSAFE_getAllByType(Text).flatMap((n) => n.props.children);

      // Assert
      expect(texts).toContain("2024/01/15");
    });

    it("thumbnailUrlがnullの場合サムネイルが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ArticleCard article={{ ...BASE_ARTICLE, thumbnailUrl: null }} onPress={jest.fn()} />,
      );

      // Assert
      expect(queryByTestId(UNSAFE_root, "article-thumbnail")).toBeNull();
    });

    it("thumbnailUrlが存在する場合サムネイルが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ArticleCard
          article={{ ...BASE_ARTICLE, thumbnailUrl: "https://example.com/img.png" }}
          onPress={jest.fn()}
        />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "article-thumbnail")).toBeDefined();
    });

    it("authorがnullの場合著者が表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <ArticleCard article={{ ...BASE_ARTICLE, author: null }} onPress={jest.fn()} />,
      );
      const texts = UNSAFE_getAllByType(Text).flatMap((n) => n.props.children);

      // Assert
      expect(texts).not.toContain("テスト著者");
    });

    it("publishedAtがnullの場合日付が表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <ArticleCard article={{ ...BASE_ARTICLE, publishedAt: null }} onPress={jest.fn()} />,
      );
      const texts = UNSAFE_getAllByType(Text).flatMap((n) => n.props.children);

      // Assert
      expect(texts).not.toContain("2024/01/15");
    });
  });

  describe("お気に入りボタン", () => {
    it("onToggleFavoriteが未指定の場合お気に入りボタンが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "favorite-button")).toBeNull();
    });

    it("onToggleFavoriteが指定された場合お気に入りボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} onToggleFavorite={jest.fn()} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "favorite-button")).toBeDefined();
    });

    it("isFavoriteがfalseの場合アウトラインアイコンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ArticleCard
          article={{ ...BASE_ARTICLE, isFavorite: false }}
          onPress={jest.fn()}
          onToggleFavorite={jest.fn()}
        />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "favorite-icon-outline")).toBeDefined();
    });

    it("isFavoriteがtrueの場合塗りつぶしアイコンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ArticleCard
          article={{ ...BASE_ARTICLE, isFavorite: true }}
          onPress={jest.fn()}
          onToggleFavorite={jest.fn()}
        />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "favorite-icon-filled")).toBeDefined();
    });

    it("お気に入りボタンタップ時にonToggleFavoriteが呼ばれること", () => {
      // Arrange
      const onToggleFavorite = jest.fn();
      const { UNSAFE_root } = render(
        <ArticleCard
          article={BASE_ARTICLE}
          onPress={jest.fn()}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "favorite-button"));

      // Assert
      expect(onToggleFavorite).toHaveBeenCalledTimes(1);
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
  });

  describe("アクセシビリティ", () => {
    it("カードにaccessibilityLabelが設定されていること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ArticleCard article={BASE_ARTICLE} onPress={jest.fn()} />);

      // Assert
      const card = findByTestId(UNSAFE_root, "article-card");
      expect(card.props.accessibilityLabel).toBe("TypeScriptの型システム入門");
    });
  });
});
