#!/usr/bin/env python3
"""Make the colourful QR code printed on the birthday receipt.

    pip install qrcode pillow
    python3 tools/make-qr.py [URL]

Writes assets/receipt-qr.png. The modules run from violet to pink; the three
corner squares stay a deep violet and the code keeps a white quiet zone, so
phone cameras still read it easily.
"""
import pathlib
import sys

import qrcode
from PIL import Image, ImageDraw

URL = sys.argv[1] if len(sys.argv) > 1 else "https://3520566741-YCLi.github.io/birthday-nfc/"
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "receipt-qr.png"
CELL, QUIET = 20, 3
A, B = (108, 72, 214), (226, 66, 128)          # violet → pink
FINDER = (78, 50, 160)


def mix(t):
    return tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))


qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, border=0)
qr.add_data(URL)
qr.make(fit=True)
m = qr.get_matrix()
n = len(m)
size = (n + QUIET * 2) * CELL
img = Image.new("RGB", (size, size), "white")
d = ImageDraw.Draw(img)


def in_finder(r, c):
    return (r < 7 and c < 7) or (r < 7 and c >= n - 7) or (r >= n - 7 and c < 7)


for r in range(n):
    for c in range(n):
        if not m[r][c]:
            continue
        x, y = (c + QUIET) * CELL, (r + QUIET) * CELL
        colour = FINDER if in_finder(r, c) else mix((r + c) / (2 * n - 2))
        d.rounded_rectangle([x + 1, y + 1, x + CELL - 1, y + CELL - 1], radius=5, fill=colour)

img.save(OUT)
print(f"{OUT.name}: {n}x{n} modules, {size}px, {URL}")
