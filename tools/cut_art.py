#!/usr/bin/env python3
"""Cut Astra's Tally art into the shipped WebP set.  Run:  python3 -I tools/cut_art.py <extracted zip dir> [out dir]

Out dir defaults to public/art/t1.  Her originals are never touched (cut copies only).  Painted pieces carry margins,
so nothing is placed by its canvas: every piece is cropped to its MEASURED visible bounds (alpha > 24, her threshold).

Pals: the 16 frames of a pal share ONE box, the union of the 16 frames' visible bounds, so the character never jumps
between frames; the box's bottom edge is the lowest painted foot of the pal, so the feet stand on the box's bottom.
Frames are scaled by 0.5 (her 384 canvas -> 192), shown at 64 to 74 CSS px tall, so about 2x.
art.json records every box, the baseline it was cut at and the widest frame.  Fails over the byte budgets."""
import json, os, sys
from PIL import Image

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "public", "art", "t1")
ALPHA = 24
PALS = {"pip_fox": "pip", "hoot_owl": "hoot", "bram_bear": "bram", "nibble_rabbit": "nibble", "sprout_frog": "sprout",
        "cosmo_cat": "cosmo", "bolt_robot": "bolt", "splash_whale": "splash", "flare_dragon": "flame", "star_unicorn": "star"}
STATES = {"idle": 4, "cheer": 4, "win": 6, "think": 2}
SCALE = 0.5
PALS_BUDGET = 2.6 * 1024 * 1024
FRAME_BUDGET = 40 * 1024
TOTAL_BUDGET = 6 * 1024 * 1024


def visible(im):
    return im.getchannel("A").point(lambda v: 255 if v > ALPHA else 0).getbbox()


def save(im, path, q=85):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)
    return os.path.getsize(path)


art = {"version": "t1", "alpha": ALPHA, "scale": SCALE, "pals": {}, "beads": {}}
sizes = {}
fails = []
for folder, cid in PALS.items():
    frames = [f"{s}_{i:02d}" for s, n in STATES.items() for i in range(1, n + 1)]
    ims = {f: Image.open(os.path.join(SRC, "pals", folder, f + ".png")).convert("RGBA") for f in frames}
    canvas = {im.size for im in ims.values()}
    if len(canvas) != 1:
        fails.append(f"{cid}: frames on different canvases {canvas}")
        continue
    boxes = {f: visible(im) for f, im in ims.items()}
    x0 = min(b[0] for b in boxes.values()); y0 = min(b[1] for b in boxes.values())
    x1 = max(b[2] for b in boxes.values()); y1 = max(b[3] for b in boxes.values())
    w, h = round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)
    widest = max(frames, key=lambda f: boxes[f][2] - boxes[f][0])
    for f, im in ims.items():
        n = save(im.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS), os.path.join(OUT, "pals", cid, f + ".webp"))
        sizes[f"pals/{cid}/{f}.webp"] = n
        if n > FRAME_BUDGET:
            fails.append(f"pals/{cid}/{f}.webp is {n} bytes, over {FRAME_BUDGET}")
    por = Image.open(os.path.join(SRC, "pals", folder, "portrait.png")).convert("RGBA")
    pb = visible(por)
    side = max(pb[2] - pb[0], pb[3] - pb[1])          # a square around the painted portrait, centred on it
    cx, cy = (pb[0] + pb[2]) / 2, (pb[1] + pb[3]) / 2
    sq = (round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2))
    sizes[f"pals/{cid}/portrait.webp"] = save(por.crop(sq).resize((256, 256), Image.LANCZOS), os.path.join(OUT, "pals", cid, "portrait.webp"))
    art["pals"][cid] = {"w": w, "h": h, "frames": frames, "canvas": list(canvas.pop()),
                        "unionSrc": [x0, y0, x1, y1], "baselineSrc": y1, "baselineFrac": round(y1 / 384, 4),
                        "widest": widest, "src": folder}

for name, side in (("bead_shade", 128), ("bead_plain", 128), ("target_orb", 160), ("target_glow", 240)):
    im = Image.open(os.path.join(SRC, "beads", name + ".png")).convert("RGBA")
    # the glow is a soft falloff: cropping it at the alpha threshold leaves a hard square edge, so it keeps its canvas
    b = (0, 0, im.width, im.height) if name == "target_glow" else visible(im)
    sizes[f"beads/{name}.webp"] = save(im.crop(b).resize((side, side), Image.LANCZOS), os.path.join(OUT, "beads", name + ".webp"))
    art["beads"][name] = {"side": side, "cropSrc": list(b)}

with open(os.path.join(OUT, "art.json"), "w") as fh:
    json.dump(art, fh, indent=1)
# the same manifest for the bundle (Vite does not import from public/): the pal boxes are known before any frame loads
if len(sys.argv) <= 2:
    with open(os.path.join(os.path.dirname(__file__), "..", "src", "art-t1.json"), "w") as fh:
        json.dump(art, fh, indent=1)

pals_bytes = sum(n for k, n in sizes.items() if k.startswith("pals/"))
total = sum(sizes.values())
for k in sorted(sizes):
    print(f"{sizes[k]:>8}  {k}")
for cid, a in art["pals"].items():
    print(f"{cid:>7} box {a['w']}x{a['h']}  baseline {a['baselineSrc']}/384 ({a['baselineFrac']})  widest {a['widest']}")
print(f"pals {pals_bytes} bytes, all {total} bytes")
if pals_bytes > PALS_BUDGET:
    fails.append(f"pals folder {pals_bytes} bytes, over {int(PALS_BUDGET)}")
if total > TOTAL_BUDGET:
    fails.append(f"art {total} bytes, over {TOTAL_BUDGET}")
if fails:
    print("FAIL\n" + "\n".join(fails))
    sys.exit(1)
print("PASS")
