#!/usr/bin/env python3
"""Chrome Web Store image tool: verify, flatten, and capture listing art.

The store accepts JPEG or 24-bit PNG with no alpha, at exact sizes. A
32-bit RGBA PNG is rejected and the dashboard blames "size", so check
colour type before every upload.

    store_png.py check  <file.png> [...]        # size + colour type + slot
    store_png.py flatten <in.png> <out.png>     # RGBA -> 24-bit RGB
    store_png.py shoot <page.html> <w> <h> <out.png>

Pure stdlib. Only `shoot` needs Chrome installed.
"""
import struct
import subprocess
import sys
import zlib
from pathlib import Path

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

SLOTS = {
    (128, 128): "store icon",
    (1280, 800): "screenshot",
    (640, 400): "screenshot (small)",
    (440, 280): "small promo tile",
    (1400, 560): "marquee promo tile",
}
COLOR = {0: "grayscale", 2: "24-bit RGB", 3: "palette", 4: "gray+alpha", 6: "RGBA"}


def read_png(path):
    data = Path(path).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path}: not a PNG")
    pos, idat, ihdr = 8, bytearray(), None
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        tag = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + length]
        if tag == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", body)
        elif tag == b"IDAT":
            idat += body
        elif tag == b"IEND":
            break
        pos += 12 + length
    return ihdr, bytes(idat)


def decode(path):
    (w, h, depth, color, comp, filt, interlace), idat = read_png(path)
    if not (depth == 8 and comp == 0 and filt == 0 and interlace == 0):
        raise ValueError(f"{path}: unsupported PNG variant")
    if color not in (2, 6):
        raise ValueError(f"{path}: unsupported colour type {color}")
    channels = 3 if color == 2 else 4

    raw = zlib.decompress(idat)
    stride = w * channels
    out, prev, pos = bytearray(), bytearray(stride), 0
    for _ in range(h):
        ftype = raw[pos]
        line = bytearray(raw[pos + 1 : pos + 1 + stride])
        pos += 1 + stride
        for i in range(stride):
            a = line[i - channels] if i >= channels else 0
            b = prev[i]
            c = prev[i - channels] if i >= channels else 0
            if ftype == 1:
                line[i] = (line[i] + a) & 0xFF
            elif ftype == 2:
                line[i] = (line[i] + b) & 0xFF
            elif ftype == 3:
                line[i] = (line[i] + (a + b) // 2) & 0xFF
            elif ftype == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        out += line
        prev = line
    return w, h, channels, out


def write_rgb(path, w, h, channels, pixels):
    """Composite over white and re-encode as colour type 2."""
    raw, stride = bytearray(), w * channels
    for y in range(h):
        raw.append(0)
        base = y * stride
        for x in range(w):
            o = base + x * channels
            if channels == 3:
                raw += pixels[o : o + 3]
            else:
                alpha = pixels[o + 3]
                if alpha == 255:
                    raw += pixels[o : o + 3]
                else:
                    raw += bytes(
                        (pixels[o + i] * alpha + 255 * (255 - alpha)) // 255
                        for i in range(3)
                    )

    def chunk(tag, body):
        return (
            struct.pack(">I", len(body))
            + tag
            + body
            + struct.pack(">I", zlib.crc32(tag + body) & 0xFFFFFFFF)
        )

    Path(path).write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def cmd_check(paths):
    failed = False
    for p in paths:
        (w, h, _, color, *_), _ = read_png(p)
        slot = SLOTS.get((w, h))
        problems = []
        if slot is None:
            problems.append("no matching store slot")
        if color != 2:
            problems.append(f"{COLOR.get(color, color)} — must be 24-bit RGB, no alpha")
        status = "FAIL: " + "; ".join(problems) if problems else f"ok ({slot})"
        failed |= bool(problems)
        print(f"{Path(p).name:34} {w}x{h:<6} {COLOR.get(color, color):11} {status}")
    return 1 if failed else 0


def cmd_shoot(html, width, height, out, flatten=True):
    """flatten=False keeps Chrome's RGBA output — for icons that need alpha."""
    subprocess.run(
        [
            CHROME,
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--allow-file-access-from-files",
            "--virtual-time-budget=4000",
            *([] if flatten else ["--default-background-color=00000000"]),
            f"--window-size={width},{height}",
            f"--screenshot={out}",
            f"file://{Path(html).resolve()}",
        ],
        check=True,
        capture_output=True,
    )
    w, h, channels, pixels = decode(out)
    if (w, h) != (width, height):
        raise SystemExit(f"got {w}x{h}, want {width}x{height}")
    if flatten:
        write_rgb(out, w, h, channels, pixels)
    print(f"{out}  {w}x{h}  {'24-bit RGB' if flatten else 'RGBA'}")
    return 0


def main(argv):
    if len(argv) < 2:
        raise SystemExit(__doc__)
    cmd, args = argv[1], argv[2:]
    if cmd == "check":
        return cmd_check(args)
    if cmd == "flatten":
        src, dst = args
        w, h, channels, pixels = decode(src)
        write_rgb(dst, w, h, channels, pixels)
        print(f"{dst}  {w}x{h}  24-bit RGB")
        return 0
    if cmd == "shoot":
        html, w, h, out = args
        return cmd_shoot(html, int(w), int(h), out)
    raise SystemExit(__doc__)


if __name__ == "__main__":
    sys.exit(main(sys.argv))
