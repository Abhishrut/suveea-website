/* Suvéea — coming soon
 *
 * The artwork is a still photograph and stays exactly where it is put: it
 * never pans, tilts, scales or reacts to the pointer. What moves is only the
 * light around it -- the four hanging lamps cast volumetric shafts that carry
 * on past the edges of the photo and gold dust drifts slowly through them.
 * The light itself is steady -- nothing pulses, sweeps or flickers. The one
 * animation is the intro, where the scene resolves out of a defocus.
 *
 * Plain WebGL, no dependencies. GLSL ES 1.00 so it runs on a WebGL 1 context.
 */
(function () {
  'use strict';

  var IMG_ASPECT = 1678 / 937;

  var canvas  = document.getElementById('scene');
  var loader  = document.getElementById('loader');
  var body    = document.body;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse  = window.matchMedia('(pointer: coarse)').matches;

  /* ------------------------------------------------------------------ *
   * Shaders
   * ------------------------------------------------------------------ */

  var VERT_SCENE = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG_SCENE = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',

    'uniform sampler2D uHero;',   // the artwork
    'uniform sampler2D uBlur;',   // 128x72 pre-blurred copy: backdrop, bloom, defocus
    'uniform vec2  uRes;',
    'uniform float uImgA;',
    'uniform float uReveal;',     // 0..1 intro

    'const vec3 GOLD = vec3(1.0, 0.76, 0.40);',

    'float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }',

    'float hash21(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',

    'vec2 clampUV(vec2 uv){ return clamp(uv, vec2(0.0015), vec2(0.9985)); }',

    // one hanging lamp: a cone that keeps falling past the photo edge, with a
    // little spill upward onto the ceiling above it
    'float shaft(vec2 uv, float lx){',
    '  float d = uv.y - 0.012;',
    '  float w = 0.015 + abs(d) * 0.23;',
    '  float x = (uv.x - lx) / w;',
    '  float beam = exp(-x * x * 2.2) * exp(-max(d, 0.0) * 1.55);',
    '  beam *= d < 0.0 ? exp(d * 7.0) : 1.0;',
    '  return beam * 0.90;',
    '}',

    'void main(){',
    '  vec2 p = gl_FragCoord.xy / uRes;',
    '  p.y = 1.0 - p.y;',                    // image space: y grows downward
    '  float sa = uRes.x / uRes.y;',

    // --- fit the artwork -------------------------------------------------
    '  vec2 contain = (sa > uImgA) ? vec2(sa / uImgA, 1.0) : vec2(1.0, uImgA / sa);',
    '  vec2 cover   = (sa > uImgA) ? vec2(1.0, uImgA / sa) : vec2(sa / uImgA, 1.0);',
    // a little zoom on very wide or very tall screens so the frame is not
    // sparse, capped well short of cropping the wordmark or the tagline
    '  float k = min(max(contain.x, contain.y), (sa > uImgA) ? 1.12 : 1.38);',
    '  vec2 uv = (p - 0.5) * contain / k + 0.5;',
    // on tall screens the artwork rides a little above centre, leaving room
    // for its reflection to carry the bottom of the frame
    '  float tall = clamp(uImgA / sa - 1.0, 0.0, 1.0);',
    '  uv.y += 0.055 * tall * contain.y / k;',

    // --- the artwork, fixed in place -------------------------------------
    '  vec3 blurC = texture2D(uBlur, clampUV(uv)).rgb;',
    '  vec3 col   = texture2D(uHero, clampUV(uv)).rgb;',

    // the scene resolves out of a defocus as it arrives
    '  col = mix(blurC, col, smoothstep(0.0, 0.80, uReveal));',

    // --- bloom: warm halo off the lit gold -------------------------------
    '  float r = 0.012;',
    '  vec3 glow = texture2D(uBlur, clampUV(uv + vec2( r, 0.0))).rgb',
    '            + texture2D(uBlur, clampUV(uv + vec2(-r, 0.0))).rgb',
    '            + texture2D(uBlur, clampUV(uv + vec2(0.0,  r))).rgb',
    '            + texture2D(uBlur, clampUV(uv + vec2(0.0, -r))).rgb;',
    '  glow = max(glow * 0.25 - 0.34, 0.0);',
    '  col += glow * GOLD * 0.52;',

    // --- the room the artwork hangs in -----------------------------------
    '  vec2 uvB = (p - 0.5) * cover * 1.06 + 0.5;',
    '  vec3 room = texture2D(uBlur, clampUV(uvB)).rgb;',
    '  room = mix(vec3(luma(room)), room, 1.25) * 0.34 + GOLD * 0.012;',

    // the lit floor keeps going below the artwork as a reflection, which is
    // what fills the lower half of a phone held upright
    '  float below = max(uv.y - 1.0, 0.0);',
    '  vec2 uvR = vec2(uv.x, 2.0 - uv.y);',
    '  vec3 rc = mix(texture2D(uHero, clampUV(uvR)).rgb,',
    '                texture2D(uBlur, clampUV(uvR)).rgb,',
    '                clamp(below * 2.2, 0.0, 1.0));',
    '  float sides = smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x);',
    '  room += rc * exp(-below * 5.0) * 0.30 * sides * smoothstep(0.998, 1.006, uv.y);',

    '  vec2 edge = min(uv, 1.0 - uv);',
    '  float inside = smoothstep(0.0, 0.02, edge.x) * smoothstep(0.0, 0.02, edge.y);',
    '  vec3 outc = mix(room, col, inside);',

    // --- shafts across the whole frame, so the lamps light the room ------
    '  float sh = shaft(uv, 0.218) + shaft(uv, 0.419)',
    '           + shaft(uv, 0.577) + shaft(uv, 0.780);',
    '  outc += GOLD * sh * 0.095;',

    // --- grade -----------------------------------------------------------
    '  vec2 vp = (p - vec2(0.5, 0.47)) * vec2(max(sa, 1.0), 1.0) / max(sa, 1.0);',
    '  float vig = 1.0 - smoothstep(0.30, 0.88, length(vp));',
    '  outc *= mix(0.50, 1.0, vig);',
    '  outc = mix(vec3(luma(outc)), outc, 1.06);',
    '  outc += (hash21(gl_FragCoord.xy) - 0.5) * 0.020;',
    '  outc *= smoothstep(0.0, 0.45, uReveal);',

    '  gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  var VERT_DUST = [
    'precision mediump float;',
    'attribute vec4 aSeed;',            // x, y, speed, size/proximity
    'uniform float uTime, uDpr, uReveal, uMotion;',
    'varying float vAlpha;',
    'void main(){',
    '  float t  = uTime * uMotion;',
    '  float sp = 0.006 + aSeed.z * 0.020;',
    '  float y  = fract(aSeed.y + t * sp);',
    '  float x  = fract(aSeed.x + 0.010 * sin(t * (0.25 + aSeed.z) + aSeed.w * 12.0));',
    '  vec2 pos = vec2(x, y);',
    '  float band = mix(0.45, 1.0, smoothstep(0.05, 0.30, x) * smoothstep(0.95, 0.70, x));',
    '  vAlpha = smoothstep(0.0, 0.12, y) * smoothstep(1.0, 0.86, y)',
    '         * mix(0.35, 1.0, aSeed.w) * band * uReveal;',
    '  gl_Position  = vec4(pos * 2.0 - 1.0, 0.0, 1.0);',
    '  gl_PointSize = mix(1.2, 3.6, aSeed.w) * uDpr;',
    '}'
  ].join('\n');

  var FRAG_DUST = [
    'precision mediump float;',
    'varying float vAlpha;',
    'void main(){',
    '  float d = length(gl_PointCoord - 0.5);',
    '  float m = 1.0 - smoothstep(0.10, 0.50, d);',
    '  gl_FragColor = vec4(vec3(1.0, 0.80, 0.48) * m * vAlpha * 0.50, 1.0);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------------ *
   * Setup
   * ------------------------------------------------------------------ */

  function giveUp() {
    body.classList.add('no-webgl');
    if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
  }

  var gl = null;
  try {
    var opts = {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false
    };
    gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  } catch (e) {
    gl = null;
  }

  if (!gl) { giveUp(); return; }

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function program(vsrc, fsrc) {
    var vs = compile(gl.VERTEX_SHADER, vsrc);
    var fs = compile(gl.FRAGMENT_SHADER, fsrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  var progScene = program(VERT_SCENE, FRAG_SCENE);
  var progDust  = program(VERT_DUST,  FRAG_DUST);
  if (!progScene || !progDust) { giveUp(); return; }

  function uniforms(p, names) {
    var u = {};
    for (var i = 0; i < names.length; i++) {
      u[names[i]] = gl.getUniformLocation(p, names[i]);
    }
    return u;
  }

  var uS = uniforms(progScene, ['uHero', 'uBlur', 'uRes', 'uImgA', 'uReveal']);
  var uD = uniforms(progDust, ['uTime', 'uDpr', 'uReveal', 'uMotion']);

  // full-screen triangle
  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(progScene, 'aPos');

  // dust motes
  var DUST = coarse ? 70 : 150;
  var seeds = new Float32Array(DUST * 4);
  for (var i = 0; i < DUST; i++) {
    seeds[i * 4]     = Math.random();
    seeds[i * 4 + 1] = Math.random();
    seeds[i * 4 + 2] = Math.random();
    seeds[i * 4 + 3] = Math.pow(Math.random(), 1.6);   // mostly small, a few near
  }
  var dustBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  var aSeed = gl.getAttribLocation(progDust, 'aSeed');

  /* ------------------------------------------------------------------ *
   * Textures
   * ------------------------------------------------------------------ */

  function makeTexture(img) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    return tex;
  }

  function loadImage(sources) {
    return new Promise(function (resolve, reject) {
      var idx = 0;
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { resolve(img); };
      img.onerror = function () {
        idx++;
        if (idx < sources.length) img.src = sources[idx];
        else reject(new Error('could not load ' + sources[0]));
      };
      img.src = sources[0];
    });
  }

  /* ------------------------------------------------------------------ *
   * Sizing
   * ------------------------------------------------------------------ */

  var W = 0, H = 0, dpr = 1;
  // Enough for a 4K panel at 1:1. The scene is a single cheap full-screen
  // pass, so there is no reason to render below the display's resolution.
  var MAX_PIXELS = 9e6;

  function resize() {
    var cw = canvas.clientWidth  || window.innerWidth;
    var ch = canvas.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var over = (cw * ch * dpr * dpr) / MAX_PIXELS;
    if (over > 1) dpr = dpr / Math.sqrt(over);
    var w = Math.max(1, Math.round(cw * dpr));
    var h = Math.max(1, Math.round(ch * dpr));
    if (w === W && h === H) return false;
    W = canvas.width = w;
    H = canvas.height = h;
    gl.viewport(0, 0, W, H);
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Render loop
   * ------------------------------------------------------------------ */

  function start(images) {
    var texHero = makeTexture(images[0]);
    var texBlur = makeTexture(images[1]);

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('orientationchange', function () {
      setTimeout(resize, 120);
    }, { passive: true });

    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0.039, 0.027, 0.020, 1);

    var t0 = -1;               // set on the first frame we actually paint, so a
    var elapsed = 0;           // page opened in a background tab still gets its intro
    var running = true;

    // If frames never arrive (a wedged or software renderer), show the still.
    // A hidden tab simply is not painting yet, so keep waiting in that case.
    var guard = setTimeout(function check() {
      if (body.classList.contains('ready')) return;
      if (document.hidden) { guard = setTimeout(check, 3000); return; }
      running = false;
      giveUp();
    }, 6000);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
      } else if (!running) {
        running = true;
        t0 = performance.now() - elapsed * 1000;   // resume where we paused
        requestAnimationFrame(frame);
      }
    });

    function frame(now) {
      if (!running) return;
      resize();

      if (t0 < 0) t0 = now;
      elapsed = (now - t0) / 1000;
      var time   = reduced ? 0 : elapsed;
      var reveal = Math.min(1, Math.max(0, (elapsed - 0.15) / 1.7));
      reveal = reveal * reveal * (3 - 2 * reveal);          // smoothstep

      // scene
      gl.useProgram(progScene);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texHero);
      gl.uniform1i(uS.uHero, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texBlur);
      gl.uniform1i(uS.uBlur, 1);
      gl.uniform2f(uS.uRes, W, H);
      gl.uniform1f(uS.uImgA, IMG_ASPECT);
      gl.uniform1f(uS.uReveal, reveal);

      gl.disable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // dust
      gl.useProgram(progDust);
      gl.uniform1f(uD.uTime, time);
      gl.uniform1f(uD.uDpr, dpr);
      gl.uniform1f(uD.uReveal, reveal);
      gl.uniform1f(uD.uMotion, reduced ? 0 : 1);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf);
      gl.enableVertexAttribArray(aSeed);
      gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, DUST);

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    // hand over from the still fallback once the first frame is on screen
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        clearTimeout(guard);
        body.classList.add('ready');
      });
    });
  }

  Promise.all([
    loadImage(['assets/img/hero.webp', 'assets/img/hero.jpg']),
    loadImage(['assets/img/hero-blur.webp', 'assets/img/hero.jpg'])
  ]).then(start).catch(function (err) {
    console.error(err);
    giveUp();
  });
})();
