-- unicode61 から trigram トークナイザーへの移行
-- trigram は3文字N-gramでインデックスを構築するため、スペースなし日本語の部分一致が可能になる
-- 例: 「機械学習」を含む記事が「機械学」で検索できる

-- 旧トリガーを削除
DROP TRIGGER IF EXISTS `articles_ai_fts`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `articles_ad_fts`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `articles_au_fts`;
--> statement-breakpoint

-- 旧 FTS5 テーブルを削除
DROP TABLE IF EXISTS `articles_fts`;
--> statement-breakpoint

-- trigram トークナイザーで FTS5 テーブルを再作成
-- trigram: 3文字ずつのN-gramでインデックスを構築。ワイルドカードなしで部分一致検索が可能。
-- 注意: 3文字未満のクエリはtrigramを生成できないためヒットしない（2文字語句 "AI" 等）
CREATE VIRTUAL TABLE `articles_fts` USING fts5(
  title,
  content,
  excerpt,
  content='articles',
  content_rowid='rowid',
  tokenize='trigram'
);
--> statement-breakpoint

-- 既存データを FTS に取り込む（全件 rebuild）
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
