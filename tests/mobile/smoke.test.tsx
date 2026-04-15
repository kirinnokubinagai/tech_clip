import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react-native";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../apps/mobile/src/lib/notifications", () => ({
  registerPushTokenOnly: jest.fn(),
  requestNotificationPermission: jest.fn().mockResolvedValue("granted"),
  setupNotificationHandlers: jest.fn().mockReturnValue(() => {}),
}));

jest.mock("../../apps/mobile/src/lib/backgroundSync", () => ({
  DEFAULT_BACKGROUND_SYNC_CONFIG: {},
  registerNativeBackgroundFetch: jest.fn().mockResolvedValue(undefined),
  startBackgroundSync: jest.fn().mockReturnValue(() => {}),
}));

jest.mock("../../apps/mobile/src/lib/revenueCat", () => ({
  configureRevenueCat: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../apps/mobile/src/lib/tracking", () => ({
  requestTrackingPermission: jest.fn().mockResolvedValue("authorized"),
}));

jest.mock("../../apps/mobile/src/lib/sentry", () => ({
  initSentry: jest.fn(),
}));

import App from "../../apps/mobile/app/_layout";

describe("App smoke test", () => {
  it("module が読み込めてレンダリングできること", () => {
    const tree = render(<App />);
    expect(tree).toBeDefined();
  });
});
