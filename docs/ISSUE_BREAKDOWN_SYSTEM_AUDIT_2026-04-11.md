# システム監査から作成する Issue 分解案

最終更新: 2026-04-11

このドキュメントは、システム監査で見つかった課題を「実装できる粒度」まで分解した Issue 草案。
GitHub CLI 認証が無効だったため、現時点では GitHub 上には未作成。認証復旧後にそのまま親子 Issue として起票する想定。

---

## 方針

- まずはユーザー体験と仕様整合性を壊している問題を優先する
- 親 Issue は成果物単位、子 Issue は 1 PR で完結しやすい粒度にする
- README / UI / API / テストの整合を必ずセットで管理する
- 「見た目だけある未実装画面」は親 Issue を切って段階的に実装する

---

## 優先順位

1. P0: 仕様と実装の不整合解消
2. P0: 未実装のプロフィール系機能を本実装へ置換
3. P1: i18n / a11y / 表示文言の一貫性回復
4. P1: 認証・API クライアントの堅牢化
5. P2: ディレクトリ衛生と運用保守の改善

---

## 親子 Issue 構成

### Epic A: 対応ソース仕様の整合性を回復する

#### 親 Issue

**タイトル**
`epic: 対応ソース定義・UI・README の不整合を解消する`

**目的**
- README、共有型、API パーサー、モバイル UI のソース定義を一致させる
- ユーザーに見える「対応済み / 予定」の表記を実装と一致させる

**完了条件**
- `packages/types`, `apps/api`, `apps/mobile`, `README.md`, onboarding の記述が一致している
- `youtube` と `twitter` の扱いが仕様として明文化されている
- テストが追加または更新されている

**子 Issue**
- A-1
- A-2
- A-3
- A-4

#### A-1

**タイトル**
`fix: モバイルの SourceBadge / source 定義に YouTube を追加する`

**背景**
- 共有型と API は `youtube` を扱っているが、モバイルの `SOURCE_DEFINITIONS` に存在しない
- そのため YouTube 記事が UI 上で `other` 扱いになる可能性がある

**対象**
- `apps/mobile/src/lib/sources.ts`
- `apps/mobile/src/components/ui/SourceBadge.tsx`
- 関連テスト

**作業内容**
- `youtube` の定義を追加
- バッジ色・ラベル方針を決める
- `SUPPORTED_SOURCE_COUNT` と整合するようテストを更新

**完了条件**
- YouTube ソースの表示が正しく行われる
- 既存テストが通る
- YouTube 用の UI テストが追加される

#### A-2

**タイトル**
`fix: ホーム画面のソースフィルターを source-of-truth から生成する`

**背景**
- ホーム画面のフィルター候補が手書きで、実対応ソースの一部しか出ていない
- 仕様追加時に UI が追随しない構造になっている

**対象**
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/src/lib/sources.ts`
- 関連テスト

**作業内容**
- ハードコードされたフィルター一覧を廃止
- 表示対象ソースの定義を source-of-truth から導出
- `other` を含めるかは仕様化して決定

**完了条件**
- フィルター候補が定義と同期する
- 追加ソース時に UI 修正漏れが起きにくい

#### A-3

**タイトル**
`docs: README の対応ソース表と実装状態を同期する`

**背景**
- README では `YouTube` / `Twitter` が予定扱いだが、実装側には判定・パーサー・テストが存在する
- 公開仕様として不正確

**対象**
- `README.md`
- 必要なら `docs/ROADMAP.md`

**作業内容**
- 実装済み / 一部対応 / 予定 を再定義
- 実装状況に合わせて表を更新
- 文言の根拠をコードに寄せる

**完了条件**
- README が現実の実装を反映している
- 読者が誤解しない

#### A-4

**タイトル**
`fix: onboarding の対応ソース訴求文を実装仕様と同期する`

**背景**
- onboarding は `SUPPORTED_SOURCE_COUNT` を使っているが、文言はハードコードで i18n されていない
- README や実際の対応状況とズレやすい

**対象**
- `apps/mobile/app/onboarding.tsx`
- `apps/mobile/src/locales/*.json`
- テスト

**作業内容**
- onboarding 文言を i18n 化
- 対応ソース数と説明を実装に沿って整理

**完了条件**
- 文言が i18n 管理される
- 対応ソース数の表示が仕様と整合する

---

### Epic B: プロフィール関連のダミー実装を本実装に置き換える

#### 親 Issue

**タイトル**
`epic: プロフィール・フォロー導線をプレースホルダーから本実装へ置き換える`

**目的**
- 「存在しているように見えるが未実装」の画面を排除する
- 自分のプロフィール、他ユーザープロフィール、フォロー一覧を API と接続する

**完了条件**
- ダミーデータ関数が削除される
- 各画面が API / 状態管理 / ローディング / エラー処理まで含めて動作する
- 画面テストが本実装前提に更新される

**子 Issue**
- B-1
- B-2
- B-3
- B-4
- B-5

#### B-1

**タイトル**
`feat: 自分のプロフィール画面を auth state と users API に接続する`

**背景**
- 現状は `PLACEHOLDER_USER` を表示している

**対象**
- `apps/mobile/app/(tabs)/profile.tsx`
- `apps/mobile/src/stores/auth-store.ts`
- 必要な hook / API client / テスト

**作業内容**
- ログイン中ユーザーの取得経路を定義
- 未ログイン時 / ログイン時で表示を切り替え
- `ProfileHeader` を本データで描画

**完了条件**
- ゲスト固定表示が消える
- ログイン中ユーザー情報が表示される

#### B-2

**タイトル**
`feat: 他ユーザープロフィール画面を公開プロフィール API に接続する`

**背景**
- 現状は `createPlaceholderUser(id)` を使っている

**対象**
- `apps/mobile/app/profile/[id].tsx`
- API route / hook / テスト

**作業内容**
- 公開プロフィール取得 API の確認または追加
- フォロワー数・プロフィール情報・公開記事件数の表示を接続
- ローディング / エラー / 空状態を整理

**完了条件**
- 他ユーザー画面が実データで表示される

#### B-3

**タイトル**
`feat: フォロワー / フォロー中一覧画面を followers API に接続する`

**背景**
- 現状はダミー配列を返している

**対象**
- `apps/mobile/app/profile/followers.tsx`
- `apps/api` の follow 関連 API
- テスト

**作業内容**
- 一覧取得 hook を追加
- タブ切り替え時に `followers` / `following` を取得
- ページネーション要否を決める

**完了条件**
- ダミーデータが削除される
- 実フォロー関係が反映される

#### B-4

**タイトル**
`feat: FollowButton の楽観更新と失敗時ロールバックを実装する`

**背景**
- フォロー導線は画面上にあるが、UX と状態一貫性を詰める必要がある

**対象**
- `apps/mobile/src/components/FollowButton.tsx`
- 関連 hook / query invalidation / テスト

**作業内容**
- follow/unfollow mutation を標準化
- 楽観更新を導入
- 失敗時の UI ロールバックを実装

**完了条件**
- フォロー状態が即時反映される
- エラー時に破綻しない

#### B-5

**タイトル**
`test: プロフィール系画面のプレースホルダー前提テストを本実装前提へ更新する`

**背景**
- 画面が実装されても、テストがダミーデータ前提だと品質保証にならない

**対象**
- `tests/mobile/screens/*profile*`
- `tests/mobile/components/ProfileHeader.test.tsx`

**作業内容**
- API モックベースに更新
- ローディング / エラー / 空状態を追加

**完了条件**
- 本実装に追随したテストになっている

---

### Epic C: i18n とアクセシビリティの未完了部分を閉じる

#### 親 Issue

**タイトル**
`epic: モバイル UI のハードコード文言を解消し、多言語・a11y 品質を揃える`

**目的**
- 日本語 / 英語 UI 対応を実態に合わせて完成させる
- 画面文言、エラー文言、アクセシビリティラベルの一貫性を確保する

**完了条件**
- 画面文言のハードコードが大幅に解消される
- `accessibilityLabel` / `accessibilityHint` が翻訳キー経由になる
- 英語 UI でも主要画面が破綻しない

**子 Issue**
- C-1
- C-2
- C-3
- C-4

#### C-1

**タイトル**
`refactor: onboarding・ホーム・記事詳細のハードコード文言を i18n 化する`

**対象**
- `apps/mobile/app/onboarding.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/article/[id].tsx`
- locale files

**完了条件**
- 主要導線の文言が翻訳キー管理になる

#### C-2

**タイトル**
`refactor: profile / followers / settings 周辺のハードコード文言を i18n 化する`

**対象**
- `apps/mobile/app/(tabs)/profile.tsx`
- `apps/mobile/app/profile/[id].tsx`
- `apps/mobile/app/profile/followers.tsx`
- `apps/mobile/app/profile/edit.tsx`
- `apps/mobile/app/(tabs)/settings.tsx`

**完了条件**
- プロフィール周辺の静的日本語が排除される

#### C-3

**タイトル**
`refactor: accessibilityLabel / accessibilityHint を翻訳キー経由へ統一する`

**対象**
- `apps/mobile/app`
- `apps/mobile/src/components`

**作業内容**
- `accessibilityLabel` と `accessibilityHint` の直書きを棚卸し
- 翻訳キーへ移行
- テストが必要な箇所は更新

**完了条件**
- a11y 文言が言語切替に追随する

#### C-4

**タイトル**
`test: 英語ロケールで主要画面が成立することをモバイルテストで保証する`

**対象**
- `tests/mobile/screens`
- `tests/mobile/components`

**完了条件**
- `en` ロケールで主要画面のスナップショットまたは文言検証が追加される

---

### Epic D: 認証・API クライアントの堅牢性を上げる

#### 親 Issue

**タイトル**
`epic: 認証トークン運用と API クライアントの失敗耐性を強化する`

**目的**
- モバイル認証の漏えいリスクと障害時挙動を見直す
- API 側とクライアント側の責務を明確にする

**完了条件**
- トークン運用方針が文書化される
- API クライアントが HTTP 異常系に対して安全に振る舞う

**子 Issue**
- D-1
- D-2
- D-3

#### D-1

**タイトル**
`design: モバイル認証トークン運用方針を見直し、保存戦略を決定する`

**背景**
- access token と refresh token をクライアント永続保存している
- モバイルではあり得る構成だが、リスクと対策が明文化されていない

**対象**
- `apps/api/src/routes/auth.ts`
- `apps/mobile/src/lib/secure-store.ts`
- `docs/SECRETS.md` または新規設計 doc

**作業内容**
- 現行方式の脅威整理
- 保存期間、失効、再利用検知、端末紛失時の考え方を整理
- 必要なら API 変更 Issue へ派生

**完了条件**
- 採用方針が決まり、次の実装 Issue が切れる

#### D-2

**タイトル**
`fix: apiFetch の HTTP エラー処理と JSON 依存を整理する`

**背景**
- 現状は `401` 以外を HTTP ステータスで判定せず、そのまま `json()` している
- サーバーが非 JSON を返したときに壊れやすい

**対象**
- `apps/mobile/src/lib/api.ts`
- 関連 hook / テスト

**作業内容**
- `response.ok` と `content-type` の確認を追加
- API エラー型の取り扱いを整理
- ネットワークエラーと業務エラーを分離

**完了条件**
- 非 2xx / 非 JSON でも破綻しない

#### D-3

**タイトル**
`test: 認証期限切れ・refresh 失敗・非JSON応答の API クライアントテストを追加する`

**完了条件**
- `api.ts` の異常系テストが揃う

---

### Epic E: デザインシステムとテーマの一貫性を整える

#### 親 Issue

**タイトル**
`epic: モバイルのテーマ設計と画面デザインの一貫性を改善する`

**目的**
- ライト / ダークでブランド体験が分裂している状態を改善する
- デザイン規約と実装を近づける

**完了条件**
- カラートークンの方針が整理される
- 主要画面でテーマ差分が意図的になる

**子 Issue**
- E-1
- E-2

#### E-1

**タイトル**
`design: ライト / ダークテーマのブランドカラー方針を再設計する`

**対象**
- `apps/mobile/src/lib/constants.ts`
- `docs/design/*`

**作業内容**
- Primary / Accent / Surface / Semantic を再定義
- ダークテーマの強いインディゴ偏重を見直す

**完了条件**
- 両テーマに一貫したブランド感がある

#### E-2

**タイトル**
`refactor: 主要画面で共通トークンを使うよう配色を整理する`

**対象**
- home / article / profile / settings 周辺

**完了条件**
- 直指定色や場当たり的な配色が減る

---

### Epic F: ディレクトリ衛生と運用保守を改善する

#### 親 Issue

**タイトル**
`epic: 開発生成物と運用ドキュメントの管理を整理し、保守性を上げる`

**目的**
- 探索しづらいディレクトリ構成と運用の曖昧さを減らす

**完了条件**
- 生成物の置き場と ignore 方針が明確になる
- 開発者が読むべきドキュメントが整理される

**子 Issue**
- F-1
- F-2
- F-3

#### F-1

**タイトル**
`chore: 開発生成物の置き場と ignore 方針を見直す`

**対象**
- `.gitignore`
- 開発スクリプト
- `apps/api/local.db` などの生成物管理

**作業内容**
- repo 内に残りやすい生成物を棚卸し
- 作業用 state の保存場所を整理
- 必要なら tmp / tool 専用ディレクトリへ退避

#### F-2

**タイトル**
`docs: README を「現状仕様」と「セットアップ」に絞って再構成する`

**背景**
- 現状 README は情報量が多いが、実装との差分が混ざると信用を失いやすい

**完了条件**
- 仕様・状態・予定が区別される

#### F-3

**タイトル**
`docs: ROADMAP と現行実装の差分監査ルールを追加する`

**背景**
- ROADMAP は GitHub Issue と一致必須だが、実装実態とズレると逆に保守負債になる

**完了条件**
- 更新ルールが明文化される

---

## 推奨実装順

1. Epic A
2. Epic B
3. Epic C
4. Epic D
5. Epic E
6. Epic F

理由:
- A を先にやると仕様認識のズレが止まる
- B を次にやると「見えている未実装機能」が減る
- C と D は品質改善だが、B の画面接続後にやる方が手戻りが少ない

---

## GitHub 起票時の運用ルール

- 親 Issue には目的、非目的、依存、完了条件を書く
- 子 Issue には対象ファイル、API 影響、テスト要件を書く
- PR は原則 1 子 Issue = 1 PR
- ダミー実装撤去系は README / テスト更新を同じ PR に含める

---

## GitHub CLI 認証復旧後の起票順

1. Epic A 親 Issue
2. Epic A 子 Issue 4件
3. Epic B 親 Issue
4. Epic B 子 Issue 5件
5. Epic C 親 Issue
6. Epic C 子 Issue 4件
7. Epic D 親 Issue
8. Epic D 子 Issue 3件
9. Epic E 親 Issue
10. Epic E 子 Issue 2件
11. Epic F 親 Issue
12. Epic F 子 Issue 3件

合計: 6 親 Issue + 21 子 Issue = 27 Issue
