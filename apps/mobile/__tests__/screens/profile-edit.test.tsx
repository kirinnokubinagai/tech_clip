import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import ProfileEditScreen from "../../app/profile/edit";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("../../src/stores/auth-store", () => ({
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
      render(<ProfileEditScreen />);

      // Act
      fireEvent.press(screen.getByText("保存する"));

      // Assert
      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });
    });

    it("保存成功後にトーストメッセージが表示されること", async () => {
      // Arrange
      render(<ProfileEditScreen />);

      // Act
      fireEvent.press(screen.getByText("保存する"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("プロフィールを更新しました")).toBeTruthy();
      });
    });
  });

  describe("バリデーションエラー", () => {
    it("名前が空の場合エラーメッセージが表示されること", async () => {
      // Arrange
      render(<ProfileEditScreen />);
      const nameInput = screen.getByPlaceholderText("名前を入力");
      fireEvent.changeText(nameInput, "");

      // Act
      fireEvent.press(screen.getByText("保存する"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("名前を入力してください")).toBeTruthy();
      });
    });
  });
});
