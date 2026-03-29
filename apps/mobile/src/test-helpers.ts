import type { ReactTestInstance } from "react-test-renderer";

/**
 * testIDでReactTestInstanceを検索する
 *
 * @param root - UNSAFE_rootから取得したルートインスタンス
 * @param testId - 検索するtestID
 * @returns 見つかったインスタンス
 * @throws 見つからない場合はエラー
 */
export function findByTestId(root: ReactTestInstance, testId: string): ReactTestInstance {
  return root.findByProps({ testID: testId });
}

/**
 * testIDでReactTestInstanceを検索する（見つからない場合はnull）
 *
 * @param root - UNSAFE_rootから取得したルートインスタンス
 * @param testId - 検索するtestID
 * @returns 見つかったインスタンスまたはnull
 */
export function queryByTestId(root: ReactTestInstance, testId: string): ReactTestInstance | null {
  const results = root.findAllByProps({ testID: testId });
  return results.length > 0 ? results[0] : null;
}

/**
 * ツリー内のすべてのテキストコンテンツを収集する
 *
 * @param root - UNSAFE_rootから取得したルートインスタンス
 * @returns テキスト文字列の配列
 */
export function getAllTextContent(root: ReactTestInstance): string[] {
  const texts: string[] = [];
  function walk(node: ReactTestInstance | string) {
    if (typeof node === "string") {
      texts.push(node);
      return;
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child as ReactTestInstance | string);
      }
    }
  }
  walk(root);
  return texts.filter(Boolean);
}

/**
 * ツリー内に指定テキストが含まれるか確認する
 *
 * @param root - UNSAFE_rootから取得したルートインスタンス
 * @param text - 検索するテキスト
 * @returns テキストが含まれる場合はtrue
 */
export function containsText(root: ReactTestInstance, text: string): boolean {
  return getAllTextContent(root).some((t) => t.includes(text));
}

/**
 * propsで要素を検索する
 *
 * @param root - UNSAFE_rootから取得したルートインスタンス
 * @param props - 検索するprops
 * @returns 見つかったインスタンス
 */
export function findByProps(
  root: ReactTestInstance,
  props: Record<string, unknown>,
): ReactTestInstance {
  return root.findByProps(props);
}

/**
 * propsで要素を検索する（見つからない場合はnull）
 *
 * @param root - UNSAFE_rootから取得したルートインスタンス
 * @param props - 検索するprops
 * @returns 見つかったインスタンスまたはnull
 */
export function queryByProps(
  root: ReactTestInstance,
  props: Record<string, unknown>,
): ReactTestInstance | null {
  const results = root.findAllByProps(props);
  return results.length > 0 ? results[0] : null;
}
