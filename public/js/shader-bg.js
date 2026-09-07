// Wave background — a small propagating wave packet under the header wordmark.
//
// Actual wave physics rather than a decorative squiggle:
//   y(x,t) = SUM A_n e^(-a x) sin(k_n x - w_n t)
// a harmonic series (k_n = n k1, A_n = A/n) sharing one phase velocity so the
// packet propagates intact, plus a small k^3 dispersion term so the harmonics
// creep out of step and the crest reforms instead of looping, and e^(-a x)
// spatial attenuation, and a smoothstep envelope confining the packet (windowed
// in pixels, not cropped — it has ends, and stays pinned under the wordmark at
// any width). The slope is taken analytically so the stroke keeps a constant
// width where the wave is steep. Drawn as a bare stroke: a glow halo just read
// as a smudge at this size.
//
// No glitching here. Faults were tried on the wave — phase steps, wavenumber
// jumps, clipping, decimation — and at this size they read as noise rather
// than as a signal breaking. The glitch stays on the wordmark, where there's
// enough mass for it to register.
//
// Chosen over the usual animated-gradient blob because it means something here:
// this is a signal, on a site about audio. Still restrained — the rule worth
// keeping is that if you can immediately name the effect, it's twice as strong
// as it should be.
//
// Progressive enhancement, in this order:
//   1. no WebGL2, low-memory device, or a failed compile -> nothing mounts and
//      the page keeps its flat background. Nobody can tell.
//   2. prefers-reduced-motion -> one static frame, no loop.
//   3. otherwise -> animate, paused whenever the tab is hidden.
(function () {
  const host = document.getElementById('shader-bg');
  if (!host) return;

  // Cheap device heuristic: skip the whole thing on anything likely to struggle.
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return;

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  const VERT = `#version 300 es
  in vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime;
  // x0, x1, y of the wordmark, in device pixels, measured from the DOM.
  uniform vec3 uAnchor;
  out vec4 frag;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    // Aspect-correct and centred, so wavelengths don't stretch on wide screens.
    vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

    vec3 col = vec3(0.0470);          // the page background, #0c0c0c
    vec3 accent = vec3(0.788, 0.541, 0.247); // #c98a3f

    // Geometry comes from the DOM, not from assumptions: uAnchor carries the
    // wordmark's measured left edge, right edge and baseline y. Hardcoding the
    // container padding was wrong the moment the padding turned responsive
    // (24 / 40 / 56px), which is what threw the alignment off.
    float x0 = uAnchor.x;
    float x1 = uAnchor.y;
    float baseline = (uAnchor.z - 0.5 * uRes.y) / uRes.y; // into p's centred space
    float span = max(x1 - x0, 1.0);

    // Wavelength scales with the packet so its shape holds at any text size.
    float X = ((gl_FragCoord.x - x0) / span) * 9.0;
    float t = uTime;

    // Envelope across exactly the wordmark's width, feathered at both ends by a
    // tenth of the span so the packet has ends.
    float fade = span * 0.10;
    float px = gl_FragCoord.x;
    float win = smoothstep(x0, x0 + fade, px) * (1.0 - smoothstep(x1 - fade, x1, px));

    // ---- travelling wave ----------------------------------------------------
    // y(x,t) = SUM A_n e^(-a x) sin(k_n x - w_n t)
    //
    // Harmonic series k_n = n k1 with A_n = A/n, so the packet has the shape of
    // a real signal rather than a bare sine. w_n = c k_n keeps the phase
    // velocity common (the shape propagates intact); the small +k^3 term is
    // dispersion, so harmonics creep out of step and the crest slowly reforms
    // instead of looping. e^(-a x) is spatial attenuation left to right.
    float k1 = 2.2;      // fundamental wavenumber
    float c = 0.42;      // phase velocity — slow propagation
    float a = 0.055;     // attenuation

    float damp = exp(-a * X);
    float y = 0.0;
    float dydX = 0.0;

    for (int n = 1; n <= 4; n++) {
      float fn = float(n);
      float kn = k1 * fn;
      float wn = c * kn + 0.004 * kn * kn * kn;
      float An = 0.0095 / fn;
      float ph = kn * X - wn * t;
      y += An * sin(ph);
      dydX += An * kn * cos(ph);   // analytic slope, for constant line width
    }
    y *= damp * win;
    dydX *= damp * win;

    // ---- draw ---------------------------------------------------------------
    // Dividing by sqrt(1 + slope^2) is the perpendicular distance to the curve,
    // so the stroke stays the same width where the wave is steep instead of
    // thinning out.
    // Chain rule. X runs 0..9 across span device pixels, and p.y is in units
    // of uRes.y, so dY/d(p.y-space x) picks up both factors. Getting this wrong
    // makes the stroke thin out on the steep parts, which is the exact artefact
    // the perpendicular-distance division exists to prevent.
    float slope = dydX * (9.0 / span) * uRes.y;
    float dist = abs(p.y - (baseline + y)) / sqrt(1.0 + slope * slope);

    // No glow — a bare stroke. The halo was reading as a smudge at this size.
    float trace = smoothstep(0.0022, 0.0, dist) * win;

    col += trace * accent * 0.58;

    // Zero axis, windowed to the same span — a short rule the packet sits on,
    // which is what makes it read as a readout rather than a stray squiggle.
    col += smoothstep(0.0012, 0.0, abs(p.y - baseline)) * win * accent * 0.12;

    // Vignette, folded in rather than run as a pass.
    col *= smoothstep(1.30, 0.22, length(p * vec2(0.72, 1.0)));

    // Film grain, also folded in. Animated per frame or it reads as dirt.
    col += (hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5) * 0.016;

    // +/- half a least-significant bit kills gradient banding invisibly.
    col += (hash(gl_FragCoord.xy * 1.7) - 0.5) / 255.0;

    frag = vec4(col, 1.0);
  }`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('shader-bg:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('shader-bg:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  // One full-screen triangle — no index buffer, no quad seam.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uAnchor = gl.getUniformLocation(prog, 'uAnchor');

  // The wave sits under the header wordmark, so its geometry is measured from
  // that element rather than assumed. Anything hardcoded here breaks as soon as
  // the padding, font size or viewport changes.
  const mark = document.querySelector('.logo-glitch');

  function anchor(dpr) {
    if (!mark) return [0, 0, 0];
    const r = mark.getBoundingClientRect();
    const gap = 26; // CSS px between the wordmark's baseline and the wave's axis
    // gl_FragCoord.y counts up from the bottom, hence the flip.
    const yFromTop = r.bottom + gap;
    return [r.left * dpr, r.right * dpr, (window.innerHeight - yFromTop) * dpr];
  }

  // DPR capped at 1.5: a full-screen fragment shader at DPR 3 is four times the
  // work for no visible gain on an effect this faint.
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }
    // Re-measured every time, since the wordmark moves with the padding.
    const a = anchor(dpr);
    gl.uniform3f(uAnchor, a[0], a[1], a[2]);
  }

  function draw(t) {
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  host.appendChild(canvas);
  resize();
  window.addEventListener('resize', resize);
  // The wordmark's box changes once the webfont swaps in, so measure again.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  requestAnimationFrame(() => host.classList.add('ready')); // fade in

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    draw(0); // one frame, no loop
    return;
  }

  let raf = null;
  const start = performance.now();
  function frame(now) {
    draw((now - start) / 1000);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    } else if (!raf) {
      raf = requestAnimationFrame(frame);
    }
  });
})();
