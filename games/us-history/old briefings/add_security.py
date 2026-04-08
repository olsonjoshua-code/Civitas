"""
add_security.py
---------------
Adds anti-copy security to all HTML briefing files in a folder.

Usage:
  1. Put this script in the same folder as your briefing HTML files
     (or edit FOLDER below to point at that folder).
  2. Run:  python add_security.py
  3. Done — files are patched in place. Originals are backed up to /backup/

"""

import os
import shutil
import re

# ── CONFIG ────────────────────────────────────────────────────────────────────
FOLDER = "."          # folder containing briefing HTML files (. = same folder as script)
BACKUP = "./backup"   # backup folder (created automatically)
# ─────────────────────────────────────────────────────────────────────────────

CSS_OLD   = "* { box-sizing: border-box; }"
CSS_NEW   = "* { box-sizing: border-box; -webkit-user-select: none; user-select: none; }"

SECURITY_JS = """
    // ── Anti-copy security ─────────────────────────────────────────────────
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('copy',        e => e.preventDefault());
    document.addEventListener('cut',         e => e.preventDefault());
    document.addEventListener('paste',       e => e.preventDefault());
    document.addEventListener('dragstart',   e => e.preventDefault());
    document.addEventListener('keydown', e => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && ['c','a','s','u','p'].includes(e.key.toLowerCase())) e.preventDefault();
      if (e.key === 'F12') e.preventDefault();
      if (ctrl && e.shiftKey && ['i','j','c'].includes(e.key.toLowerCase())) e.preventDefault();
    });
    // ───────────────────────────────────────────────────────────────────────

"""

def already_patched(content):
    return "Anti-copy security" in content or "contextmenu" in content

def patch_file(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        content = f.read()

    if already_patched(content):
        return "skipped (already has security)"

    # 1. CSS: add user-select: none
    if CSS_OLD in content:
        content = content.replace(CSS_OLD, CSS_NEW, 1)
    else:
        # Fallback: inject a <style> block just before </head>
        content = content.replace(
            "</head>",
            "<style>* { -webkit-user-select: none; user-select: none; }</style>\n</head>",
            1
        )

    # 2. JS: inject before </body> (safe fallback that works in every file)
    if "</body>" in content:
        content = content.replace(
            "</body>",
            f"<script>{SECURITY_JS}</script>\n</body>",
            1
        )
    elif "</html>" in content:
        content = content.replace(
            "</html>",
            f"<script>{SECURITY_JS}</script>\n</html>",
            1
        )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    return "patched"


def main():
    os.makedirs(BACKUP, exist_ok=True)

    html_files = [
        f for f in os.listdir(FOLDER)
        if f.lower().endswith(".html") and os.path.isfile(os.path.join(FOLDER, f))
    ]

    if not html_files:
        print(f"No HTML files found in '{FOLDER}'")
        return

    print(f"Found {len(html_files)} HTML files\n")
    patched = skipped = errors = 0

    for fname in sorted(html_files):
        src = os.path.join(FOLDER, fname)
        bak = os.path.join(BACKUP, fname)

        try:
            shutil.copy2(src, bak)          # backup first
            result = patch_file(src)
            if "patched" in result:
                patched += 1
            else:
                skipped += 1
            print(f"  {result:40s}  {fname}")
        except Exception as e:
            errors += 1
            print(f"  ERROR: {e!r:40s}  {fname}")

    print(f"\nDone — {patched} patched, {skipped} skipped, {errors} errors")
    print(f"Originals backed up to: {os.path.abspath(BACKUP)}")


if __name__ == "__main__":
    main()
