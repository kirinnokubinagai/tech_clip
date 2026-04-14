-- 外部コンテンツ FTS5 仮想テーブル
-- articles テーブルの title / content / excerpt を全文検索するためのインデックス
CREATE VIRTUAL TABLE `articles_fts` USING fts5(
  title,
  content,
  excerpt,
  content='articles',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint

-- 既存データを FTS に取り込む（初回ビルド）
INSERT INTO `articles_fts`(`articles_fts`) VALUES('rebuild');
--> statement-breakpoint

-- INSERT 同期トリガー
CREATE TRIGGER `articles_ai_fts` AFTER INSERT ON `articles` BEGIN
  INSERT INTO `articles_fts`(rowid, title, content, excerpt)
  VALUES (new.rowid, new.title, new.content, new.excerpt);
END;
--> statement-breakpoint

-- DELETE 同期トリガー（FTS5 外部コンテンツ用の特別構文）
CREATE TRIGGER `articles_ad_fts` AFTER DELETE ON `articles` BEGIN
  INSERT INTO `articles_fts`(`articles_fts`, rowid, title, content, excerpt)
  VALUES('delete', old.rowid, old.title, old.content, old.excerpt);
END;
--> statement-breakpoint

-- UPDATE 同期トリガー（delete + insert の 2 段階）
CREATE TRIGGER `articles_au_fts` AFTER UPDATE ON `articles` BEGIN
  INSERT INTO `articles_fts`(`articles_fts`, rowid, title, content, excerpt)
  VALUES('delete', old.rowid, old.title, old.content, old.excerpt);
  INSERT INTO `articles_fts`(rowid, title, content, excerpt)
  VALUES (new.rowid, new.title, new.content, new.excerpt);
END;
