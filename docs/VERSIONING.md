# バージョニング戦略

TechClip のバージョン管理方針を定義する。

---

## バージョン形式

[Semantic Versioning 2.0.0](https://semver.org/lang/ja/) に準拠する。

```
MAJOR.MINOR.PATCH
例: 1.2.3
```

| セグメント | 変更タイミング |
|-----------|--------------|
| MAJOR | 後方互換性のない変更（API破壊、DB構造の非互換変更） |
| MINOR | 後方互換性を保った新機能追加 |
| PATCH | 後方互換性を保ったバグ修正 |

---

## プラットフォーム別バージョン管理

### iOS: buildNumber

`app.json` の `expo.ios.buildNumber` はストアへの提出ごとに単調増加させる。

```
形式: 整数文字列（例: "42"）
ルール: 同じ version でも buildNumber は必ず増加させる
```

### Android: versionCode

`app.json` の `expo.android.versionCode` はストアへの提出ごとに単調増加させる。

```
形式: 整数（例: 42）
ルール: 同じ version でも versionCode は必ず増加させる
```

### ルート package.json

モノレポルートの `package.json` の `version` はアプリと同期させる。

---

## バージョンバンプの運用

### 手順

```bash
# 1. バンプ種別を選択して実行
./scripts/bump-version.sh patch   # バグ修正
./scripts/bump-version.sh minor   # 新機能追加
./scripts/bump-version.sh major   # 破壊的変更

# 2. 変更を確認
git diff

# 3. コミット・プッシュ
git add apps/mobile/app.json package.json
git commit -m "chore: bump version to X.Y.Z"
git push
```

### バンプ対象ファイル

| ファイル | 更新フィールド |
|---------|-------------|
| `apps/mobile/app.json` | `expo.version`, `expo.ios.buildNumber`, `expo.android.versionCode` |
| `package.json` | `version` |

---

## リリースフロー

```
開発完了
  ↓
RELEASE_CHECKLIST.md を確認
  ↓
bump-version.sh でバージョンバンプ
  ↓
PR 作成 → レビュー → マージ
  ↓
Git タグ付け: git tag v1.2.3
  ↓
EAS Build でビルド
  ↓
TestFlight / Internal Testing で検証
  ↓
ストア公開
```

---

## バージョン対応表

| バンプ種別 | 変更例 | 前 → 後 |
|-----------|-------|---------|
| patch | クラッシュ修正 | 1.2.3 → 1.2.4 |
| minor | 新機能（お気に入り機能） | 1.2.3 → 1.3.0 |
| major | 認証フロー刷新 | 1.2.3 → 2.0.0 |

---

## 注意事項

- `buildNumber` / `versionCode` は一度公開したら絶対に下げない
- `version` を変えない場合でも、ストア再提出時は `buildNumber` / `versionCode` を増加させる
- MAJOR バンプ時は `RELEASE_CHECKLIST.md` の全項目を完了させること
