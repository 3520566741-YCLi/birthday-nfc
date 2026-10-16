#!/usr/bin/env python3
"""Make the codes printed on the birthday receipt.

    pip install qrcode python-barcode pillow
    python3 tools/make-qr.py [URL]

assets/receipt-qr.png       a cute QR code: candy-dot modules in violet → pink,
                            rounded corner "eyes", a little cake in the middle.
                            High error correction keeps it scannable with the
                            badge on top.
assets/receipt-barcode.png  a Code 128 barcode with the receipt number, for the
                            receipt look (phone cameras open links from the QR
                            code, not from barcodes).
"""
import io
import pathlib
import sys

import barcode
import qrcode
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw

URL = sys.argv[1] if len(sys.argv) > 1 else "https://3520566741-YCLi.github.io/birthday-nfc/"
NUMBER = "HBD-20261013"
ASSETS = pathlib.Path(__file__).resolve().parent.parent / "assets"
CELL, QUIET = 24, 2
A, B = (124, 92, 232), (238, 92, 150)           # violet → pink, dark enough to scan
EYE_OUT, EYE_IN = (110, 78, 214), (236, 88, 146)


def mix(t):
    return tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))


qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=0)
qr.add_data(URL)
qr.make(fit=True)
m = qr.get_matrix()
n = len(m)
size = (n + QUIET * 2) * CELL
PAPER = (255, 253, 248)                         # the receipt paper colour
img = Image.new("RGB", (size, size), PAPER)
d = ImageDraw.Draw(img)

eyes = [(0, 0), (0, n - 7), (n - 7, 0)]
badge = int(n * 0.22) | 1                       # odd number of cells, centred
b0 = (n - badge) // 2


def in_eye(r, c):
    return any(er <= r < er + 7 and ec <= c < ec + 7 for er, ec in eyes)


def in_badge(r, c):
    return b0 - 1 <= r < b0 + badge + 1 and b0 - 1 <= c < b0 + badge + 1


for r in range(n):
    for c in range(n):
        if not m[r][c] or in_eye(r, c) or in_badge(r, c):
            continue
        cx, cy = (c + QUIET + .5) * CELL, (r + QUIET + .5) * CELL
        rad = CELL * .44
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=mix((r + c) / (2 * n - 2)))

for er, ec in eyes:                              # rounded "eyes"
    x, y = (ec + QUIET) * CELL, (er + QUIET) * CELL
    d.rounded_rectangle([x, y, x + 7 * CELL, y + 7 * CELL], radius=CELL * 2.2, fill=EYE_OUT)
    d.rounded_rectangle([x + CELL, y + CELL, x + 6 * CELL, y + 6 * CELL], radius=CELL * 1.6, fill=PAPER)
    d.rounded_rectangle([x + 2 * CELL, y + 2 * CELL, x + 5 * CELL, y + 5 * CELL], radius=CELL * 1.2, fill=EYE_IN)

# the cake badge
bx, by = (b0 + QUIET) * CELL, (b0 + QUIET) * CELL
bs = badge * CELL
d.rounded_rectangle([bx - CELL * .4, by - CELL * .4, bx + bs + CELL * .4, by + bs + CELL * .4], radius=CELL * 1.6, fill=PAPER)
d.rounded_rectangle([bx, by, bx + bs, by + bs], radius=CELL * 1.3, fill=(255, 240, 246))
u = bs / 20
def R(x0, y0, x1, y1, f, rr=0):
    d.rounded_rectangle([bx + x0 * u, by + y0 * u, bx + x1 * u, by + y1 * u], radius=rr * u, fill=f)
R(3, 11, 17, 16.5, (255, 214, 228), 1.5)         # bottom tier
R(3, 10.5, 17, 12.5, (201, 178, 255), 1)          # its frosting
R(5.5, 7.5, 14.5, 11, (255, 246, 249), 1.2)       # top tier
R(5.5, 7.3, 14.5, 8.8, (255, 143, 178), 0.8)      # its frosting
R(2, 16.2, 18, 17.4, (233, 214, 230), 0.6)        # plate
for cxu, col in ((7.6, (185, 163, 255)), (10, (255, 143, 178)), (12.4, (143, 211, 255))):
    R(cxu - .55, 4.2, cxu + .55, 7.6, col, .4)    # candles
    d.ellipse([bx + (cxu - .6) * u, by + 2.3 * u, bx + (cxu + .6) * u, by + 4.3 * u], fill=(255, 194, 74))

img.save(ASSETS / "receipt-qr.png")
print(f"receipt-qr.png: {n}x{n} modules, {size}px, {URL}")

# Code 128 barcode, drawn with plain dark bars
buf = io.BytesIO()
barcode.get("code128", NUMBER, writer=ImageWriter()).write(
    buf, {"module_width": .32, "module_height": 11, "quiet_zone": 1.5, "write_text": False,
          "foreground": "#2b2235", "background": "#fffdf8", "dpi": 300})
Image.open(io.BytesIO(buf.getvalue())).convert("RGB").save(ASSETS / "receipt-barcode.png")
print(f"receipt-barcode.png: {NUMBER}")
