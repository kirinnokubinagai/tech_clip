/** @shopify/flash-listのモック */
const React = require("react");
const { FlatList } = require("react-native");

/** FlashListのモック（FlatListにフォールバック） */
const FlashList = React.forwardRef(
  ({ data, renderItem, keyExtractor, ItemSeparatorComponent, ...props }, ref) =>
    React.createElement(FlatList, {
      data,
      renderItem,
      keyExtractor,
      ItemSeparatorComponent,
      ref,
      ...props,
    }),
);
FlashList.displayName = "FlashList";

module.exports = { FlashList };
