// Oscilloscope background — three slow signal traces, drifting.
//
// Chosen over the usual animated-gradient blob because it means something here:
// this is a signal, on a site about audio. Deliberately near-invisible — the
// rule worth keeping is that if you can immediately name the effect, it's twice
// as strong as it should be.
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
    // Aspect-correct and centred, so the traces don't stretch on wide screens.
    vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

    vec3 col = vec3(0.0470);          // the page background, #0c0c0c
    vec3 accent = vec3(0.788, 0.541, 0.247); // #c98a3f

    // Three traces at different amplitudes and rates. Summed sines plus a
    // little noise drift, so it never repeats visibly.
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float amp = 0.055 + 0.018 * fk;
      float freq = 1.9 + fk * 1.6;
      float rate = 0.055 + fk * 0.018;
      float yOff = -0.13 + fk * 0.13;

      float y = yOff
              + amp * sin(p.x * freq + uTime * rate * 6.2831)
              + amp * 0.42 * sin(p.x * freq * 2.3 - uTime * rate * 4.1)
              + 0.018 * (vnoise(vec2(p.x * 2.6, uTime * 0.07 + fk)) - 0.5);

      float d = abs(p.y - y);
      float core = smoothstep(0.0030, 0.0, d);
      float glow = smoothstep(0.060, 0.0, d) * 0.16;
      col += (core * 0.42 + glow) * accent;
    }

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
