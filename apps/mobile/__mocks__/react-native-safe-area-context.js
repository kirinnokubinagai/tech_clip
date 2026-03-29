const React = jest.requireActual("react");

const SafeAreaProvider = ({ children }) => children;
const SafeAreaView = ({ children, ...props }) => React.createElement("div", props, children);
const SafeAreaInsetsContext = React.createContext({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

function useSafeAreaInsets() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function useSafeAreaFrame() {
  return { x: 0, y: 0, width: 390, height: 844 };
}

module.exports = {
  SafeAreaProvider,
  SafeAreaView,
  SafeAreaInsetsContext,
  useSafeAreaInsets,
  useSafeAreaFrame,
  SafeAreaFrameContext: React.createContext({ x: 0, y: 0, width: 390, height: 844 }),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  },
};
