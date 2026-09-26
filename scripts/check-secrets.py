"""Lightweight guard for tracked files. Reports locations, never matched values."""
import pathlib
import re
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
patterns = {
    "Google API key": r"AIza[0-9A-Za-z_-]{30,}",
    "GitHub token": r"(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})",
    "Private key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "Stripe secret": r"(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}",
    "Slack token": r"xox[baprs]-[A-Za-z0-9-]{20,}",
}
private_dirs = {".data", "node_modules", "dist", "test-results", "playwright-report"}
problems = []
for name in filter(None, tracked):
    relative = pathlib.PurePosixPath(name)
    filename = relative.name
    if (private_dirs.intersection(relative.parts)
        or (filename.startswith(".env") and filename != ".env.example")
        or filename.endswith((".pem", ".key", ".p12", ".pfx", ".sqlite", ".sqlite3", ".db"))
        or (filename.endswith(".json") and filename.startswith(("credentials", "service-account", "service_account")))
        or "-firebase-adminsdk-" in filename):
        problems.append(f"{name}: private/generated file must not be tracked")
    path = root / name
    if not path.is_file():
        continue
    content = path.read_text(errors="replace")
    for label, pattern in patterns.items():
        match = re.search(pattern, content)
        if match:
            line = content[:match.start()].count("\n") + 1
            problems.append(f"{name}:{line}: possible {label}")
if problems:
    print("Credential check failed:\n" + "\n".join(problems))
    sys.exit(1)
print(f"Credential guard passed for {len(list(filter(None, tracked)))} tracked files.")
