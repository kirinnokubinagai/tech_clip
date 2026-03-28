# iOS App Store 提出準備ガイド

## 概要

本ドキュメントは TechClip iOS アプリを App Store に提出するための手順・設定・チェックリストを定義する。

---

## 目次

1. [App Store メタデータ](#1-app-store-メタデータ)
2. [スクリーンショット要件](#2-スクリーンショット要件)
3. [証明書・プロビジョニングプロファイル設定](#3-証明書プロビジョニングプロファイル設定)
4. [App Store Connect 設定](#4-app-store-connect-設定)
5. [App Review ガイドライン チェックリスト](#5-app-review-ガイドライン-チェックリスト)
6. [提出フロー](#6-提出フロー)

---

## 1. App Store メタデータ

### アプリ名（App Name）

```
TechClip
```

最大 30 文字。他のアプリ名・商標と重複しないこと。

### サブタイトル（Subtitle）

```
技術記事をAIで要約・翻訳
```

最大 30 文字。アプリの主要機能を簡潔に説明する。

### キーワード（Keywords）

```
技術記事,AI要約,翻訳,プログラミング,エンジニア,RSS,ニュース,キュレーション,テック,開発者
```

- 最大 100 文字（カンマ区切り）
- アプリ名・サブタイトルに含まれる単語は重複して設定しない
- ユーザーが検索しそうなワードを優先する

### 説明文（Description）

```
TechClipは、エンジニア・技術者のための技術記事キュレーションアプリです。

【主な機能】

■ AI要約
長い技術記事をAIが自動で要約。忙しいエンジニアでも、重要な情報をすばやく把握できます。

■ 日本語翻訳
英語の技術記事を自然な日本語に翻訳。海外の最新情報も言語の壁なくキャッチアップできます。

■ キュレーション
お気に入りのソースを登録して、自分だけのフィードを作成。毎日のインプットを効率化します。

■ オフライン読み込み
気になった記事をあらかじめ保存しておけば、通勤中やインターネットが使えない環境でも閲覧できます。

■ シンプルなUI
余計な機能を省いたシンプルなデザイン。記事を読むことに集中できます。

【こんな方におすすめ】
・毎日技術記事をチェックしているエンジニア
・英語の技術情報をキャッチアップしたい方
・情報収集の時間を短縮したい開発者
・最新技術トレンドを追いたい方

【対応言語】
日本語・英語

ご意見・ご要望はアプリ内のフィードバック機能からお送りください。
```

- 最大 4,000 文字
- プレーンテキストのみ（HTMLタグ不可）
- 改行・空行でセクションを区切ると読みやすい

### プロモーションテキスト（Promotional Text）

```
最新バージョンでオフライン機能が大幅強化されました。保存した記事をいつでもどこでも読めます。
```

- 最大 170 文字
- App Store でアプリ説明文の上部に表示される
- アップデートなしで変更可能（キャンペーン・新機能告知に活用）

### サポートURL

```
https://techclip.app/support
```

### マーケティングURL（任意）

```
https://techclip.app
```

### プライバシーポリシーURL（必須）

```
https://techclip.app/privacy
```

### 著作権表示（Copyright）

```
© 2025 TechClip
```

---

## 2. スクリーンショット要件

### 必須デバイスサイズ

| デバイス | 解像度 | 備考 |
|---------|--------|------|
| iPhone 6.9インチ（iPhone 16 Plus / Pro Max） | 1320 × 2868 px | **最優先・必須** |
| iPhone 6.7インチ（iPhone 14 Plus / 15 Plus） | 1290 × 2796 px | 必須 |
| iPhone 6.5インチ（iPhone 11 Pro Max / XS Max） | 1242 × 2688 px | 必須 |
| iPad Pro 13インチ（M4） | 2064 × 2752 px | 必須（iPad対応の場合） |
| iPad Pro 12.9インチ（第2世代） | 2048 × 2732 px | 必須（iPad対応の場合） |

> 同じアスペクト比のデバイスは共用可能。6.5インチのスクリーンショットは 5.5インチでも利用される。

### スクリーンショットの枚数

- 最低 1 枚、最大 10 枚
- **推奨: 5〜7枚**（主要機能を網羅）

### 推奨スクリーンショット構成（7枚）

| 順番 | 画面 | キャプション（例） |
|------|------|-----------------|
| 1 | ホーム（フィード一覧） | 「厳選した技術記事をまとめて閲覧」 |
| 2 | AI要約表示 | 「AIが長文記事を要約。要点を即把握」 |
| 3 | 日本語翻訳表示 | 「英語記事もすぐ日本語で読める」 |
| 4 | 記事詳細 | 「読みやすいフォントと余白でじっくり読む」 |
| 5 | お気に入り・保存記事 | 「気になった記事をオフラインで保存」 |
| 6 | フィード設定 | 「お気に入りソースだけ表示するカスタムフィード」 |
| 7 | ダークモード対応 | 「目に優しいダークモードに対応」 |

### スクリーンショット制作ルール

- 実機または Simulator の実際の画面を使用する
- テストデータ・ダミーデータは自然な内容にする（"test", "aaa" などは不可）
- テキストオーバーレイを使用する場合は日本語で記載
- App Store ガイドライン違反のコンテンツを含めない
- デバイスフレームを含める場合は Apple の公式フレームを使用する

### 動画プレビュー（App Preview）

任意。使用する場合:

- 解像度: スクリーンショットと同じ
- 長さ: 15〜30 秒
- フォーマット: .mov / .mp4 / .m4v
- 音声: オプション（無音でも可）
- 実際のアプリ操作画面のみ使用可（モックアップ映像は不可）

---

## 3. 証明書・プロビジョニングプロファイル設定

### 前提条件

- Apple Developer Program への登録（年間 $99）
- EAS（Expo Application Services）アカウント

### 3-1. Apple Developer Portal での設定

#### App ID の作成

1. [Apple Developer Portal](https://developer.apple.com/account) にログイン
2. Certificates, Identifiers & Profiles > Identifiers > 「+」
3. App IDs を選択
4. Bundle ID を設定:
   ```
   app.techclip.mobile
   ```
5. 必要な Capabilities を有効化:
   - Push Notifications（プッシュ通知を使用する場合）
   - Sign In with Apple（Apple ログインを使用する場合）
   - Associated Domains（ディープリンクを使用する場合）

#### 配布証明書（Distribution Certificate）の作成

EAS を使用する場合は EAS が自動管理するため、手動作成は不要。

手動で管理する場合:
1. Certificates > 「+」
2. Apple Distribution を選択
3. CSR ファイルをアップロード（Keychain Access で生成）
4. `.cer` ファイルをダウンロードして Keychain に追加

#### プロビジョニングプロファイルの作成

EAS を使用する場合は自動管理。手動の場合:

1. Profiles > 「+」
2. App Store Connect を選択
3. App ID: `app.techclip.mobile` を選択
4. Distribution Certificate を選択
5. プロファイル名: `TechClip App Store`
6. `.mobileprovision` をダウンロード

### 3-2. EAS Build での設定

#### eas.json の設定

```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "ios": {
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "XXXXXXXXXX"
      }
    }
  }
}
```

#### 環境変数の設定

```bash
# EAS シークレットに登録
eas secret:create --scope project --name APPLE_ID --value "your-apple-id@example.com"
eas secret:create --scope project --name ASC_APP_ID --value "1234567890"
```

#### ビルドの実行

```bash
# 本番ビルド
eas build --platform ios --profile production

# ビルド状況の確認
eas build:list --platform ios
```

### 3-3. app.json / app.config.js の設定

```json
{
  "expo": {
    "name": "TechClip",
    "slug": "techclip",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "bundleIdentifier": "app.techclip.mobile",
      "buildNumber": "1",
      "supportsTablet": false,
      "requireFullScreen": false,
      "infoPlist": {
        "NSCameraUsageDescription": "プロフィール画像の撮影に使用します",
        "NSPhotoLibraryUsageDescription": "プロフィール画像の選択に使用します"
      }
    },
    "plugins": [
      "expo-router"
    ]
  }
}
```

### 3-4. アイコン・スプラッシュ画像の準備

| ファイル | サイズ | 形式 | 用途 |
|---------|--------|------|------|
| `assets/icon.png` | 1024 × 1024 px | PNG（アルファなし） | App Store アイコン・ホーム画面アイコン |
| `assets/splash.png` | 1284 × 2778 px | PNG | スプラッシュスクリーン |

アイコンのデザイン規約:
- 背景透過なし（角丸はシステムが自動適用）
- グラデーション・3D効果は避けシンプルに
- 小サイズ（29 × 29 px）でも識別できる形状

---

## 4. App Store Connect 設定

### 4-1. アプリの新規登録

1. [App Store Connect](https://appstoreconnect.apple.com) にログイン
2. マイ App > 「+」 > 新規 App
3. 以下を設定:

| 項目 | 値 |
|------|-----|
| プラットフォーム | iOS |
| 名前 | TechClip |
| 主要言語 | 日本語 |
| バンドル ID | app.techclip.mobile |
| SKU | techclip-ios-001 |
| ユーザーアクセス | フルアクセス |

### 4-2. App Privacy（データ収集の申告）

App Store Connect > App Privacy タブで設定。

#### 収集するデータの種類と用途

| データの種類 | 収集 | ユーザーにリンク | 用途 |
|------------|------|----------------|------|
| メールアドレス | あり | あり | アカウント作成・認証 |
| 使用データ（アプリの操作ログ） | あり | なし | アプリの改善・分析 |
| クラッシュデータ | あり | なし | バグ修正 |
| ユーザーコンテンツ（保存記事） | あり | あり | アプリ機能の提供 |

#### 設定手順

1. App Privacy > 「プライバシーの処理を開始する」
2. データを収集するか: **はい**
3. 各データ種別で「収集する」を選択し、用途を設定
4. 「プライバシーラベルを公開する」で確定

### 4-3. 年齢制限（Age Rating）

1. App 情報 > 年齢制限
2. 以下の質問に回答:

| コンテンツ | 設定 |
|----------|------|
| ビジネス目的で制限されたコンテンツへのアクセス | なし |
| アルコール・タバコ・薬物への言及または中程度の描写 | なし |
| 医療・治療に関する情報 | なし |
| 暴力（ゲームのようなもの） | なし |
| 性的コンテンツや裸 | なし |
| ユーザー作成コンテンツ | あり（SNS的機能がある場合） |
| 未制限の Web アクセス | あり（記事リンク先への遷移がある場合） |

推奨年齢制限: **4+**（ユーザー生成コンテンツなしの場合）

### 4-4. バージョン情報の設定

1. App Store Connect > バージョン > 「+」で新バージョン作成
2. バージョン番号: `1.0.0`（app.json の version と一致させる）
3. 新機能（リリースノート）:

```
TechClip 1.0.0 - 初回リリース

・技術記事のAI要約機能
・英語記事の日本語翻訳機能
・カスタムフィード作成機能
・記事のオフライン保存機能
```

### 4-5. 審査に関する情報（Review Information）

| 項目 | 設定 |
|------|------|
| サインイン情報が必要 | はい |
| デモ用アカウント（ユーザー名） | reviewer@techclip.app |
| デモ用アカウント（パスワード） | ReviewPass123! |
| メモ | 「記事一覧はログイン後に表示されます。デモアカウントでログインしてご確認ください。」 |

デモアカウントは審査開始前に本番環境で有効化しておくこと。

### 4-6. 提出前の最終確認

1. App Store Connect > バージョン > 「審査のために提出」
2. 輸出コンプライアンス:
   - 暗号化アルゴリズムを使用: **はい**（HTTPS通信のため）
   - 標準の暗号化のみ使用: **はい**
3. 広告識別子（IDFA）の使用: アプリの実装に応じて回答

---

## 5. App Review ガイドライン チェックリスト

### 5-1. 安全性

- [ ] クラッシュ・バグがなく安定して動作すること
- [ ] 完成した機能のみを提供していること（未完成の機能を含まない）
- [ ] デモアカウントなど、審査担当者が全機能を確認できる手段を用意すること
- [ ] プレースホルダーコンテンツが残っていないこと

### 5-2. パフォーマンス

- [ ] アプリが高速に起動すること（起動時間 3 秒以内）
- [ ] 過度にバッテリーを消費しないこと
- [ ] メモリを適切に管理していること（メモリリークなし）
- [ ] すべてのリンク・ボタン・機能が正常に動作すること

### 5-3. ビジネス

- [ ] アプリ内課金がある場合は In-App Purchase で実装していること（外部決済リンクは禁止）
- [ ] 課金に関する説明が明確であること
- [ ] サブスクリプションの内容・価格・更新サイクルが明示されていること
- [ ] 無料トライアルの条件が明確であること（該当する場合）

### 5-4. デザイン

- [ ] iOS Human Interface Guidelines に準拠していること
- [ ] すべての画面でテキストが読みやすいこと（最小フォントサイズ 11pt）
- [ ] タップ可能な要素のサイズが適切であること（最小 44 × 44 pt）
- [ ] ダークモードが正常に動作すること（`userInterfaceStyle: "automatic"` の場合）
- [ ] Dynamic Type（文字サイズ変更）に対応していること
- [ ] 横画面・縦画面の切り替えが適切であること（固定の場合は意図的であること）
- [ ] iPad 対応を申告している場合、iPad 用 UI が適切であること

### 5-5. 法的事項

- [ ] プライバシーポリシーが設置・リンクされていること
- [ ] 利用規約が設置されていること
- [ ] 他者の著作権・商標を侵害していないこと
- [ ] App Store Connect の App Privacy が正確に申告されていること
- [ ] 収集するデータをプライバシーポリシーに明記していること
- [ ] 位置情報・カメラ・連絡先など iOS の権限利用に適切な説明（`Info.plist`）があること

### 5-6. ユーザー生成コンテンツ（該当する場合）

- [ ] 不適切なコンテンツを報告する手段があること
- [ ] 不適切なコンテンツを削除できる仕組みがあること
- [ ] 18歳未満に不適切なコンテンツが表示されない仕組みがあること

### 5-7. ログイン・アカウント

- [ ] アカウント登録を強制する場合、登録なしでも一部機能が使えること（または明確な理由があること）
- [ ] Sign In with Apple を実装していること（サードパーティログインを提供する場合）
- [ ] アカウント削除機能が実装されていること（App Store ガイドライン 5.1.1(v) 準拠）

### 5-8. TechClip 固有チェック項目

- [ ] 外部の技術記事コンテンツを表示する際に著作権を遵守していること
- [ ] AI 要約・翻訳の出力が不適切なコンテンツを含まないこと
- [ ] 記事のオリジナルソースへのリンクが提供されていること
- [ ] AI 生成コンテンツであることが明示されていること（要約・翻訳に「AI要約」ラベルを表示）

---

## 6. 提出フロー

### 6-1. EAS Build & Submit を使用した提出

```bash
# 1. 本番ビルドの実行
eas build --platform ios --profile production

# 2. ビルド完了後、App Store Connect に提出
eas submit --platform ios --latest

# または、ビルドと提出を一括で実行
eas build --platform ios --profile production --auto-submit
```

### 6-2. 審査状況の確認

- App Store Connect の「アクティビティ」タブで確認
- 審査期間の目安: 通常 1〜3 日（混雑時はそれ以上）
- Fastlane / EAS を使用している場合、ステータス変更をメール通知で受け取れる

### 6-3. 審査差し戻し時の対応

1. App Store Connect の「解決センター」でフィードバックを確認
2. 指摘事項を修正
3. 修正内容をリリースノートのメモ欄に記載
4. 再提出

### 6-4. リリース設定

| 設定 | 推奨値 | 説明 |
|------|--------|------|
| リリース方法 | 段階的リリース | 初回は 10% → 50% → 100% で展開 |
| 自動リリース | 審査通過後に自動リリース | または手動で任意のタイミングでリリース |
| バージョンリリース | バージョン固有 | 次の審査提出時に前バージョンに戻せる |

---

## 関連ドキュメント

- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — 本番リリース前全体チェックリスト
- [SECRETS.md](./SECRETS.md) — シークレット管理ガイドライン
- [VERSIONING.md](./VERSIONING.md) — バージョン管理ポリシー
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Expo EAS Submit](https://docs.expo.dev/submit/ios/)
