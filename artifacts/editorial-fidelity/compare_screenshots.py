#!/usr/bin/env python3
"""Create diagnostic side-by-side and 50/50 overlay for equal-size screenshots.
Usage: python compare_screenshots.py EDITORIAL_REFERENCE_1672x941.png actual-1672x941.png
Requires: Pillow (pip install pillow). Diagnostic only; AI concept is not exact pixel ground truth.
"""
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance

if len(sys.argv) != 3:
    raise SystemExit('Usage: python compare_screenshots.py REFERENCE.png ACTUAL.png')
ref = Image.open(sys.argv[1]).convert('RGB')
actual = Image.open(sys.argv[2]).convert('RGB')
if actual.size != ref.size:
    raise SystemExit(f'Viewport mismatch: expected {ref.size}, got {actual.size}. Re-capture at exact viewport.')
out=Path('visual-qa')
out.mkdir(exist_ok=True)
Image.blend(ref, actual, .50).save(out/'overlay-50.png')
combined=Image.new('RGB',(ref.width*2,ref.height),'white')
combined.paste(ref,(0,0)); combined.paste(actual,(ref.width,0))
combined.save(out/'side-by-side.png')
ImageEnhance.Contrast(ImageChops.difference(ref,actual)).enhance(2.0).save(out/'difference.png')
print('Created visual-qa/overlay-50.png, side-by-side.png, difference.png')
