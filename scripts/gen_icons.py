#!/usr/bin/env python3
"""Regenerate the extension icons and the SVG logo sources from scripts/brand.py.

Writes 24-bit RGB PNGs (no alpha) so the 128 can double as the Chrome Web Store
icon, which rejects RGBA.
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import brand
from store_png import cmd_shoot

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "public" / "icons"
ASSETS = ROOT / "src" / "assets"
STORE = ROOT / "docs" / "screenshots" / "store"
SIZES = (16, 32, 48, 128)


def page(size):
    return (
        "<!doctype html><meta charset='utf-8'>"
        f"<style>html,body{{margin:0;width:{size}px;height:{size}px;overflow:hidden}}"
        f"svg{{display:block}}</style>{brand.mark_svg(size)}"
    )


def lockup_svg():
    sub = "Skill match · company brief · interview process"
    return f"""<svg viewBox="0 0 560 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lockupBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{brand.BLUE_BRIGHT}"/>
      <stop offset="0.55" stop-color="{brand.BLUE}"/>
      <stop offset="1" stop-color="{brand.BLUE_DEEP}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="10" width="100" height="100" rx="24" fill="url(#lockupBg)"/>
  <g transform="translate(10 20) scale(5)">{brand.glyph()}</g>
  <text x="124" y="52" font-family="{brand.FONT}" font-size="34" font-weight="700"
        fill="{brand.BLUE}">LinkedIn JD Intelligence</text>
  <text x="126" y="82" font-family="{brand.FONT}" font-size="17"
        fill="#64748B">{sub}</text>
</svg>
"""


def main():
    ICONS.mkdir(parents=True, exist_ok=True)
    STORE.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)

    (ASSETS / "logo-icon.svg").write_text(brand.mark_svg())
    (ASSETS / "logo-full.svg").write_text(lockup_svg())

    with tempfile.TemporaryDirectory(prefix="icons-") as tmp:
        for size in SIZES:
            html = Path(tmp) / f"icon-{size}.html"
            html.write_text(page(size))
            cmd_shoot(html, size, size, ICONS / f"icon-{size}.png")

    store_icon = STORE / "store-icon-128.png"
    store_icon.write_bytes((ICONS / "icon-128.png").read_bytes())
    print(f"{store_icon.relative_to(ROOT)}  128x128  24-bit RGB (copy of icon-128)")


if __name__ == "__main__":
    main()
