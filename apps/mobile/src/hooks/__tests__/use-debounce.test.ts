import { act, renderHook } from "@testing-library/react-native";

import { useDebounce } from "../use-debounce";

/** デフォルトのデバウンス遅延（ミリ秒） */
const DEFAULT_DELAY_MS = 300;

describe("useDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("初期値", () => {
    it("初期値がそのまま返されること", () => {
      // Arrange & Act
      const { result } = renderHook(() => useDebounce("初期値", DEFAULT_DELAY_MS));

      // Assert
      expect(result.current).toBe("初期値");
    });

    it("空文字の初期値が返されること", () => {
      // Arrange & Act
      const { result } = renderHook(() => useDebounce("", DEFAULT_DELAY_MS));

      // Assert
      expect(result.current).toBe("");
    });
  });

  describe("デバウンス動作", () => {
    it("遅延時間経過前は値が更新されないこと", () => {
      // Arrange
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: "初期値", delay: DEFAULT_DELAY_MS },
      });

      // Act
      rerender({ value: "更新値", delay: DEFAULT_DELAY_MS });

      // Assert
      expect(result.current).toBe("初期値");
    });

    it("遅延時間経過後に値が更新されること", () => {
      // Arrange
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: "初期値", delay: DEFAULT_DELAY_MS },
      });

      // Act
      rerender({ value: "更新値", delay: DEFAULT_DELAY_MS });
      act(() => {
        jest.advanceTimersByTime(DEFAULT_DELAY_MS);
      });

      // Assert
      expect(result.current).toBe("更新値");
    });

    it("連続入力時は最後の値のみが反映されること", () => {
      // Arrange
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: "a", delay: DEFAULT_DELAY_MS },
      });

      // Act
      rerender({ value: "ab", delay: DEFAULT_DELAY_MS });
      act(() => {
        jest.advanceTimersByTime(100);
      });
      rerender({ value: "abc", delay: DEFAULT_DELAY_MS });
      act(() => {
        jest.advanceTimersByTime(DEFAULT_DELAY_MS);
      });

      // Assert
      expect(result.current).toBe("abc");
    });
  });

  describe("カスタム遅延", () => {
    it("指定した遅延時間でデバウンスされること", () => {
      // Arrange
      const customDelay = 500;
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: "初期値", delay: customDelay },
      });

      // Act
      rerender({ value: "更新値", delay: customDelay });
      act(() => {
        jest.advanceTimersByTime(DEFAULT_DELAY_MS);
      });

      // Assert（300ms経過時点ではまだ更新されない）
      expect(result.current).toBe("初期値");

      // Act（500ms経過で更新される）
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Assert
      expect(result.current).toBe("更新値");
    });
  });
});
