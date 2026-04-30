import { renderHook } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { useColors } from "../../../apps/mobile/src/hooks/use-colors";
import { DARK_COLORS, LIGHT_COLORS } from "../../../apps/mobile/src/lib/constants";

describe("useColors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("colorScheme が 'dark' のとき DARK_COLORS を返すこと", async () => {
    // Arrange
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");

    // Act
    const { result } = await renderHook(() => useColors());

    // Assert
    expect(result.current).toBe(DARK_COLORS);
  });

  it("colorScheme が 'light' のとき LIGHT_COLORS を返すこと", async () => {
    // Arrange
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    // Act
    const { result } = await renderHook(() => useColors());

    // Assert
    expect(result.current).toBe(LIGHT_COLORS);
  });

  it("colorScheme が null のとき LIGHT_COLORS を返すこと", async () => {
    // Arrange
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(null);

    // Act
    const { result } = await renderHook(() => useColors());

    // Assert
    expect(result.current).toBe(LIGHT_COLORS);
  });
});
