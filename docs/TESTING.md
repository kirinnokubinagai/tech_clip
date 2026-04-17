# TechClip テスト戦略

## テスト種別

### Unit / Integration テスト（Jest）

- **対象**: API ロジック・モバイルコンポーネント・フック・ユーティリティ
- **場所**: `tests/api/` / `tests/mobile/`
- **実行**:
  ```bash
  # 全テスト
  pnpm test

  # API のみ
  pnpm --filter @tech-clip/api test

  # Mobile のみ
  pnpm --filter @tech-clip/mobile test
  ```

### Smoke テスト（Jest render）

- **対象**: `<App />` のレンダリング（module loading エラーの早期検知）
- **場所**: `tests/mobile/smoke.test.tsx`
- **目的**: `getDevServer is not a function` のような module loading エラーを unit test 層で検知する
- **実行**: `pnpm --filter @tech-clip/mobile test` に含まれる

### E2E テスト（Maestro）

- **対象**: Android アプリの実機動作
- **場所**: `tests/e2e/maestro/`
- **flow 一覧**:
  - `01-onboarding.yaml` — オンボーディング画面
  - `02-auth-login.yaml` — ログイン
  - `03-auth-register.yaml` — アカウント登録
  - `04-article-save.yaml` — 記事保存
  - `05-article-detail.yaml` — 記事詳細
  - `06-profile-edit.yaml` — プロフィール編集
  - `07-settings.yaml` — 設定・ログアウト
  - `08-search.yaml` — 検索
- **ローカル実行**:
  ```bash
  # Android エミュレータを起動してから
  nix develop --command maestro test tests/e2e/maestro/
  ```

### iOS E2E テスト

現状 CI では実行していない（Issue #1000 で形骸化した `e2e.yml` を削除済み）。PR 時の Android E2E（`pr-e2e-android.yml`）で実機動作を検証しており、iOS 固有の動作確認は手動テストで対応する。将来必要になった場合は別 Issue で EAS Build + Maestro Cloud または macOS runner + Simulator 経路を検討する。

---

## PR CI ワークフロー

### `pr-e2e-android.yml`

PR で以下のパスが変更されたとき自動実行される:

- `apps/mobile/**`
- `tests/e2e/maestro/**`
- `package.json` / `pnpm-lock.yaml`
- `flake.nix` / `flake.lock`
- `.github/workflows/pr-e2e-android.yml`
- `.github/actions/upload-pr-e2e-comment/**`

**実行内容**:

1. Android エミュレータ（API 34 / x86_64 / Google APIs）を起動
2. `expo run:android` でアプリをビルド・インストール
3. Maestro で全 flow を実行し JUnit XML を出力
4. スクリーンショットを artifact にアップロード（retention: 7 日）
5. GitHub Release にスクリーンショットをアップロード
6. PR コメントに結果とスクリーンショットを投稿（既存コメントがあれば更新）
7. Maestro が失敗していた場合、workflow を失敗として終了

**concurrency**: 同一 PR の古い run は自動キャンセルされる。

---

## reviewer agent による視覚レビューフロー（フェーズ 6.5）

`.claude/agents/reviewer.md` / `infra-reviewer.md` / `ui-reviewer.md` のフェーズ 6.5 に定義されている。

GitHub AI Review が PASS になった後:

1. `gh run list --workflow=pr-e2e-android.yml` で最新 run を特定
2. in_progress なら 30 秒間隔で最大 45 分待機
3. failure なら JUnit XML を DL して失敗内容を `CHANGES_REQUESTED` で返送
4. success なら artifact を `.claude/tmp/` に DL
5. `Read` ツールで PNG を 1 枚ずつ視覚確認（エラー表示・UI 崩れ・文字化けをチェック）
6. JUnit XML で pass/fail 件数を確認
7. 問題なしなら `.claude/tmp/` を削除してフェーズ 7 へ進む

---

## CI の動作確認方法

### smoke test の動作確認

`App` コンポーネントの import に意図的なエラーを混入させてテストが FAIL することを確認する:

```bash
# 一時的にエラーを注入
echo "throw new Error('intentional error');" >> apps/mobile/app/_layout.tsx

# テスト実行（失敗するはず）
pnpm --filter @tech-clip/mobile test -- --testPathPattern="smoke"

# 元に戻す
git checkout apps/mobile/app/_layout.tsx
```

### E2E workflow の動作確認

PR を作成して `pr-e2e-android.yml` が trigger されることを確認する。初回は AVD キャッシュがないため時間がかかる（30 分程度）。

---

## pre-push Maestro smoke test

`.husky/pre-push` に Maestro smoke test が組み込まれており、push 前に「アプリが起動しないレベルの破壊的変更」を自動検知する。

### 動作仕様

| 状態 | 結果 |
|------|------|
| emulator 起動中 + maestro インストール済み | smoke flow を実行し、失敗時は push をブロック |
| maestro 未インストール | スキップして push を続行 |
| emulator 未起動 | スキップして push を続行 |

### 実行される flow

`smoke` タグを持つすべての flow（`tests/e2e/maestro/` 配下を再帰的に走査）。タイムアウト: 180 秒。

smoke タグの付与方針は「smoke tag の付与方針」セクションを参照。

### smoke tag の付与方針

`smoke` タグを持つ flow は「起動 + 最初の画面表示」のみを検証する短時間 flow に限定する。
全 flow を pre-push で実行すると時間がかかりすぎるため、smoke タグは最小限にとどめること。

### 複数 worktree の並列 push

複数の worktree で同時に push する場合、worktree パスの SHA-256 ハッシュ（先頭 8 桁）を 16 進数として解釈し、起動中エミュレーター一覧の配列インデックスとして選択する。これにより各 worktree が異なるエミュレーターに向き、ポートの衝突を回避できる。

```bash
_WORKTREE_HASH="$(echo "${REPO_ROOT}" | shasum -a 256 | cut -c1-8)"
_EMULATORS=()
while IFS= read -r _e; do
  _EMULATORS+=("$_e")
done < <(adb devices 2>/dev/null | grep "emulator" | awk '{print $1}')
_IDX=$(( 16#${_WORKTREE_HASH} % ${#_EMULATORS[@]} ))
export ANDROID_SERIAL="${_EMULATORS[${_IDX}]}"
```

### smoke test のスキップ

emulator が起動していない環境（他メンバーの Mac、Windows など）では自動的にスキップされる。
どうしても強制 push したい場合:

```bash
git push --no-verify
```

---

## ローカルでの E2E 実行

```bash
# 1. Android エミュレータを起動（Android Studio AVD Manager から）

# 2. アプリをインストール
cd apps/mobile
pnpm expo run:android --variant debug

# 3. Maestro を実行
nix develop --command maestro test tests/e2e/maestro/

# 4. 特定の flow のみ実行
nix develop --command maestro test tests/e2e/maestro/01-onboarding.yaml
```
