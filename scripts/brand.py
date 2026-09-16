"""Brand mark geometry and palette, shared by the icon and store-art generators.

The mark is a job posting read against a profile: a blue JD card carrying the
"in" wordmark, a muted profile card behind it, and a magnifier holding a
sparkle. Geometry lives on a 64-unit grid so it renders identically at 16px and
1400px. Two colourways: `light` for white tiles, `dark` for blue/near-black.
"""

BLUE = "#0A66C2"          # --accent in src/shared/styles.css
BLUE_BRIGHT = "#1B7BDC"
BLUE_DEEP = "#084C93"
BLUE_NIGHT = "#062B56"
TILE_WHITE = "#FFFFFF"
TILE_EDGE = "#E3E8EF"

LIGHT = {
    "back": "#DCE2EA", "avatar": "#94A3B5",
    "card": BLUE, "ink": "#FFFFFF", "line": "#7FB2E6",
    "lens": "#FFFFFF", "ring": BLUE, "handle": BLUE_DEEP, "spark": BLUE,
}
DARK = {
    "back": "#B9CDE4", "avatar": "#5E7FA6",
    "card": "#FFFFFF", "ink": BLUE, "line": "#8FBBE8",
    "lens": "#FFFFFF", "ring": "#FFFFFF", "handle": "#FFFFFF", "spark": BLUE,
}


def _wordmark(fill):
    """The 'in' lettering, drawn on a 0..15 x 0..14 box."""
    return (
        f'<g fill="{fill}">'
        '<circle cx="1.75" cy="1.75" r="1.75"/>'
        '<rect x="0" y="4.8" width="3.5" height="9.2" rx="0.3"/>'
        '<rect x="5.1" y="4.8" width="3.3" height="9.2" rx="0.3"/>'
        '<path d="M8.25 8.4A3.15 3.15 0 0 1 14.55 8.4Z"/>'
        '<rect x="11.25" y="8.1" width="3.3" height="5.9" rx="0.3"/>'
        "</g>"
    )


def _sparkle(cx, cy, r, fill):
    """Four-point star with concave arms, centred on (cx, cy)."""
    a, b = 0.10 * r, 0.35 * r
    return (
        f'<path d="M{cx} {cy - r}'
        f"C{cx + a} {cy - b} {cx + b} {cy - a} {cx + r} {cy}"
        f"C{cx + b} {cy + a} {cx + a} {cy + b} {cx} {cy + r}"
        f"C{cx - a} {cy + b} {cx - b} {cy + a} {cx - r} {cy}"
        f"C{cx - b} {cy - a} {cx - a} {cy - b} {cx} {cy - r}"
        f'Z" fill="{fill}"/>'
    )


def glyph(dark=False, compact=False):
    """The shapes alone, transparent background — for use on a tile or panel.

    `compact` drops the detail that turns to mush below ~24px.
    """
    c = DARK if dark else LIGHT
    avatar = (
        f'<circle cx="41.5" cy="21.5" r="4.6" fill="{c["avatar"]}"/>' if compact
        else f'<g fill="{c["avatar"]}"><circle cx="41.5" cy="21.5" r="4"/>'
             f'<path d="M35 33.5a6.5 6.5 0 0 1 13 0Z"/></g>'
    )
    lines = "" if compact else f"""
<g fill="{c['line']}">
  <rect x="12.6" y="26.4" width="15" height="2.6" rx="1.3"/>
  <rect x="12.6" y="31.4" width="12" height="2.6" rx="1.3"/>
  <rect x="12.6" y="36.4" width="8.5" height="2.6" rx="1.3"/>
</g>"""
    mark = (13.15, 11.2, 0.98) if compact else (12.6, 11.4, 0.82)
    return f"""
<rect x="29" y="12" width="25" height="30" rx="4.5" fill="{c['back']}"/>{avatar}
<rect x="8" y="7" width="25" height="39" rx="4.5" fill="{c['card']}"/>
<g transform="translate({mark[0]} {mark[1]}) scale({mark[2]})">{_wordmark(c['ink'])}</g>{lines}
<path d="M39 48L46.4 55.4" fill="none" stroke="{c['handle']}" stroke-width="6"
      stroke-linecap="round"/>
<circle cx="30.5" cy="39.5" r="10.1" fill="{c['lens']}" stroke="{c['ring']}"
        stroke-width="3.8"/>
{_sparkle(30.5, 39.5, 6.6, c['spark'])}
"""


def glyph_svg(size, dark=False, compact=False, cls=""):
    return (
        f'<svg class="{cls}" width="{size}" height="{size}" viewBox="0 0 64 64"'
        f' xmlns="http://www.w3.org/2000/svg">{glyph(dark, compact)}</svg>'
    )


def mark_svg(size=None, radius=14, edge=False, compact=False):
    """The full icon: white tile plus the light-colourway glyph."""
    dims = f'width="{size}" height="{size}" ' if size else ""
    frame = (
        f'<rect x="0.5" y="0.5" width="63" height="63" rx="{radius - 0.5}"'
        f' fill="none" stroke="{TILE_EDGE}"/>' if edge else ""
    )
    return f"""<svg {dims}viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" rx="{radius}" fill="{TILE_WHITE}"/>{frame}{glyph(compact=compact)}</svg>
"""


# Single-quoted family names: this string is also dropped into an SVG
# font-family attribute, which is itself double-quoted.
FONT = ("-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, "
        "Arial, sans-serif")

TILE_BG = (
    f"radial-gradient(120% 140% at 12% 0%, rgba(255,255,255,.22) 0%,"
    f" rgba(255,255,255,0) 55%),"
    f" linear-gradient(135deg, {BLUE_BRIGHT} 0%, {BLUE} 42%, {BLUE_NIGHT} 100%)"
)
