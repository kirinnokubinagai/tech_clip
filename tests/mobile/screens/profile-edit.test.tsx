import ProfileEditScreen from "@mobile-app/profile/edit";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

jest.mock("@/components/ui/Toast", () => ({
  Toast: jest.fn(() => null),
}));

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
      const { getByTestId } = await render(<ProfileEditScreen />);

      // Act
      await fireEvent.press(getByTestId("button"));

      // Assert
      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });
    });

    it("保存成功後にトーストが表示状態になること", async () => {
      // Arrange
      const { Toast } = require("@/components/ui/Toast");
      const { getByTestId } = await render(<ProfileEditScreen />);

      // Act
      await fireEvent.press(getByTestId("button"));

      // Assert
      await waitFor(() => {
        const lastCall = Toast.mock.calls[Toast.mock.calls.length - 1];
        expect(lastCall[0].visible).toBe(true);
        expect(lastCall[0].message).toBe("プロフィールを更新しました");
      });
    });
  });

  describe("バリデーションエラー", () => {
    it("名前が空の場合エラーメッセージが表示されること", async () => {
      // Arrange
      const { getByTestId, getByPlaceholderText, getByText } = await render(<ProfileEditScreen />);
      const nameInput = getByPlaceholderText("名前を入力");
      await fireEvent.changeText(nameInput, "");

      // Act
      await fireEvent.press(getByTestId("button"));

      // Assert
      await waitFor(() => {
        expect(getByText("名前を入力してください")).toBeDefined();
      });
    });
  });
});
