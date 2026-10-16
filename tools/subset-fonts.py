#!/usr/bin/env python3
"""Rebuild the two Chinese web fonts so they contain only the characters the page uses.

Chinese fonts are several megabytes each. This script keeps just the glyphs that
appear in the CONFIG block of script.js (message, signature, egg text …) plus
common punctuation, and writes small WOFF2 files into assets/fonts/.

Run it again whenever you change the message or the signature (it also
updates the ?v= version in style.css and index.html so phones re-download):

    pip install fonttools brotli
    python3 tools/subset-fonts.py

Characters that are not in the subset still show, in the system font.

Fonts (both SIL Open Font License 1.1, licences in assets/fonts/):
  Ma Shan Zheng  — letter body   https://github.com/google/fonts/tree/main/ofl/mashanzheng
  Zhi Mang Xing  — signature     https://github.com/google/fonts/tree/main/ofl/zhimangxing
"""
import io
import pathlib
import re
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fonts"
SOURCES = {
    "MaShanZheng-Regular": "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf",
    "ZhiMangXing-Regular": "https://raw.githubusercontent.com/google/fonts/main/ofl/zhimangxing/ZhiMangXing-Regular.ttf",
}
EXTRA = "，。！？、；：“”‘’（）《》…—～·0123456789 "


def page_text():
    source = (ROOT / "script.js").read_text(encoding="utf-8")
    block = source[source.index("const CONFIG"):source.index("\n};", source.index("const CONFIG"))]
    strings = re.findall(r'"((?:[^"\\]|\\.)*)"', block)
    return "".join(strings) + EXTRA


def build(name, url, text):
    local = OUT / (name + ".ttf")                 # optional: drop the full .ttf here to skip the download
    data = local.read_bytes() if local.exists() else urllib.request.urlopen(url).read()
    font = TTFont(io.BytesIO(data))
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]                      # keep the copyright and licence names
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    target = OUT / (name + ".subset.woff2")
    font.flavor = "woff2"
    font.save(target)
    covered = set(chr(c) for c in font.getBestCmap())
    missing = sorted(set(ch for ch in text if not ch.isspace()) - covered)
    print(f"{target.name}: {target.stat().st_size / 1024:.1f} KB", f"(not in font: {''.join(missing)})" if missing else "")


def stamp_versions():
    """Point style.css and index.html at the new files with a content hash, so
    phones that cached an older subset fetch the new one."""
    import hashlib
    for name in SOURCES:
        fname = name + ".subset.woff2"
        digest = hashlib.sha1((OUT / fname).read_bytes()).hexdigest()[:8]
        for page in ("style.css", "index.html"):
            path = ROOT / page
            text = path.read_text(encoding="utf-8")
            text = re.sub(re.escape(fname) + r'(\?v=[0-9a-f]+)?', fname + "?v=" + digest, text)
            path.write_text(text, encoding="utf-8")
        print(f"{fname} -> ?v={digest}")


if __name__ == "__main__":
    text = page_text()
    for name, url in SOURCES.items():
        build(name, url, text)
    stamp_versions()
