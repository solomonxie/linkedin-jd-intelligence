"""Brand mark geometry and palette, shared by the icon and store-art generators.

The mark is a lens over a job posting: a white magnifier with a green match
check. Geometry lives on a 16-unit grid so it renders identically at 16px and
1400px.
"""

BLUE = "#0A66C2"          # --accent in src/shared/styles.css
BLUE_BRIGHT = "#1B7BDC"
BLUE_DEEP = "#084C93"
BLUE_NIGHT = "#062B56"
GREEN = "#16A34A"
GREEN_BRIGHT = "#22C55E"

GLYPH = """
<circle cx="7" cy="6.9" r="4.3" fill="#fff"/>
<rect x="9.2" y="10.2" width="4.9" height="2.5" rx="1.25" fill="#fff"
      transform="rotate(45 9.2 10.2)"/>
<path d="M4.9 6.9 L6.45 8.5 L9.2 5.1" fill="none" stroke="{check}"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
"""


def glyph(check=GREEN):
    return GLYPH.format(check=check)


def glyph_svg(size, check=GREEN, cls=""):
    """The shapes alone, transparent background — for use on a tile or panel."""
    return (
        f'<svg class="{cls}" width="{size}" height="{size}" viewBox="0 0 16 16"'
        f' xmlns="http://www.w3.org/2000/svg">{glyph(check)}</svg>'
    )


def mark_svg(size=None, grad_id="markBg"):
    """The full-bleed icon: brand gradient square plus the glyph."""
    dims = f'width="{size}" height="{size}" ' if size else ""
    return f"""<svg {dims}viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="{grad_id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{BLUE_BRIGHT}"/>
      <stop offset="0.55" stop-color="{BLUE}"/>
      <stop offset="1" stop-color="{BLUE_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="16" height="16" fill="url(#{grad_id})"/>{glyph()}</svg>
"""


FONT = ('-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, '
        "Arial, sans-serif")

TILE_BG = (
    f"radial-gradient(120% 140% at 12% 0%, rgba(255,255,255,.22) 0%,"
    f" rgba(255,255,255,0) 55%),"
    f" linear-gradient(135deg, {BLUE_BRIGHT} 0%, {BLUE} 42%, {BLUE_NIGHT} 100%)"
)
