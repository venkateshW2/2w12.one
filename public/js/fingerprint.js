// Constellation map — a spectral-peak fingerprint, faked but structured.
//
// PROTOTYPE. The point set is generated, not measured. It is built to have the
// structure real analysis output has, because that's the only thing that makes
// it read as data rather than decoration:
//
//   * time on x, log frequency on y — so the same octave spacing repeats evenly
//   * harmonic stacks: peaks at f0, 2f0, 3f0 ... which on a log axis compress
//     as they rise, the single most recognisable signature of a pitched sound
//   * onsets: broadband vertical smears where a transient hits every band at once
//   * sustains: horizontal runs of peaks that decay in amplitude over time
//   * a sparse noise floor of low-amplitude peaks between events
//   * anchor -> target pair lines, the Shazam hashing relationship
//
// The seed is fixed, so it is the *same* fingerprint on every load. A field that
// re-randomises each visit reads as arbitrary; a stable one reads as a specific
// measurement of a specific thing.
//
// Replacing the fake with real audio later means swapping `buildPeaks()` for a
// precomputed JSON of peaks and keeping the renderer as is.
(function () {
  const host = document.getElementById('fingerprint');
  if (!host) return;

  const ACCENT = '201,138,63';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Deterministic PRNG (mulberry32) so the fingerprint is stable across loads.
  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // y is 0 at the bottom (low frequency) and 1 at the top, log-spaced.
  const F_MIN = 60;
  const F_MAX = 12000;
  const yOf = (f) => Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN);

  function buildPeaks() {
    const r = rng(20712);
    const peaks = [];

    // Musical events: a fundamental, a set of harmonics, a decay.
    const EVENTS = 7;
    for (let e = 0; e < EVENTS; e++) {
      const t0 = 0.045 + (e / EVENTS) * 0.9 + (r() - 0.5) * 0.035;
      const f0 = 90 * Math.pow(2, Math.floor(r() * 4) + r() * 0.4); // roughly musical
      const nHarm = 5 + Math.floor(r() * 7);
      const life = 0.06 + r() * 0.15; // how long it rings

      // Onset: a transient spraying energy across the whole spectrum.
      const onsetCount = 5 + Math.floor(r() * 5);
      for (let i = 0; i < onsetCount; i++) {
        const f = F_MIN * Math.pow(F_MAX / F_MIN, r());
        peaks.push({ t: t0 + (r() - 0.5) * 0.004, y: yOf(f), a: 0.35 + r() * 0.4, kind: 'onset' });
      }

      // Harmonics, each decaying over the event's life.
      for (let h = 1; h <= nHarm; h++) {
        const f = f0 * h;
        if (f > F_MAX) break;
        const y = yOf(f);
        const strength = (1 / Math.pow(h, 0.85)) * (0.75 + r() * 0.25);
        const steps = 2 + Math.floor(life * 26);
        for (let s = 0; s < steps; s++) {
          const frac = s / Math.max(steps - 1, 1);
          const a = strength * Math.exp(-frac * 2.6);
          if (a < 0.06) continue;
          peaks.push({
            t: t0 + frac * life,
            y: y + (r() - 0.5) * 0.006,
            a: Math.min(a, 1),
            kind: h === 1 ? 'fund' : 'harm'
          });
        }
      }
    }

    // Noise floor — sparse, weak, everywhere. Without it the field looks
    // synthetic; real peak-picking always leaves scattered survivors.
    for (let i = 0; i < 90; i++) {
      peaks.push({ t: r(), y: r(), a: 0.07 + r() * 0.1, kind: 'floor' });
    }

    peaks.sort((a, b) => a.t - b.t);

    // Anchor -> target pairs: the strongest peaks linked forward in time, which
    // is the relationship a fingerprint actually hashes.
    const anchors = peaks.filter((p) => p.a > 0.55);
    const links = [];
    anchors.forEach((anchor, i) => {
      if (i % 2) return;
      const targets = peaks.filter((q) => q.t > anchor.t + 0.012 && q.t < anchor.t + 0.11 && q.a > 0.32);
      targets.slice(0, 2).forEach((q) => links.push([anchor, q]));
    });

    return { peaks, links };
  }

  const { peaks, links } = buildPeaks();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  host.appendChild(canvas);

  let W = 0;
  let H = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = host.getBoundingClientRect();
    W = Math.max(r.width, 1);
    H = Math.max(r.height, 1);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const PAD = 2;
  const px = (t) => PAD + t * (W - PAD * 2);
  const py = (y) => H - PAD - y * (H - PAD * 2);

  function render(scan) {
    ctx.clearRect(0, 0, W, H);

    // Pair lines first, so points sit on top of them.
    ctx.lineWidth = 0.6;
    links.forEach(([a, b]) => {
      const near = scan === null ? 0 : Math.max(0, 1 - Math.abs(a.t - scan) / 0.10);
      ctx.strokeStyle = `rgba(${ACCENT},${0.05 + near * 0.20})`;
      ctx.beginPath();
      ctx.moveTo(px(a.t), py(a.y));
      ctx.lineTo(px(b.t), py(b.y));
      ctx.stroke();
    });

    // Peaks. Size and alpha follow amplitude; the scan line lifts whatever it
    // is passing over, then it decays behind — like a playhead over analysis.
    peaks.forEach((p) => {
      const lift = scan === null ? 0 : Math.max(0, 1 - Math.abs(p.t - scan) / 0.055);
      const a = Math.min(1, p.a * (0.55 + lift * 1.5));
      const rad = (p.kind === 'floor' ? 0.7 : p.kind === 'fund' ? 1.5 : 1.1) + lift * 0.9;
      ctx.fillStyle = `rgba(${ACCENT},${a * (p.kind === 'floor' ? 0.45 : 0.95)})`;
      ctx.beginPath();
      ctx.arc(px(p.t), py(p.y), rad, 0, 6.2832);
      ctx.fill();
    });

    // The scan line itself, kept faint — the points brightening is the signal.
    if (scan !== null) {
      const x = px(scan);
      const grad = ctx.createLinearGradient(x - 26, 0, x, 0);
      grad.addColorStop(0, `rgba(${ACCENT},0)`);
      grad.addColorStop(1, `rgba(${ACCENT},0.16)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - 26, 0, 26, H);
      ctx.fillStyle = `rgba(${ACCENT},0.30)`;
      ctx.fillRect(x, 0, 0.8, H);
    }
  }

  resize();
  window.addEventListener('resize', () => {
    resize();
    if (REDUCED) render(null);
  });

  if (REDUCED) {
    render(null);
    return;
  }

  const PERIOD = 11000; // one sweep, slow enough to read
  let raf = null;
  const t0 = performance.now();

  function frame(now) {
    render((((now - t0) % PERIOD) / PERIOD));
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
