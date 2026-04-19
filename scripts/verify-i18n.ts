/**
 * i18n キー整合性チェック
 *
 * ja.json を基準として en/ko/zh-CN/zh-TW に同じキーがあるか検証する。
 * 欠落しているキーを列挙して終了する。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, "..", "apps", "mobile", "src", "locales");

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flatten(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function loadLocale(name: string): string[] {
  const raw = readFileSync(join(LOCALES_DIR, `${name}.json`), "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return flatten(parsed).sort();
}

const baseKeys = new Set(loadLocale("ja"));
const results: Array<{ locale: string; missing: string[]; extra: string[] }> = [];

const PLURAL_SUFFIXES = ["_one", "_other", "_zero", "_two", "_few", "_many"];
function normalizeKey(k: string): string {
  for (const suffix of PLURAL_SUFFIXES) {
    if (k.endsWith(suffix)) return k.slice(0, -suffix.length);
  }
  return k;
}

for (const locale of ["en", "ko", "zh-CN", "zh-TW"]) {
  const rawLocaleKeys = new Set(loadLocale(locale));
  const localeKeysNormalized = new Set([...rawLocaleKeys].map(normalizeKey));
  const missing = [...baseKeys].filter((k) => !localeKeysNormalized.has(k) && !rawLocaleKeys.has(k));
  const extra = [...rawLocaleKeys].filter((k) => !baseKeys.has(k) && !baseKeys.has(normalizeKey(k)));
  results.push({ locale, missing, extra });
}

let failed = false;
for (const r of results) {
  process.stdout.write(`\n=== ${r.locale} ===\n`);
  if (r.missing.length === 0 && r.extra.length === 0) {
    process.stdout.write("  ✓ 完全一致\n");
    continue;
  }
  failed = true;
  if (r.missing.length > 0) {
    process.stdout.write(`  missing (${r.missing.length}):\n`);
    for (const k of r.missing) process.stdout.write(`    - ${k}\n`);
  }
  if (r.extra.length > 0) {
    process.stdout.write(`  extra (${r.extra.length}):\n`);
    for (const k of r.extra) process.stdout.write(`    + ${k}\n`);
  }
}

process.exit(failed ? 1 : 0);
