#!/usr/bin/env python3
"""Regenerate the Chrome Web Store promo tiles in docs/screenshots/store/.

Rendered in headless Chrome and re-encoded to 24-bit RGB PNG (no alpha), which
is what the Developer Dashboard accepts.
"""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import brand
from store_png import cmd_shoot

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "screenshots" / "store"

NAME = "LinkedIn JD Intelligence"
TAGLINE = "Every LinkedIn job posting, read against your resume"
CHIPS = ["Skill &amp; experience match", "Company &amp; role brief",
         "Interview process", "100% local"]


def base_css(width, height):
    return f"""
* {{ box-sizing: border-box; }}
body {{ margin: 0; width: {width}px; height: {height}px; overflow: hidden;
  background: {brand.TILE_BG}; color: #fff; font-family: {brand.FONT};
  -webkit-font-smoothing: antialiased; display: flex; }}
.tile {{ background: #fff; display: grid; place-items: center; flex: none;
  box-shadow: 0 18px 40px rgba(3,20,40,.28); }}
.tile svg {{ display: block; }}
h1 {{ margin: 0; font-weight: 700; letter-spacing: -.02em; }}
p {{ margin: 0; color: rgba(255,255,255,.82); }}
.chips {{ display: flex; flex-wrap: wrap; }}
.chip {{ border-radius: 999px; background: rgba(255,255,255,.13);
  border: 1px solid rgba(255,255,255,.2); white-space: nowrap; }}
.chip.on {{ background: rgba(34,197,94,.22); border-color: rgba(34,197,94,.55);
  color: #C9F7D8; }}
"""


def small_tile():
    """440x280 — stacked and centred, has to survive being shown at thumbnail size."""
    css = base_css(440, 280) + """
body { flex-direction: column; align-items: center; justify-content: center; gap: 20px;
  text-align: center; }
.tile { width: 92px; height: 92px; border-radius: 24px; }
h1 { font-size: 30px; }
p { font-size: 14.5px; margin-top: 9px; }
"""
    return f"""<!doctype html><meta charset="utf-8"><style>{css}</style>
<div class="tile">{brand.glyph_svg(58)}</div>
<div><h1>{NAME}</h1><p>Skill match · company brief · interview process</p></div>
"""


def marquee_tile():
    """1400x560 — featuring slot, so it can carry the full pitch."""
    chips = "".join(
        f'<span class="chip{" on" if i == len(CHIPS) - 1 else ""}">{c}</span>'
        for i, c in enumerate(CHIPS)
    )
    css = base_css(1400, 560) + """
body { align-items: center; justify-content: center; gap: 60px; }
.tile { width: 208px; height: 208px; border-radius: 52px; }
h1 { font-size: 68px; }
p { font-size: 27px; margin-top: 18px; line-height: 1.35; }
.chips { gap: 14px; margin-top: 34px; }
.chip { padding: 10px 20px; font-size: 19px; }
"""
    return f"""<!doctype html><meta charset="utf-8"><style>{css}</style>
<div class="tile">{brand.glyph_svg(130)}</div>
<div><h1>{NAME}</h1><p>{TAGLINE}</p><div class="chips">{chips}</div></div>
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ("small-promo-tile-440x280.png", small_tile(), 440, 280),
        ("marquee-promo-tile-1400x560.png", marquee_tile(), 1400, 560),
    ]
    with tempfile.TemporaryDirectory(prefix="store-assets-") as tmp:
        for name, html, width, height in jobs:
            src = Path(tmp) / (name + ".html")
            src.write_text(html)
            cmd_shoot(src, width, height, OUT / name)


if __name__ == "__main__":
    main()
