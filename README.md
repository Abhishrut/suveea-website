# Suvéea — coming soon

A single static page announcing the fragrance house. The artwork is rendered
in WebGL as a lit set rather than shown flat: the four hanging lamps throw
volumetric shafts that carry on past the edges of the photograph, the lit
floor continues below it as a reflection, and gold dust drifts slowly through
the light.

The artwork itself never moves. It does not pan, tilt, scale or react to the
pointer, and the light does not pulse, sweep or flicker — rendering the scene
at two different times gives a pixel-identical image. The only animation is
the intro, where it resolves out of a defocus, and the drifting dust.

No frameworks, no build step, no fonts to download.

## Layout

```
index.html              the page
site.webmanifest        name and icons for "add to home screen"
.nojekyll               tells GitHub Pages to serve the files as-is
assets/
  css/styles.css        framing, pre-load state, no-WebGL fallback
  js/app.js             the WebGL scene (plain WebGL 1, GLSL ES 1.00)
  img/                  generated - hero, its blurred copy, the monogram
  icons/                generated - favicon and touch icons
source/                 the masters; never served to the page
  coming-soon.png
  logo-suveea.png
tools/build-assets.py   regenerates assets/img and assets/icons from source/
```

Nothing under `assets/img` or `assets/icons` should be edited by hand. To
change the artwork, replace the file in `source/` and rebuild:

```sh
pip install Pillow
python tools/build-assets.py
```

The master is currently 1678x937, which is what limits sharpness on a 4K
display. Re-exporting it larger is the one change that improves it, and needs
no code edit.

## Running it locally

```sh
python -m http.server 8000
```

then open <http://127.0.0.1:8000/>. Opening `index.html` from the filesystem
will not work — WebGL refuses to use textures loaded over `file://`.

## Publishing on GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment**, set *Source* to
   **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
3. The site appears at `https://<user>.github.io/<repo>/` within a minute or
   two. Every path in the page is relative, so it works under a repository
   subpath, at a user/organisation root, or on a custom domain unchanged.

For a custom domain, add it under **Settings → Pages → Custom domain** (that
writes a `CNAME` file), point the DNS at GitHub, and leave *Enforce HTTPS* on.

One absolute URL is needed for link previews: set `og:image` and
`twitter:image` in `index.html` to the full `https://…/assets/hero.jpg` once
the domain is settled. Everything else stays relative.

## Behaviour worth knowing

- **Every viewport.** The artwork is fitted whole — the wordmark and the
  tagline are never cropped, at any aspect ratio. A phone held upright gets a
  gentle zoom plus the floor continued as a reflection; an ultrawide monitor
  gets the room extended sideways. What surrounds the artwork is a darkened,
  blurred blow-up of itself, so the frame never shows bars.
- **Degrades quietly.** No WebGL, a failed texture, or frames that never
  arrive falls back to the still photograph over the same blurred wash.
  Without JavaScript the same still is shown.
- **Respects `prefers-reduced-motion`**: the dust stops too, leaving a
  completely still image.
- **Renders at the display's resolution**, up to 9M pixels — a 4K panel is
  drawn 1:1 rather than upscaled, at 100%, 150% or 200% OS scaling.
- **Costs little.** ~100 KB of image, one draw call for the scene and one for
  the dust, and rendering stops while the tab is in the background.
