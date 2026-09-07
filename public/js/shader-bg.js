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

    // Pinned directly under the header wordmark. Worked out in pixels from the
    // left edge of the centred 1500px container, so it stays under the mark at
    // any viewport width instead of drifting as a uv fraction would.
    float pad = 56.0;                                       // container padding
    float left = max(0.0, (uRes.x - 1500.0) * 0.5) + pad;   // wordmark's left edge
    float topY = uRes.y - 82.0;                             // just below the 56px header

    // baseline in the same centred space as p
    float baseline = (topY - 0.5 * uRes.y) / uRes.y;
    float X = p.x * 14.0;             // tighter wavelengths at this size
    float t = uTime;

    // Envelope in pixels: the packet fades in just after the wordmark's left
    // edge and out again about its width later, so it has ends rather than
    // being cut off by anything.
    float px = gl_FragCoord.x;
    float win = smoothstep(left, left + 34.0, px) * (1.0 - smoothstep(left + 240.0, left + 330.0, px));

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

    float damp = exp(-a * (X + 3.0));
    float y = 0.0;
    float dydX = 0.0;

    for (int n = 1; n <= 4; n++) {
      float fn = float(n);
      float kn = k1 * fn;
      float wn = c * kn + 0.004 * kn * kn * kn;
      float An = 0.016 / fn;
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
    // Chain rule: X = p.x * 14.0, so dY/d(p.x) is dydX scaled by that same
    // factor. This was left at 6.0 when the wavelength was retuned, which made
    // the stroke thin out on the steep parts — the exact artefact the
    // perpendicular-distance division exists to prevent.
    float slope = dydX * 14.0;
    float dist = abs(p.y - (baseline + y)) / sqrt(1.0 + slope * slope);

    // No glow — a bare stroke. The halo was reading as a smudge at this size.
    float trace = smoothstep(0.0026, 0.0, dist) * win;

    col += trace * accent * 0.62;

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

  // DPR capped at 1.5: a full-screen fragment shader at DPR 3 is four times the
  // work for no visible gain on an effect this faint.
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
  }

  function draw(t) {
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  host.appendChild(canvas);
  resize();
  window.addEventListener('resize', resize);
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
