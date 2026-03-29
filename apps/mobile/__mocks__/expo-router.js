const React = jest.requireActual("react");

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: jest.fn(),
  navigate: jest.fn(),
};

const mockSegments = [];
const mockPathname = "/";

module.exports = {
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  useSegments: () => mockSegments,
  usePathname: () => mockPathname,
  useRootNavigation: () => ({ navigate: jest.fn() }),
  useRootNavigationState: () => ({ key: "root" }),
  Link: ({ children, ...props }) => React.createElement("a", props, children),
  Stack: {
    Screen: ({ children }) => children || null,
  },
  Tabs: {
    Screen: ({ children }) => children || null,
  },
  Slot: ({ children }) => children || null,
  router: mockRouter,
  Redirect: () => null,
  useFocusEffect: jest.fn(),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
};
