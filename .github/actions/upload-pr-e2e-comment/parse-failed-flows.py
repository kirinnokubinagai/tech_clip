"""Extract failed test flow names from JUnit XML."""
import xml.etree.ElementTree as ET
import os
import sys

junit_path = os.environ.get("JUNIT_PATH", "")
if not junit_path:
    sys.exit(0)

try:
    tree = ET.parse(junit_path)
except Exception:
    sys.exit(0)

names = []
for tc in tree.iter("testcase"):
    if tc.find("failure") is not None or tc.find("error") is not None:
        name = tc.get("classname") or tc.get("name") or ""
        if name and name not in names:
            names.append(name)

print(", ".join(names[:5]))
