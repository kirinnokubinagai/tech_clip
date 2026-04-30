-- trigram FTS5 を standalone 方式に変更 + パディング追加 + fts5vocab 作成
--
-- [変更理由] fts5vocab は external content テーブル（content='articles'）に対応しない。
-- standalone FTS5（content= なし）でデータを直接格納することで fts5vocab が使用可能になる。
--
-- [パディング] 末尾に「🐤🐤」を付加し、末尾1〜2文字も trigram インデックスに収まるようにする。
-- 例: "Go言語入門🐤🐤" → trigrams: Go言, o言語, 言語入, ... 入門🐤, 門🐤🐤
-- これにより "Go"(2文字) を vocab lookup で検索可能になる。

DROP TRIGGER IF EXISTS `articles_ai_fts`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `articles_ad_fts`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `articles_au_fts`;
--> statement-breakpoint
DROP TABLE IF EXISTS `articles_fts`;
--> statement-breakpoint

-- standalone FTS5（content= なし）で再作成
-- rowid は articles テーブルの rowid と一致させて結合に使用する
CREATE VIRTUAL TABLE `articles_fts` USING fts5(
  title,
  content,
  excerpt,
  tokenize='trigram'
);
--> statement-breakpoint

-- 既存データをパディング付きで投入
INSERT INTO `articles_fts`(rowid, title, content, excerpt)
SELECT
  rowid,
  title || '🐤🐤',
  CASE WHEN content IS NULL THEN NULL ELSE content || '🐤🐤' END,
  CASE WHEN excerpt IS NULL THEN NULL ELSE excerpt || '🐤🐤' END
FROM articles;
--> statement-breakpoint

-- INSERT トリガー（パディング付き）
CREATE TRIGGER `articles_ai_fts` AFTER INSERT ON `articles` BEGIN
  INSERT INTO `articles_fts`(rowid, title, content, excerpt)
  VALUES (
    new.rowid,
    new.title || '🐤🐤',
    CASE WHEN new.content IS NULL THEN NULL ELSE new.content || '🐤🐤' END,
    CASE WHEN new.excerpt IS NULL THEN NULL ELSE new.excerpt || '🐤🐤' END
  );
END;
--> statement-breakpoint

-- DELETE トリガー（standalone FTS は rowid で直接 DELETE）
CREATE TRIGGER `articles_ad_fts` AFTER DELETE ON `articles` BEGIN
  DELETE FROM `articles_fts` WHERE rowid = old.rowid;
END;
--> statement-breakpoint

-- UPDATE トリガー（DELETE + INSERT の 2 段階）
CREATE TRIGGER `articles_au_fts` AFTER UPDATE ON `articles` BEGIN
  DELETE FROM `articles_fts` WHERE rowid = old.rowid;
  INSERT INTO `articles_fts`(rowid, title, content, excerpt)
  VALUES (
    new.rowid,
    new.title || '🐤🐤',
    CASE WHEN new.content IS NULL THEN NULL ELSE new.content || '🐤🐤' END,
    CASE WHEN new.excerpt IS NULL THEN NULL ELSE new.excerpt || '🐤🐤' END
  );
END;
--> statement-breakpoint

-- fts5vocab: standalone FTS5 なので使用可能
-- term LIKE 'Go%' で vocab lookup し、2文字以下のクエリを OR 式に変換する
CREATE VIRTUAL TABLE IF NOT EXISTS `articles_fts_vocab` USING fts5vocab('articles_fts', 'row');
