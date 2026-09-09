"""Regenerate the web assets from the masters in source/.

    python tools/build-assets.py

Everything under assets/img and assets/icons is produced here and should not
be edited by hand. The masters in source/ are never served to the page.

Needs Pillow:  pip install Pillow
"""

import os
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'source')
IMG = os.path.join(ROOT, 'assets', 'img')
ICONS = os.path.join(ROOT, 'assets', 'icons')

for d in (IMG, ICONS):
    os.makedirs(d, exist_ok=True)

# --- hero artwork ---------------------------------------------------------
hero = Image.open(os.path.join(SOURCE, 'coming-soon.png')).convert('RGB')
hero.save(os.path.join(IMG, 'hero.webp'), 'WEBP', quality=88, method=6)
hero.save(os.path.join(IMG, 'hero.jpg'), 'JPEG', quality=86,
          optimize=True, progressive=True)

# Note: a Lanczos 2x copy was measured here and gained ~2% edge energy for
# 250KB, because upscaling invents no detail. The master's own resolution is
# the ceiling; re-export it larger and this script picks the gain up for free.

# Small pre-blurred copy. The page leans on it for a lot: the room behind the
# artwork, the bloom taps, the defocus the intro pulls out of, and the CSS
# wash behind the no-WebGL fallback. Bilinear upscaling supplies the rest of
# the blur, so it can stay tiny.
(hero.resize((128, 72), Image.LANCZOS)
     .filter(ImageFilter.GaussianBlur(1.6))
     .save(os.path.join(IMG, 'hero-blur.webp'), 'WEBP', quality=82, method=6))

# --- logo -----------------------------------------------------------------
logo = Image.open(os.path.join(SOURCE, 'logo-suveea.png')).convert('RGBA')


def crop_to(threshold):
    """Trim transparent margin, keeping alpha above `threshold`."""
    mask = logo.split()[3].point(lambda p: 255 if p > threshold else 0)
    return logo.crop(mask.getbbox())


# The monogram on the loading screen keeps its glow.
monogram = crop_to(10)
monogram.thumbnail((420, 420), Image.LANCZOS)
monogram.save(os.path.join(IMG, 'monogram.webp'), 'WEBP', quality=90, method=6)

# The icons crop past that glow to the mark itself, so the S fills the tile
# instead of floating in haze.
solid = crop_to(60)


def icon(size, pad=0.94):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    s = solid.copy()
    s.thumbnail((int(size * pad), int(size * pad)), Image.LANCZOS)
    canvas.paste(s, ((size - s.width) // 2, (size - s.height) // 2), s)
    return canvas


for size in (16, 32, 180, 512):
    icon(size).save(os.path.join(ICONS, 'icon-%d.png' % size), optimize=True)
icon(32).save(os.path.join(ICONS, 'favicon.ico'),
              sizes=[(16, 16), (32, 32), (48, 48)])

print('assets/img:   %s' % ', '.join(sorted(os.listdir(IMG))))
print('assets/icons: %s' % ', '.join(sorted(os.listdir(ICONS))))
