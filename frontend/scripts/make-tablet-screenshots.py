"""Resize phone screenshots for Play Store 10-inch tablet (avoids deduplication)."""
from pathlib import Path
import sys

try:
    from PIL import Image
except ImportError:
    print("Run: pip install pillow")
    sys.exit(1)

# Put your phone screenshots in this folder (PNG or JPG)
INPUT_DIR = Path(__file__).resolve().parent.parent / "play-store-screenshots"
OUTPUT_DIR = INPUT_DIR / "tablet-10inch"

# 10-inch tablet: each side 1080–7680 px, 9:16 portrait
TARGET_W, TARGET_H = 1200, 2133


def main():
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(
        f for f in INPUT_DIR.iterdir()
        if f.suffix.lower() in (".png", ".jpg", ".jpeg") and f.is_file()
    )
    if not files:
        print(f"No images found. Copy phone screenshots into:\n  {INPUT_DIR}")
        sys.exit(1)

    for i, path in enumerate(files, 1):
        img = Image.open(path).convert("RGB")
        img = img.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
        out = OUTPUT_DIR / f"tablet10-{i}{path.suffix.lower()}"
        img.save(out, quality=95)
        print(f"Created: {out.name}")

    print(f"\nDone. Upload files from:\n  {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
