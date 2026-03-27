import { useCallback } from "react";
import { Linking, Platform, StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";

type ArticleReaderProps = {
  content: string;
};

/** 本文テキストのフォントサイズ */
const BODY_FONT_SIZE = 16;

/** 見出しのフォントサイズ（H1） */
const H1_FONT_SIZE = 24;

/** 見出しのフォントサイズ（H2） */
const H2_FONT_SIZE = 20;

/** 見出しのフォントサイズ（H3） */
const H3_FONT_SIZE = 18;

/** コードブロックのフォントサイズ */
const CODE_FONT_SIZE = 14;

/** コードブロックの角丸 */
const CODE_BORDER_RADIUS = 8;

/** コードブロックのパディング */
const CODE_PADDING = 12;

/** テーマカラー定数 */
const THEME = {
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  codeBg: "#13131a",
  codeBorder: "#2d2d44",
  link: "#818cf8",
  blockquoteBorder: "#6366f1",
  blockquoteBg: "#13131a",
  hrColor: "#2d2d44",
} as const;

const markdownStyles = StyleSheet.create({
  body: {
    color: THEME.text,
    fontSize: BODY_FONT_SIZE,
    lineHeight: BODY_FONT_SIZE * 1.75,
  },
  heading1: {
    color: THEME.text,
    fontSize: H1_FONT_SIZE,
    fontWeight: "700" as const,
    marginTop: 24,
    marginBottom: 12,
  },
  heading2: {
    color: THEME.text,
    fontSize: H2_FONT_SIZE,
    fontWeight: "600" as const,
    marginTop: 20,
    marginBottom: 10,
  },
  heading3: {
    color: THEME.text,
    fontSize: H3_FONT_SIZE,
    fontWeight: "600" as const,
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    marginTop: 8,
    marginBottom: 8,
  },
  link: {
    color: THEME.link,
    textDecorationLine: "underline" as const,
  },
  code_inline: {
    backgroundColor: THEME.codeBg,
    color: THEME.link,
    fontSize: CODE_FONT_SIZE,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  code_block: {
    backgroundColor: THEME.codeBg,
    color: THEME.text,
    fontSize: CODE_FONT_SIZE,
    borderRadius: CODE_BORDER_RADIUS,
    padding: CODE_PADDING,
    borderWidth: 1,
    borderColor: THEME.codeBorder,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  fence: {
    backgroundColor: THEME.codeBg,
    color: THEME.text,
    fontSize: CODE_FONT_SIZE,
    borderRadius: CODE_BORDER_RADIUS,
    padding: CODE_PADDING,
    borderWidth: 1,
    borderColor: THEME.codeBorder,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  blockquote: {
    backgroundColor: THEME.blockquoteBg,
    borderLeftWidth: 3,
    borderLeftColor: THEME.blockquoteBorder,
    paddingLeft: 12,
    paddingVertical: 4,
    marginVertical: 8,
  },
  list_item: {
    marginVertical: 4,
  },
  bullet_list: {
    marginVertical: 8,
  },
  ordered_list: {
    marginVertical: 8,
  },
  hr: {
    backgroundColor: THEME.hrColor,
    height: 1,
    marginVertical: 16,
  },
  image: {
    borderRadius: 8,
  },
  strong: {
    fontWeight: "700" as const,
  },
  em: {
    fontStyle: "italic" as const,
  },
});

/**
 * Markdownコンテンツをレンダリングするコンポーネント
 *
 * @param content - Markdown形式の文字列
 */
export function ArticleReader({ content }: ArticleReaderProps) {
  const handleLinkPress = useCallback((url: string) => {
    Linking.openURL(url);
    return false;
  }, []);

  return (
    <Markdown style={markdownStyles} onLinkPress={handleLinkPress}>
      {content}
    </Markdown>
  );
}
