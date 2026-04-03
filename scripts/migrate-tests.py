#!/usr/bin/env python3
"""
テストファイル移行スクリプト
apps/api/src/ および apps/mobile/ 配下のテストファイルを
tests/api/ および tests/mobile/ に移行し、importパスを修正する
"""

import os
import re
import shutil
from pathlib import Path

BASE = Path("/Users/kirinnokubinagaiyo/tech_clip/.worktrees/issue-633")
TESTS_DIR = BASE / "tests"

# ディレクトリ作成
def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)

# 相対importパスを解決して新しいパスに変換する
def resolve_relative_import(src_file: Path, import_path: str, dest_file: Path) -> str:
    """
    src_file から見た import_path を、dest_file から見た相対パスに変換する。
    外部パッケージ（'hono', '@/', 'vitest' など）はそのまま返す。
    """
    # 相対パス（./ or ../）でないものはそのまま
    if not import_path.startswith('.'):
        return import_path

    # src_fileのディレクトリから見たimport先の絶対パスを計算
    src_dir = src_file.parent
    abs_import = (src_dir / import_path).resolve()

    # dest_fileのディレクトリから見た相対パスを計算
    dest_dir = dest_file.parent
    try:
        rel = os.path.relpath(abs_import, dest_dir)
    except ValueError:
        # Windowsなどで異なるドライブの場合（ここでは発生しないはず）
        return import_path

    # os.path.relpath は OS のセパレータを使うので / に統一
    rel = rel.replace(os.sep, '/')

    # ./ を付ける
    if not rel.startswith('.'):
        rel = './' + rel

    return rel

def update_imports(content: str, src_file: Path, dest_file: Path) -> str:
    """ファイル内のすべての相対importパスを更新する"""

    def replace_import(match):
        quote = match.group(1)
        path = match.group(2)
        new_path = resolve_relative_import(src_file, path, dest_file)
        return f'{quote}{new_path}{quote}'

    # import ... from "..." または import "..."
    # また vi.mock("...") なども対応
    pattern = r'(["\'])(\./[^"\']+|\.\.\/[^"\']+)\1'
    updated = re.sub(pattern, replace_import, content)
    return updated

def migrate_file(src: Path, dest: Path):
    """ファイルを移行してimportパスを更新する"""
    ensure_dir(dest.parent)
    content = src.read_text(encoding='utf-8')
    updated = update_imports(content, src, dest)
    dest.write_text(updated, encoding='utf-8')
    print(f"  {src.relative_to(BASE)} -> {dest.relative_to(BASE)}")

# ===== API テストファイルの移行 =====

def migrate_api_tests():
    print("\n[API テストファイル移行]")

    # 1. apps/api/src/routes/*.test.ts -> tests/api/routes/
    api_src = BASE / "apps/api/src"

    for f in (api_src / "routes").glob("*.test.ts"):
        dest = TESTS_DIR / "api/routes" / f.name
        migrate_file(f, dest)

    # 2. apps/api/src/middleware/*.test.ts -> tests/api/middleware/
    for f in (api_src / "middleware").glob("*.test.ts"):
        dest = TESTS_DIR / "api/middleware" / f.name
        migrate_file(f, dest)

    # 3. apps/api/src/services/*.test.ts -> tests/api/services/
    for f in (api_src / "services").glob("*.test.ts"):
        dest = TESTS_DIR / "api/services" / f.name
        migrate_file(f, dest)

    # 4. apps/api/src/services/parsers/*.test.ts -> tests/api/services/parsers/
    for f in (api_src / "services/parsers").glob("*.test.ts"):
        dest = TESTS_DIR / "api/services/parsers" / f.name
        migrate_file(f, dest)

    # 5. apps/api/src/db/**/*.test.ts -> tests/api/db/
    for f in (api_src / "db").rglob("*.test.ts"):
        rel = f.relative_to(api_src / "db")
        dest = TESTS_DIR / "api/db" / rel
        migrate_file(f, dest)

    # 6. apps/api/src/lib/*.test.ts -> tests/api/lib/
    for f in (api_src / "lib").glob("*.test.ts"):
        dest = TESTS_DIR / "api/lib" / f.name
        migrate_file(f, dest)

    # 7. apps/api/src/auth/*.test.ts -> tests/api/auth/
    for f in (api_src / "auth").glob("*.test.ts"):
        dest = TESTS_DIR / "api/auth" / f.name
        migrate_file(f, dest)

    # 8. apps/api/src/openapi.test.ts -> tests/api/
    openapi_test = api_src / "openapi.test.ts"
    if openapi_test.exists():
        migrate_file(openapi_test, TESTS_DIR / "api/openapi.test.ts")

    # 9. apps/api/__tests__/validators/*.test.ts -> tests/api/validators/
    api_tests = BASE / "apps/api/__tests__"
    for f in (api_tests / "validators").glob("*.test.ts"):
        dest = TESTS_DIR / "api/validators" / f.name
        migrate_file(f, dest)

    # 10. apps/api/__tests__/services/*.test.ts -> tests/api/services/
    for f in (api_tests / "services").rglob("*.test.ts"):
        rel = f.relative_to(api_tests / "services")
        dest = TESTS_DIR / "api/services" / rel
        migrate_file(f, dest)

    # 11. apps/api/__tests__/cron/*.test.ts -> tests/api/cron/
    for f in (api_tests / "cron").glob("*.test.ts"):
        dest = TESTS_DIR / "api/cron" / f.name
        migrate_file(f, dest)

    # 12. apps/api/__tests__/middleware/*.test.ts -> tests/api/middleware/
    for f in (api_tests / "middleware").glob("*.test.ts"):
        dest = TESTS_DIR / "api/middleware" / f.name
        migrate_file(f, dest)

    # 13. apps/api/__tests__/integration/*.test.ts -> tests/api/integration/
    for f in (api_tests / "integration").glob("*.test.ts"):
        dest = TESTS_DIR / "api/integration" / f.name
        migrate_file(f, dest)

# ===== Mobile テストファイルの移行 =====

def migrate_mobile_tests():
    print("\n[Mobile テストファイル移行]")

    mobile_src = BASE / "apps/mobile/src"
    mobile_tests = BASE / "apps/mobile/__tests__"
    mobile_app = BASE / "apps/mobile/app"

    # 1. apps/mobile/src/components/**/*.test.tsx -> tests/mobile/components/
    for f in (mobile_src / "components").rglob("*.test.tsx"):
        rel = f.relative_to(mobile_src / "components")
        dest = TESTS_DIR / "mobile/components" / rel
        migrate_file(f, dest)

    # 2. apps/mobile/src/hooks/*.test.ts -> tests/mobile/hooks/
    for f in (mobile_src / "hooks").glob("*.test.ts"):
        dest = TESTS_DIR / "mobile/hooks" / f.name
        migrate_file(f, dest)

    # 3. apps/mobile/src/stores/*.test.ts -> tests/mobile/stores/
    for f in (mobile_src / "stores").glob("*.test.ts"):
        dest = TESTS_DIR / "mobile/stores" / f.name
        migrate_file(f, dest)

    # 4. apps/mobile/src/lib/*.test.ts -> tests/mobile/lib/
    for f in (mobile_src / "lib").glob("*.test.ts"):
        dest = TESTS_DIR / "mobile/lib" / f.name
        migrate_file(f, dest)

    # 5. apps/mobile/src/utils/*.test.ts -> tests/mobile/lib/
    for f in (mobile_src / "utils").glob("*.test.ts"):
        dest = TESTS_DIR / "mobile/lib" / f.name
        migrate_file(f, dest)

    # 6. apps/mobile/__tests__/article/*.test.tsx -> tests/mobile/screens/
    for f in (mobile_tests / "article").rglob("*.test.tsx"):
        dest = TESTS_DIR / "mobile/screens" / f.name
        migrate_file(f, dest)

    # 7. apps/mobile/__tests__/screens/*.test.tsx -> tests/mobile/screens/
    for f in (mobile_tests / "screens").glob("*.test.tsx"):
        dest = TESTS_DIR / "mobile/screens" / f.name
        migrate_file(f, dest)

    # 8. apps/mobile/__tests__/*.test.tsx -> tests/mobile/screens/
    for f in mobile_tests.glob("*.test.tsx"):
        dest = TESTS_DIR / "mobile/screens" / f.name
        migrate_file(f, dest)

    # 9. apps/mobile/app/**/__tests__/*.test.tsx -> tests/mobile/screens/
    for f in mobile_app.rglob("__tests__/*.test.tsx"):
        dest = TESTS_DIR / "mobile/screens" / f.name
        migrate_file(f, dest)

    # 10. apps/mobile/app/**/*.test.tsx (同一ディレクトリ) -> tests/mobile/screens/
    for f in mobile_app.rglob("*.test.tsx"):
        if "__tests__" not in str(f):
            dest = TESTS_DIR / "mobile/screens" / f.name
            migrate_file(f, dest)

if __name__ == "__main__":
    print("テストファイル移行開始...")
    migrate_api_tests()
    migrate_mobile_tests()
    print("\n移行完了!")
