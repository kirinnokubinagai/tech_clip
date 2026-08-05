#!/usr/bin/env python3
"""Fail closed unless an EAS build response contains a finished artifact."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


def build_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("builds", "data"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    for key in ("build", "result"):
        value = payload.get(key)
        if isinstance(value, dict):
            return [value]
    return [payload]


def main() -> int:
    if len(sys.argv) != 3:
        print(f"usage: {sys.argv[0]} <json-file> <platform>", file=sys.stderr)
        return 2

    json_path = Path(sys.argv[1])
    platform = sys.argv[2]
    try:
        payload = json.loads(json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"::error::Unable to parse EAS build JSON: {exc}", file=sys.stderr)
        return 1

    builds = build_items(payload)
    if not builds:
        print("::error::EAS returned no build record.", file=sys.stderr)
        return 1

    build = builds[-1]
    status = str(build.get("status", "")).lower()
    if status != "finished":
        print(
            f"::error::EAS build did not finish (platform={platform}, status={status!r}).",
            file=sys.stderr,
        )
        return 1

    returned_platform = build.get("platform")
    if returned_platform and str(returned_platform).lower() != platform.lower():
        print(
            f"::error::EAS returned platform={returned_platform!r}, expected {platform!r}.",
            file=sys.stderr,
        )
        return 1

    artifacts = build.get("artifacts")
    if not isinstance(artifacts, dict):
        artifacts = {}
    artifact_url = (
        artifacts.get("buildUrl")
        or artifacts.get("applicationArchiveUrl")
        or build.get("buildUrl")
        or build.get("applicationArchiveUrl")
    )
    if not isinstance(artifact_url, str) or not artifact_url.startswith(("http://", "https://")):
        print("::error::Finished EAS build has no downloadable artifact URL.", file=sys.stderr)
        return 1

    build_id = build.get("id", "unknown")
    print(f"Verified EAS {platform} build {build_id}: finished artifact is available.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
