"""AcneLens logo (concept C1 "Clarity magnifier"): a magnifying glass whose lens shows
skin going from spotted (left) to clear (right).  Writes every SVG used by the app and brand/.

Usage: python brand/src/make_logo.py FONTS_DIR OUT_DIR
FONTS_DIR must contain the @fontsource "sora" package (wordmark is converted to outlines,
so the logo files need no font installed)."""
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

F, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
INK, SAND, BLUSH, CORAL, PAPER = "#16363B", "#F6EEE7", "#F0C7B8", "#E2725B", "#FBF8F5"
SPOTS = [(150, 196, 12), (196, 246, 9), (140, 286, 15), (198, 330, 8), (160, 368, 10), (214, 404, 7), (122, 240, 7)]
CLEAR = "M0 0 H 236 C 300 120 196 200 262 300 C 300 360 250 430 270 512 H 0 Z"   # spotted side (left)


def text_path(font, text, size, x=0.0, track=-0.02):
    f = TTFont(font); gs = f.getGlyphSet(); cm = f.getBestCmap(); s = size / f["head"].unitsPerEm
    pen = SVGPathPen(gs); cx = x
    for ch in text:
        g = cm[ord(ch)]; gs[g].draw(TransformPen(pen, (s, 0, 0, -s, cx, 0))); cx += gs[g].width * s + track * size
    return pen.getCommands(), cx - x - track * size


def wordmark(ink, accent, size=140):
    a, wa = text_path(f"{F}/fontsource-sora-5.3.0/package/files/sora-latin-600-normal.woff2", "acne", size)
    b, wb = text_path(f"{F}/fontsource-sora-5.3.0/package/files/sora-latin-400-normal.woff2", "lens", size, wa)
    return f'<path d="{a}" fill="{ink}"/><path d="{b}" fill="{accent}"/>', wa + wb


def magnifier(rim_color, handle_color, gap_color, uid, cx=220, cy=220, r=112, ring_w=18, handle_w=46):
    """Lens disc (designed at centre 256 / radius 150, scaled), gap, rim, glint, 45-degree handle."""
    k = r / 150; rim = r + 9 + ring_w / 2; a = math.radians(45)
    x0, y0 = cx + rim * math.cos(a), cy + rim * math.sin(a)
    x1, y1 = cx + (r * 2.05 + 10) * math.cos(a), cy + (r * 2.05 + 10) * math.sin(a)
    rr = r * 0.78; g0, g1 = math.radians(200), math.radians(245)
    s = f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{handle_color}" stroke-width="{handle_w}" stroke-linecap="round"/>'
    s += f'<circle cx="{cx}" cy="{cy}" r="{rim}" fill="{gap_color}"/>'
    s += f'<defs><clipPath id="lens-{uid}"><circle cx="256" cy="256" r="150"/></clipPath></defs>'
    s += f'<g transform="translate({cx} {cy}) scale({k:.5f}) translate(-256 -256)"><g clip-path="url(#lens-{uid})">'
    s += f'<rect width="512" height="512" fill="{SAND}"/><path d="{CLEAR}" fill="{BLUSH}"/>'
    s += "".join(f'<circle cx="{x}" cy="{y}" r="{q}" fill="{CORAL}"/>' for x, y, q in SPOTS) + "</g></g>"
    s += (f'<path d="M{cx + rr * math.cos(g0):.1f} {cy + rr * math.sin(g0):.1f} A {rr:.1f} {rr:.1f} 0 0 1 '
          f'{cx + rr * math.cos(g1):.1f} {cy + rr * math.sin(g1):.1f}" fill="none" stroke="#FFFFFF" stroke-width="{max(6, r * .07):.1f}" stroke-linecap="round" opacity=".75"/>')
    s += f'<circle cx="{cx}" cy="{cy}" r="{rim}" fill="none" stroke="{rim_color}" stroke-width="{ring_w}"/>'
    return s


def svg(w, h, body, vb=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb or f"0 0 {w} {h}"}" width="{w}" height="{h}">{body}</svg>'


def write(name, content):
    open(os.path.join(OUT, name), "w").write(content)


dark_mark = magnifier(SAND, CORAL, INK, "d")
write("icon-rounded.svg", svg(512, 512, f'<rect width="512" height="512" rx="116" fill="{INK}"/>' + dark_mark))
write("icon-square.svg", svg(512, 512, f'<rect width="512" height="512" fill="{INK}"/>' + dark_mark))
write("icon-maskable.svg", svg(512, 512, f'<rect width="512" height="512" fill="{INK}"/><g transform="translate(256 256) scale(.84) translate(-256 -256)">{dark_mark}</g>'))
write("favicon.svg", svg(64, 64, f'<rect width="512" height="512" rx="116" fill="{INK}"/>' + magnifier(SAND, CORAL, INK, "f", ring_w=24, handle_w=54), "0 0 512 512"))
write("mark-on-dark.svg", svg(512, 512, magnifier(SAND, CORAL, INK, "md"), "60 60 392 392"))
write("mark-on-light.svg", svg(512, 512, magnifier(INK, CORAL, PAPER, "ml"), "60 60 392 392"))
wd, ww = wordmark(SAND, CORAL); wl, _ = wordmark(INK, CORAL)
write("wordmark-dark.svg", svg(int(ww) + 8, 150, f'<g transform="translate(4 112)">{wd}</g>'))
write("wordmark-light.svg", svg(int(ww) + 8, 150, f'<g transform="translate(4 112)">{wl}</g>'))
big, bw = wordmark(INK, CORAL, 210); bigd, _ = wordmark(SAND, CORAL, 210)
W = int(560 + bw + 20)
write("lockup-light.svg", svg(W, 512, f'<rect width="512" height="512" rx="116" fill="{INK}"/>{dark_mark}<g transform="translate(570 330)">{big}</g>'))
Wd = int(470 + bw + 50)
write("lockup-dark.svg", svg(Wd, 512, f'<rect width="{Wd}" height="512" fill="{INK}"/><g transform="translate(-20 0)">{dark_mark}</g><g transform="translate(470 330)">{bigd}</g>'))
print("logo written to", OUT, "lockup width", W)
