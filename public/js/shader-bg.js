// Wave background — a propagating wave, low on the page, glitching.
//
// Actual wave physics rather than a decorative squiggle:
//   y(x,t) = SUM A_n e^(-a x) sin(k_n x - w_n t)
// a harmonic series (k_n = n k1, A_n = A/n) sharing one phase velocity so the
// packet propagates intact, plus a small k^3 dispersion term so the harmonics
// creep out of step and the crest reforms instead of looping, and e^(-a x)
// spatial attenuation. The slope is taken analytically so the stroke keeps a
// constant width where the wave is steep.
//
// Faults land on discrete ticks — phase tears, zero-order hold, dropouts,
// chromatic split — because continuous wobble reads as animation while
// discrete events read as something going wrong.
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

    float baseline = -0.30;           // sits low, out of the type's way
    float X = p.x * 6.0;              // world x — a few wavelengths across
    float t = uTime;

    // ---- glitch clock -------------------------------------------------------
    // Faults land on discrete ticks. Continuous wobble reads as animation;
    // discrete events read as something going wrong.
    float tick = floor(uTime * 2.7);
    float blockId = floor(uv.x * 11.0);
    float gr = hash(vec2(blockId, tick));

    float tear = step(0.90, gr) * (hash(vec2(blockId, tick + 3.0)) - 0.5) * 2.2; // phase jump
    float hold = step(0.93, gr);   // zero-order hold -> stair steps
    float mute = 1.0 - step(0.965, gr);
    float Xs = mix(X, floor(X * 16.0) / 16.0, hold);

    // ---- travelling wave ----------------------------------------------------
    // y(x,t) = SUM A_n e^(-a x) sin(k_n x - w_n t)
    //
    // Harmonic series k_n = n k1 with A_n = A/n, so the packet has the shape of
    // a real signal rather than a bare sine. w_n = c k_n keeps the phase
    // velocity common (the shape propagates intact); the small +k^3 term is
    // dispersion, so harmonics creep out of step and the crest slowly reforms
    // instead of looping. e^(-a x) is spatial attenuation left to right.
    float k1 = 2.2;      // fundamental wavenumber
    float c = 1.15;      // phase velocity
    float a = 0.055;     // attenuation

    float damp = exp(-a * (Xs + 3.0));
    float y = 0.0;
    float dydX = 0.0;

    for (int n = 1; n <= 4; n++) {
      float fn = float(n);
      float kn = k1 * fn;
      float wn = c * kn + 0.012 * kn * kn * kn;
      float An = 0.075 / fn;
      float ph = kn * Xs - wn * t + tear;
      y += An * sin(ph);
      dydX += An * kn * cos(ph);   // analytic slope, for constant line width
    }
    y *= damp * mute;
    dydX *= damp * mute;

    // ---- draw ---------------------------------------------------------------
    // Dividing by sqrt(1 + slope^2) is the perpendicular distance to the curve,
    // so the stroke stays the same width where the wave is steep instead of
    // thinning out.
    float slope = dydX * 6.0;
    float dist = abs(p.y - (baseline + y)) / sqrt(1.0 + slope * slope);

    float core = smoothstep(0.0028, 0.0, dist);
    float glow = smoothstep(0.052, 0.0, dist) * 0.15;
    float trace = core * 0.55 + glow;

    col += trace * accent;

    // Chromatic split only on blocks that tore — never at rest.
    float split = step(0.90, gr);
    col.r += trace * split * 0.16;
    col.b += trace * split * 0.09;

    // Faint zero axis, so it reads as a wave about an equilibrium.
    col += smoothstep(0.0016, 0.0, abs(p.y - baseline)) * accent * 0.10;

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
