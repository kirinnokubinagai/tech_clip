import * as ReactNative from "react-native";
import { renderHook } from "@testing-library/react-native";
import { useColors } from "../../../apps/mobile/src/hooks/use-colors";
import { DARK_COLORS } from "../../../apps/mobile/src/lib/constants";

describe("useColors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ダークモードのとき DARK_COLORS を返すこと", async () => {
    // Arrange
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");

    // Act
    const { result } = await renderHook(() => useColors());

    // Assert
    expect(result.current).toBe(DARK_COLORS);
  });

  it("現在 || true により常に DARK_COLORS を返すこと（ライトモード設定でも）", async () => {
    // Arrange
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    // Act
    // TODO: ライトモード対応時に || true を除去すると LIGHT_COLORS が返る
    const { result } = await renderHook(() => useColors());

    // Assert
    expect(result.current).toBe(DARK_COLORS);
  });

  it("colorScheme が null のとき DARK_COLORS を返すこと", async () => {
    // Arrange
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(null);

    // Act
    const { result } = await renderHook(() => useColors());

    // Assert
    expect(result.current).toBe(DARK_COLORS);
  });
});
