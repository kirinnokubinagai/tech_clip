import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { containsText, findByTestId } from "@/test-helpers";

import ProfileEditScreen from "../../app/profile/edit";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("@/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({ user: { name: "テストユーザー", image: null } }),
  ),
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}));

jest.spyOn(Alert, "alert");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ProfileEditScreen", () => {
  describe("保存成功時のフィードバック", () => {
    it("保存ボタンを押すと保存処理が実行されること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<ProfileEditScreen />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "button"));

      // Assert
      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });
    });

    it("保存成功後にトーストメッセージが表示されること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<ProfileEditScreen />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "プロフィールを更新しました")).toBe(true);
      });
    });
  });

  describe("バリデーションエラー", () => {
    it("名前が空の場合エラーメッセージが表示されること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<ProfileEditScreen />);
      const nameInput = UNSAFE_root.findByProps({ placeholder: "名前を入力" });
      fireEvent.changeText(nameInput, "");

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "名前を入力してください")).toBe(true);
      });
    });
  });
});
