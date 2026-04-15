import OnboardingScreen from "@mobile-app/onboarding";
import { render } from "@testing-library/react-native";

jest.mock("@/lib/constants", () => ({
  LIGHT_COLORS: { neutral: "#44403c" },
  SUPPORTED_SOURCE_COUNT: 19,
}));

jest.mock("@mobile/stores/ui-store", () => ({
  useUIStore: (
    selector: (state: { hasSeenOnboarding: boolean; setHasSeenOnboarding: jest.Mock }) => unknown,
  ) => selector({ hasSeenOnboarding: false, setHasSeenOnboarding: jest.fn() }),
}));

describe("mobile app smoke", () => {
  it("モジュールの読み込みと初期レンダーが例外なく完了すること", async () => {
    const { getByTestId } = await render(<OnboardingScreen />);

    expect(getByTestId("onboarding-title")).not.toBeNull();
    expect(getByTestId("skip-button")).not.toBeNull();
  });
});
