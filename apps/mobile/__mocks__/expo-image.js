const React = require("react");
const { View } = require("react-native");

/** expo-imageのモック */
const Image = React.forwardRef(({ testID, style, source, ...props }, ref) =>
  React.createElement(View, { testID, style, ref, ...props }),
);
Image.displayName = "ExpoImage";

module.exports = { Image };
