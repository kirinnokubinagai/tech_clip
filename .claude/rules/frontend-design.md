# フロントエンドデザイン規約

## アイコン: Lucide Icons

### 基本方針

**絵文字は使用禁止。すべてのアイコンは Lucide Icons を使用する。**

```bash
# インストール
npm install lucide-react
```

### 使用例

```tsx
import {
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronDown,
  Menu,
  Search,
  Settings,
  User,
  LogOut,
  Plus,
  Minus,
  Edit,
  Trash2,
  Save,
  Download,
  Upload,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Mail,
  Phone,
  MapPin,
  Home,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// 基本的な使い方
<Check className="h-4 w-4" />
<AlertCircle className="h-5 w-5 text-error" />

// ボタン内アイコン
<Button>
  <Plus className="h-4 w-4 mr-2" />
  追加する
</Button>

// アイコンのみボタン（aria-label必須）
<Button variant="ghost" size="icon" aria-label="設定">
  <Settings className="h-5 w-5" />
</Button>

// ローディング
<Loader2 className="h-4 w-4 animate-spin" />
```

### アイコンサイズ規約

| 用途 | サイズ | Tailwindクラス |
|------|--------|----------------|
| インラインテキスト | 16px | `h-4 w-4` |
| ボタン内 | 16-20px | `h-4 w-4` or `h-5 w-5` |
| ナビゲーション | 20-24px | `h-5 w-5` or `h-6 w-6` |
| 大きな表示 | 32-48px | `h-8 w-8` or `h-12 w-12` |

---

## AIらしさを排除するデザイン原則

### 禁止パターン（AIっぽく見える要素）

```tsx
// ❌ 禁止: グラデーション背景（特に紫〜青〜ピンク）
<div className="bg-gradient-to-r from-purple-500 via-blue-500 to-pink-500" />

// ❌ 禁止: ネオンカラー・蛍光色
<div className="text-cyan-400 bg-fuchsia-500" />

// ❌ 禁止: 過度なグロー・ぼかし効果
<div className="shadow-[0_0_30px_rgba(139,92,246,0.5)]" />

// ❌ 禁止: 宇宙・星空・オーロラ風背景
<div className="bg-[url('/stars.png')]" />

// ❌ 禁止: 浮遊するパーティクル・アニメーション
<ParticleBackground />

// ❌ 禁止: 3Dグラデーション球体・blob
<div className="blob-animation" />

// ❌ 禁止: "AI", "Smart", "Intelligent" などの装飾的表現
<Badge>AI Powered</Badge>
```

### 推奨パターン（人間らしいデザイン）

```tsx
// ✅ 推奨: シンプルな単色背景
<div className="bg-white" />
<div className="bg-neutral-50" />

// ✅ 推奨: 控えめなシャドウ
<div className="shadow-sm" />
<div className="shadow-md" />

// ✅ 推奨: 落ち着いた色使い
<div className="bg-primary-500 text-white" />
<div className="text-neutral-700" />

// ✅ 推奨: 明確な境界線
<div className="border border-neutral-200" />

// ✅ 推奨: 実用的なアイコン
<Check className="h-4 w-4 text-success" />
<AlertCircle className="h-4 w-4 text-error" />

// ✅ 推奨: 機能を直接表現するラベル
<Badge>新着</Badge>
<Badge>完了</Badge>
```

### デザインの方向性

| 要素 | AIっぽい（避ける） | 人間らしい（採用） |
|------|-------------------|------------------|
| 色 | グラデーション、ネオン | 単色、落ち着いたトーン |
| 背景 | 宇宙、パーティクル | 白、淡い色、シンプル |
| 効果 | グロー、ブラー | 軽いシャドウ、境界線 |
| 動き | 浮遊、パルス | 控えめなトランジション |
| 形状 | blob、不定形 | 直線、適度な角丸 |
| 文言 | AI、スマート | 具体的な機能名 |

---

## テーマカラーシステム

### カラー設計の原則

1. **ブランドカラー1色を決める**（Primary）
2. **アクセントカラー1色を決める**（Secondary）
3. **残りはニュートラルとセマンティックで構成**

### プライマリカラー

```css
/*
 * プライマリカラー設計ガイド
 * - ブランドを象徴する1色
 * - CTAボタン、リンク、重要な要素に使用
 * - 500がメイン、他は明度バリエーション
 */

/* 例: 落ち着いた青緑（Teal系） */
--primary-50: #f0fdfa;
--primary-100: #ccfbf1;
--primary-200: #99f6e4;
--primary-300: #5eead4;
--primary-400: #2dd4bf;
--primary-500: #14b8a6;  /* メイン */
--primary-600: #0d9488;
--primary-700: #0f766e;
--primary-800: #115e59;
--primary-900: #134e4a;
--primary-950: #042f2e;
```

### セカンダリカラー

```css
/*
 * セカンダリカラー設計ガイド
 * - プライマリの補色または類似色
 * - サブアクション、装飾に使用
 * - 使いすぎに注意
 */

/* 例: 温かみのあるオレンジ */
--secondary-50: #fff7ed;
--secondary-100: #ffedd5;
--secondary-200: #fed7aa;
--secondary-300: #fdba74;
--secondary-400: #fb923c;
--secondary-500: #f97316;  /* メイン */
--secondary-600: #ea580c;
--secondary-700: #c2410c;
--secondary-800: #9a3412;
--secondary-900: #7c2d12;
--secondary-950: #431407;
```

### ニュートラルカラー

```css
/*
 * ニュートラルカラー
 * - テキスト、背景、境界線に使用
 * - 純粋なグレーより温かみのあるグレー推奨
 */

--neutral-50: #fafaf9;   /* 背景（明） */
--neutral-100: #f5f5f4;  /* カード背景 */
--neutral-200: #e7e5e4;  /* 境界線（薄） */
--neutral-300: #d6d3d1;  /* 境界線 */
--neutral-400: #a8a29e;  /* プレースホルダー */
--neutral-500: #78716c;  /* サブテキスト */
--neutral-600: #57534e;  /* テキスト（薄） */
--neutral-700: #44403c;  /* テキスト */
--neutral-800: #292524;  /* テキスト（濃） */
--neutral-900: #1c1917;  /* 見出し */
--neutral-950: #0c0a09;  /* 背景（暗） */
```

### セマンティックカラー

```css
/*
 * 意味を持つ色（状態表現）
 * - 成功、エラー、警告、情報
 * - 統一したトーンで設計
 */

/* 成功 */
--success: #22c55e;
--success-light: #dcfce7;
--success-dark: #16a34a;

/* エラー */
--error: #ef4444;
--error-light: #fee2e2;
--error-dark: #dc2626;

/* 警告 */
--warning: #f59e0b;
--warning-light: #fef3c7;
--warning-dark: #d97706;

/* 情報 */
--info: #3b82f6;
--info-light: #dbeafe;
--info-dark: #2563eb;
```

### Tailwind CSS 設定

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        secondary: {
          // ...
        },
        // neutral は Tailwind の stone をそのまま使うか拡張
      },
    },
  },
};

export default config;
```

---

## レイアウト・スペーシング

### スペーシングスケール

```css
/* 4pxベース */
--space-0: 0;
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
--space-20: 5rem;    /* 80px */
--space-24: 6rem;    /* 96px */
```

### レスポンシブブレークポイント

```css
/* モバイルファースト */
--breakpoint-sm: 640px;   /* スマホ横 */
--breakpoint-md: 768px;   /* タブレット */
--breakpoint-lg: 1024px;  /* デスクトップ */
--breakpoint-xl: 1280px;  /* 大画面 */
--breakpoint-2xl: 1536px; /* 超大画面 */
```

---

## タイポグラフィ

### フォントファミリー

```css
/* 本文 */
--font-sans: 'Inter', 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif;

/* コード */
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### フォントサイズスケール

```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
--text-5xl: 3rem;      /* 48px */
```

### 行間

```css
--leading-none: 1;
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;
```

---

## コンポーネント設計

### ボタン

```tsx
import { Loader2, Plus } from 'lucide-react';

// バリアント定義
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

// 正しい例
<Button variant="primary" size="md">
  <Plus className="h-4 w-4 mr-2" />
  追加する
</Button>

<Button variant="outline" disabled>
  キャンセル
</Button>

<Button variant="primary" disabled>
  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  保存中...
</Button>

// 禁止: 曖昧なラベル
<Button>OK</Button>
<Button>Submit</Button>
```

### フォーム

```tsx
import { AlertCircle } from 'lucide-react';

<div className="space-y-2">
  <Label htmlFor="email">
    メールアドレス
    <span className="text-error ml-1">*</span>
  </Label>
  <Input
    id="email"
    type="email"
    placeholder="example@domain.com"
    aria-invalid={!!error}
    aria-describedby={error ? 'email-error' : undefined}
    className={error ? 'border-error' : ''}
  />
  {error && (
    <p id="email-error" className="flex items-center gap-1 text-sm text-error">
      <AlertCircle className="h-4 w-4" />
      {error.message}
    </p>
  )}
</div>
```

### カード

```tsx
<div className="rounded-lg border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow">
  <div className="p-6">
    <h3 className="text-lg font-semibold text-neutral-900">
      タイトル
    </h3>
    <p className="mt-2 text-neutral-600">
      説明文がここに入ります。
    </p>
  </div>
  <div className="border-t border-neutral-200 px-6 py-4">
    <Button variant="primary" size="sm">
      詳細を見る
    </Button>
  </div>
</div>
```

### モーダル

```tsx
import { X } from 'lucide-react';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>確認</DialogTitle>
      <button
        onClick={() => setIsOpen(false)}
        className="absolute right-4 top-4 p-1 rounded hover:bg-neutral-100"
        aria-label="閉じる"
      >
        <X className="h-5 w-5" />
      </button>
    </DialogHeader>
    <DialogBody>
      本当に削除しますか？この操作は取り消せません。
    </DialogBody>
    <DialogFooter>
      <Button variant="ghost" onClick={() => setIsOpen(false)}>
        キャンセル
      </Button>
      <Button variant="danger" onClick={handleDelete}>
        削除する
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 通知・アラート

```tsx
import { Check, AlertCircle, AlertTriangle, Info } from 'lucide-react';

// 成功
<div className="flex items-center gap-3 rounded-lg border border-success bg-success-light p-4">
  <Check className="h-5 w-5 text-success-dark" />
  <p className="text-success-dark">保存が完了しました</p>
</div>

// エラー
<div className="flex items-center gap-3 rounded-lg border border-error bg-error-light p-4">
  <AlertCircle className="h-5 w-5 text-error-dark" />
  <p className="text-error-dark">エラーが発生しました</p>
</div>

// 警告
<div className="flex items-center gap-3 rounded-lg border border-warning bg-warning-light p-4">
  <AlertTriangle className="h-5 w-5 text-warning-dark" />
  <p className="text-warning-dark">確認が必要です</p>
</div>

// 情報
<div className="flex items-center gap-3 rounded-lg border border-info bg-info-light p-4">
  <Info className="h-5 w-5 text-info-dark" />
  <p className="text-info-dark">お知らせがあります</p>
</div>
```

---

## アニメーション

### 基本原則

```css
/* トランジション時間 */
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;

/* イージング */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
```

### 使用例

```tsx
// ホバー
<button className="transition-colors duration-200 hover:bg-primary-600">
  ボタン
</button>

// フェードイン
<div className="animate-in fade-in duration-300">
  コンテンツ
</div>

// ローディングスピナー
<Loader2 className="h-4 w-4 animate-spin" />

// 禁止: 過度なアニメーション
// バウンス、パルス、回転など注意を引きすぎるものは避ける
```

### prefers-reduced-motion 対応

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## アプリアイコン仕様

### 必須ファイル

| ファイル | サイズ | 用途 |
|---------|--------|------|
| `favicon.ico` | 32x32 | ブラウザタブ |
| `favicon.svg` | 可変 | モダンブラウザ |
| `apple-touch-icon.png` | 180x180 | iOS ホーム画面 |
| `android-chrome-192x192.png` | 192x192 | Android |
| `android-chrome-512x512.png` | 512x512 | Android スプラッシュ |
| `og-image.png` | 1200x630 | SNS共有時 |

### デザイン原則

```tsx
// ✅ 正しい: シンプルで識別しやすいアイコン
// - 1-2色のシンプルな配色
// - 背景透過またはPrimaryカラー背景
// - 小サイズでも認識可能な形状

// ❌ 禁止: AIっぽいアイコン
// - グラデーション
// - ネオンカラー
// - 複雑な形状
// - 3D効果
```

### 配置構造

```
public/
├── favicon.ico
├── favicon.svg
├── apple-touch-icon.png
├── android-chrome-192x192.png
├── android-chrome-512x512.png
├── og-image.png
└── site.webmanifest
```

### Next.js メタデータ設定

```tsx
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'アプリ名',
  description: 'アプリの説明',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    images: ['/og-image.png'],
  },
};
```

### site.webmanifest

```json
{
  "name": "アプリ名",
  "short_name": "短縮名",
  "icons": [
    {
      "src": "/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "theme_color": "#14b8a6",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

---

## チェックリスト

### デザイン実装前

- [ ] Lucide Icons をインストール済み
- [ ] テーマカラー（Primary/Secondary）を決定
- [ ] Tailwind config にカラー設定を反映
- [ ] フォント設定完了
- [ ] アプリアイコン設計完了

### コンポーネント実装時

- [ ] 絵文字ではなく Lucide Icons を使用
- [ ] AIっぽいデザイン要素を排除
- [ ] 控えめなシャドウ・トランジション
- [ ] アイコンボタンには aria-label
- [ ] ローディング状態に Loader2 使用

### リリース前

- [ ] グラデーション・ネオンカラー未使用を確認
- [ ] 色のコントラスト比チェック
- [ ] アニメーションが控えめか確認
- [ ] Lighthouse パフォーマンスチェック
- [ ] アプリアイコン全サイズ配置済み
- [ ] site.webmanifest 設定済み
- [ ] OGP画像設定済み
