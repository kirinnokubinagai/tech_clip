import { OAuthButtons } from "@mobile/components/auth/OAuthButtons";
import { render } from "@testing-library/react-native";
import * as ReactNative from "react-native";

jest.mock("@/lib/api", () => ({
  fetchWithTimeout: jest.fn(),
  getBaseUrl: jest.fn(() => "http://localhost:3000"),
}));

const DEFAULT_PROPS = {
  mode: "login" as const,
  isAnySubmitting: false,
  onError: jest.fn(),
  onLoadingChange: jest.fn(),
  loadingProvider: null,
};

describe("OAuthButtons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("GitHub アイコンの fill 色", () => {
    it("ライトテーマのとき GitHub SVG xml に '#1c1917' の fill が含まれること", async () => {
      // Arrange
      jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

      // Act
      const { toJSON } = await render(<OAuthButtons {...DEFAULT_PROPS} />);
      const jsonStr = JSON.stringify(toJSON());

      // Assert: currentColor が含まれず、ライトテーマのテキスト色が含まれること
      expect(jsonStr).not.toContain("currentColor");
      expect(jsonStr).toContain("1c1917");
    });

    it("ダークテーマのとき GitHub SVG xml に '#e2e8f0' の fill が含まれること", async () => {
      // Arrange
      jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");

      // Act
      const { toJSON } = await render(<OAuthButtons {...DEFAULT_PROPS} />);
      const jsonStr = JSON.stringify(toJSON());

      // Assert: currentColor が含まれず、ダークテーマのテキスト色が含まれること
      expect(jsonStr).not.toContain("currentColor");
      expect(jsonStr).toContain("e2e8f0");
    });
  });

  describe("Google アイコン", () => {
    it("テーマによらず固定の 4 色ブランドカラーが xml に含まれること", async () => {
      // Arrange
      jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");

      // Act
      const { toJSON } = await render(<OAuthButtons {...DEFAULT_PROPS} />);
      const jsonStr = JSON.stringify(toJSON());

      // Assert: Google の 4 色は必ず存在する
      expect(jsonStr).toContain("EA4335");
      expect(jsonStr).toContain("4285F4");
      expect(jsonStr).toContain("FBBC05");
      expect(jsonStr).toContain("34A853");
    });
  });
});
