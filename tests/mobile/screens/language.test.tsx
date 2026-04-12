const mockSetLanguage = jest.fn().mockResolvedValue(undefined);
const mockLoadLanguage = jest.fn().mockResolvedValue(undefined);
const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock("@mobile/stores/settings-store", () => ({
  LANGUAGE_LABEL_MAP: {
    ja: "日本語",
    en: "English",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    ko: "한국어",
  },
  useSettingsStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      language: "ja",
      isLanguageLoaded: true,
      setLanguage: mockSetLanguage,
      loadLanguage: mockLoadLanguage,
    }),
  ),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

import LanguageScreen from "@mobile-app/settings/language";
import { fireEvent, render } from "@testing-library/react-native";

beforeEach(() => {
  jest.clearAllMocks();
  mockSetLanguage.mockResolvedValue(undefined);
});

describe("LanguageScreen", () => {
  describe("表示", () => {
    it("日本語が選択肢として表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<LanguageScreen />);

      // Assert
      expect(getByText("日本語")).toBeDefined();
    });

    it("Englishが選択肢として表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<LanguageScreen />);

      // Assert
      expect(getByText("English")).toBeDefined();
    });

    it("简体中文が選択肢として表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<LanguageScreen />);

      // Assert
      expect(getByText("简体中文")).toBeDefined();
    });

    it("繁體中文が選択肢として表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<LanguageScreen />);

      // Assert
      expect(getByText("繁體中文")).toBeDefined();
    });

    it("한국어が選択肢として表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<LanguageScreen />);

      // Assert
      expect(getByText("한국어")).toBeDefined();
    });
  });

  describe("言語選択", () => {
    it("日本語を選択するとsetLanguageが呼ばれること", async () => {
      // Arrange
      const { getByTestId } = await render(<LanguageScreen />);

      // Act
      await fireEvent.press(getByTestId("language-option-ja"));

      // Assert
      expect(mockSetLanguage).toHaveBeenCalledWith("ja");
    });

    it("Englishを選択するとsetLanguageが呼ばれること", async () => {
      // Arrange
      const { getByTestId } = await render(<LanguageScreen />);

      // Act
      await fireEvent.press(getByTestId("language-option-en"));

      // Assert
      expect(mockSetLanguage).toHaveBeenCalledWith("en");
    });

    it("简体中文を選択するとsetLanguageが呼ばれること", async () => {
      // Arrange
      const { getByTestId } = await render(<LanguageScreen />);

      // Act
      await fireEvent.press(getByTestId("language-option-zh-CN"));

      // Assert
      expect(mockSetLanguage).toHaveBeenCalledWith("zh-CN");
    });

    it("繁體中文を選択するとsetLanguageが呼ばれること", async () => {
      // Arrange
      const { getByTestId } = await render(<LanguageScreen />);

      // Act
      await fireEvent.press(getByTestId("language-option-zh-TW"));

      // Assert
      expect(mockSetLanguage).toHaveBeenCalledWith("zh-TW");
    });

    it("한국어を選択するとsetLanguageが呼ばれること", async () => {
      // Arrange
      const { getByTestId } = await render(<LanguageScreen />);

      // Act
      await fireEvent.press(getByTestId("language-option-ko"));

      // Assert
      expect(mockSetLanguage).toHaveBeenCalledWith("ko");
    });

    it("言語を選択すると前の画面に戻ること", async () => {
      // Arrange
      const { getByTestId } = await render(<LanguageScreen />);

      // Act
      await fireEvent.press(getByTestId("language-option-en"));

      // Assert
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("現在の選択状態", () => {
    it("現在選択中の言語（ja）にチェックアイコンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<LanguageScreen />);

      // Assert
      expect(getByTestId("language-check-ja")).toBeDefined();
    });
  });
});
