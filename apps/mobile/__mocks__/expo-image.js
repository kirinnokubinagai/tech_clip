/**
 * expo-imageのモック（css-interop非依存）
 *
 * forwardRefを使わず関数コンポーネントとして定義し、
 * HTML要素"img"を返すことでcss-interopのラッピングを回避する
 */
const React = jest.requireActual("react");

function Image({ testID, style, source, ...props }) {
  return React.createElement("img", {
    "data-testid": testID,
    testID,
    style,
    src: source?.uri || "",
    ...props,
  });
}
Image.displayName = "ExpoImage";

module.exports = { Image };
