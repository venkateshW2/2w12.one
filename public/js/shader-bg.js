// Wave background — a small propagating wave packet in the bottom-left corner.
//
// Actual wave physics rather than a decorative squiggle:
//   y(x,t) = SUM A_n e^(-a x) sin(k_n x - w_n t)
// a harmonic series (k_n = n k1, A_n = A/n) sharing one phase velocity so the
// packet propagates intact, plus a small k^3 dispersion term so the harmonics
// creep out of step and the crest reforms instead of looping, and e^(-a x)
// spatial attenuation, and a smoothstep envelope confining the packet to one
// corner (windowed, not cropped — it has ends). The slope is taken analytically
// so the stroke keeps a constant width where the wave is steep.
//
// Faults land on discrete ticks and act ON the wave — phase steps, wavenumber
// jumps, level jumps, hard clipping, decimation, dropouts. Nothing is painted
// over the top: an additive colour split reads as an overlay sitting on the
// image rather than as the signal itself breaking.
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

    // Confined to the bottom-left corner. A wave packet rather than a wave
    // filling the screen: localised in space, which is also the physically
    // honest way to make it small — window the amplitude, don't just crop it.
    float baseline = -0.40;           // near the bottom edge
    float X = p.x * 14.0;             // tighter wavelengths at this size
    float t = uTime;

    // Envelope: fades in from the left edge and out again, so the packet has
    // ends instead of being cut off by the viewport.
    float win = smoothstep(0.010, 0.055, uv.x) * (1.0 - smoothstep(0.20, 0.30, uv.x));

    // ---- glitch clock -------------------------------------------------------
    // Faults land on discrete ticks. Continuous wobble reads as animation;
    // discrete events read as something going wrong.
    float tick = floor(uTime * 1.05);
    float blockId = floor(uv.x * 11.0);
    float gr = hash(vec2(blockId, tick));
    float fault = step(0.90, gr);

    // Every fault below changes the wave itself — its phase, its wavenumber,
    // its gain, its sample rate. Nothing is painted over the top.
    float tear = fault * (hash(vec2(blockId, tick + 3.0)) - 0.5) * 2.2;  // phase step
    float bend = 1.0 + fault * (hash(vec2(blockId, tick + 11.0)) - 0.5) * 0.9; // wavenumber jump
    float gain = 1.0 + fault * (hash(vec2(blockId, tick + 19.0)) - 0.35) * 1.4; // level jump
    float hold = step(0.93, gr);       // decimation -> stair steps
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
    float k1 = 2.2 * bend; // fundamental wavenumber, jumps on a fault
    float c = 0.42;        // phase velocity — slow propagation
    float a = 0.055;       // attenuation

    float damp = exp(-a * (Xs + 3.0));
    float y = 0.0;
    float dydX = 0.0;

    for (int n = 1; n <= 4; n++) {
      float fn = float(n);
      float kn = k1 * fn;
      float wn = c * kn + 0.004 * kn * kn * kn;
      float An = 0.016 / fn;
      float ph = kn * Xs - wn * t + tear;
      y += An * sin(ph);
      dydX += An * kn * cos(ph);   // analytic slope, for constant line width
    }
    y *= damp * mute * gain * win;
    dydX *= damp * mute * gain * win;

    // Hard clipping — a fault flattens the crests, the way a signal clips.
    float ceilY = mix(1.0, 0.022, fault);
    y = clamp(y, -ceilY, ceilY);
    // Slope goes to zero wherever the wave is sitting on the rail.
    dydX *= 1.0 - step(ceilY, abs(y));

    // ---- draw ---------------------------------------------------------------
    // Dividing by sqrt(1 + slope^2) is the perpendicular distance to the curve,
    // so the stroke stays the same width where the wave is steep instead of
    // thinning out.
    float slope = dydX * 6.0;
    float dist = abs(p.y - (baseline + y)) / sqrt(1.0 + slope * slope);

    float core = smoothstep(0.0022, 0.0, dist);
    float glow = smoothstep(0.030, 0.0, dist) * 0.14;
    float trace = (core * 0.55 + glow) * win;

    col += trace * accent;

    // Zero axis, windowed to the same corner — a short rule the packet sits on,
    // which is what makes it read as a readout rather than a stray squiggle.
    col += smoothstep(0.0014, 0.0, abs(p.y - baseline)) * win * accent * 0.14;

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
