import { render } from "@testing-library/react-native";

import { Skeleton } from "../Skeleton";

describe("Skeleton", () => {
  describe("レンダリング", () => {
    it("デフォルトプロパティでレンダリングできること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<Skeleton />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });

    it("幅と高さを指定してレンダリングできること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<Skeleton width={200} height={20} />);

      // Assert
      const tree = toJSON();
      expect(tree).not.toBeNull();
    });

    it("パーセント指定でレンダリングできること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<Skeleton width="100%" height={16} />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });

  describe("プロパティ", () => {
    it("カスタムborderRadiusが適用されること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<Skeleton width={100} height={100} borderRadius={50} />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });

    it("追加のclassNameが適用されること", async () => {
      // Arrange & Act
      const { toJSON } = await render(<Skeleton width={100} height={20} className="mt-2" />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });
  });
});
