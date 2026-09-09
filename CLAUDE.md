# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A single static "coming soon" page for a fragrance brand, deployed on GitHub
Pages. No framework, no bundler, no test suite. `index.html` must stay at the
repo root and every path must stay relative, so the site works unchanged under
a Pages project subpath, a user root, or a custom domain.

## Commands

```sh
python -m http.server 8000          # serve; then open http://127.0.0.1:8000/
python tools/build-assets.py        # regenerate assets/img + assets/icons (needs Pillow)
node --check assets/js/app.js       # syntax check; there is no build or lint step
```

Opening `index.html` over `file://` fails — WebGL rejects textures loaded from
that origin. Always serve over HTTP.

## The artwork must not move

This is a product requirement from the owner, who found earlier motion
disorienting, not a stylistic default. **Do not reintroduce pointer parallax,
autonomous drift, a travelling highlight, pulsing bloom, flickering lamps, or
an intro zoom.** The scene fragment shader deliberately declares neither a
clock nor a pointer uniform, which makes the constraint structural rather than
a matter of tuned-down constants.

To verify after touching the shader: render the scene at two very different
times and diff. It must be pixel-identical (`ImageChops.difference(...).getbbox()`
returns `None`). The only permitted animation is the one-shot intro defocus
and the drifting dust in the separate points pass.

## Architecture

Everything visual is one fragment shader in `assets/js/app.js`. Shaders live as
arrays of strings joined with `\n`; the context requested is `webgl` (WebGL 1)
and the GLSL is ES 1.00. Two draw calls per frame: a full-screen triangle for
the scene, then `gl.POINTS` with additive blending (`ONE, ONE`) for the dust.

**`assets/img/hero-blur.webp` is load-bearing.** It is only 128x72, and four
separate effects depend on it: the darkened room filling the frame around the
artwork, the bloom taps, the defocus the intro resolves out of, and (via CSS)
the wash behind the no-WebGL fallback. Bilinear magnification supplies the
blur, which is why it can stay ~1 KB. Changing its size or blur radius moves
all four at once.

**Fit math.** The shader works in image space with y pointing *down*
(`p.y = 1.0 - p.y` right after reading `gl_FragCoord`), so textures are sampled
without any flip. A `contain` mapping is combined with a zoom `k`, capped at
`1.12` on wide screens and `1.38` on tall ones. Those caps are not arbitrary:
they are the largest zoom that still keeps the wordmark and the tagline
uncropped at any aspect ratio. Raising them crops the brand message. Tall
screens additionally shift the artwork up slightly and continue the lit floor
below it as a mirrored reflection — that reflection is what fills the lower
half of a phone held upright.

**Constants measured from the artwork.** The four lamp x-positions
(`0.218, 0.419, 0.577, 0.780`) that place the light shafts were measured from
the source image's bright pixels, and the fit caps assume the current
composition. Replacing `source/coming-soon.png` with a different layout means
re-deriving these; replacing it with a higher-resolution export of the *same*
composition needs no code change.

**Startup state machine.** The still `<img>` fallback is visible from first
paint, so the page is never blank. `app.js` then adds either `ready` to
`<body>` (canvas fades in over the still) or `no-webgl` (still stays, canvas
and loader removed). A guard timer falls back to the still if frames never
arrive, but skips that while `document.hidden`, since a background tab simply
is not painting. The intro clock starts on the first *painted* frame, not on
script start, so a page opened in a background tab still gets its intro.

**Path resolution differs by file type** — the trap when moving files.
`url()` in `assets/css/styles.css` resolves against the stylesheet
(`../img/...`), while image paths in `assets/js/app.js` are fetched by the
document and so stay page-relative (`assets/img/...`). After any move, fetch
every URL referenced from the HTML, CSS, JS and manifest and confirm each
returns 200.

**Generated vs authored.** Everything in `assets/img` and `assets/icons` is
output of `tools/build-assets.py`; never hand-edit it. The masters live in
`source/` and are not referenced by the page (they are still publicly
reachable on Pages).

## Verifying visual changes

`requestAnimationFrame` does not fire while the browser window is hidden or
occluded, so the page will sit on its loader and screenshots will show nothing
rendering. That is an environment artifact, not a bug. Work around it by
rendering the shaders to an offscreen canvas (create the context with
`preserveDrawingBuffer: true`), or by shimming
`requestAnimationFrame` with `setTimeout` before running `app.js`.

## Known limits and outstanding work

- `source/coming-soon.png` is 1678x937, which is the ceiling on sharpness — a
  4K display magnifies it ~2.3x. A Lanczos 2x pre-upscale was measured and
  gained ~2% edge energy for 250 KB, so it was rejected; only a genuinely
  higher-resolution export helps.
- `MAX_PIXELS` in `app.js` is `9e6` so a 4K panel renders 1:1 at 100%, 150%
  and 200% OS scaling. It was previously `2.6e6`, which silently rendered 4K
  at ~2150x1209 and upscaled it. Do not lower it without measuring.
- `og:image` / `twitter:image` in `index.html` are still relative. The Open
  Graph spec wants absolute URLs, so these need the real domain filled in
  before link previews will show the image.
