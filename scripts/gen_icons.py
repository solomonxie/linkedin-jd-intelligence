#!/usr/bin/env python3
"""Regenerate the extension icons and the SVG logo sources from scripts/brand.py.

public/icons/*.png keep their alpha, so the mark floats on light and dark
toolbars alike. docs/store-icon-128.png is the same mark flattened onto a white
tile, because the Chrome Web Store rejects RGBA.
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import brand
from store_png import cmd_shoot

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "public" / "icons"
DOCS = ROOT / "docs"
SIZES = (16, 32, 48, 128)


def page(size, tile=None):
    """Toolbar sizes (<=32) get the compact mark; the detail only survives above."""
    mark = brand.mark_svg(size, tile=tile, compact=size <= 32)
    bg = f"background:{tile};" if tile else ""
    return (
        "<!doctype html><meta charset='utf-8'>"
        f"<style>html,body{{margin:0;{bg}width:{size}px;height:{size}px;"
        f"overflow:hidden}}svg{{display:block}}</style>{mark}"
    )


def lockup_svg():
    sub = "Skill match · company brief · interview process"
    return f"""<svg viewBox="0 0 560 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="0.5" y="10.5" width="99" height="99" rx="21.5" fill="#fff"
        stroke="{brand.TILE_EDGE}"/>
  <g transform="translate(0 10) scale(1.5625)">{brand.glyph()}</g>
  <text x="124" y="52" font-family="{brand.FONT}" font-size="34" font-weight="700"
        fill="{brand.BLUE}">LinkedIn JD Intelligence</text>
  <text x="126" y="82" font-family="{brand.FONT}" font-size="17"
        fill="#64748B">{sub}</text>
</svg>
"""


def main():
    ICONS.mkdir(parents=True, exist_ok=True)
    DOCS.mkdir(parents=True, exist_ok=True)

    (DOCS / "logo-icon.svg").write_text(brand.mark_svg())
    (DOCS / "logo-full.svg").write_text(lockup_svg())

    with tempfile.TemporaryDirectory(prefix="icons-") as tmp:
        for size in SIZES:
            html = Path(tmp) / f"icon-{size}.html"
            html.write_text(page(size))
            cmd_shoot(html, size, size, ICONS / f"icon-{size}.png", flatten=False)

        # The store rejects alpha, so its 128 gets the white tile baked in.
        html = Path(tmp) / "store-icon.html"
        html.write_text(page(128, tile=brand.TILE_WHITE))
        cmd_shoot(html, 128, 128, DOCS / "store-icon-128.png")


if __name__ == "__main__":
    main()
