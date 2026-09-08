// Builds the email signature: an animated glitching 2w12.one wordmark, plus the
// paste-able signature HTML that references it.
//
// Email is a hostile target for this. Every mail client strips @keyframes, so
// the site's CSS glitch cannot travel — motion in email means an animated GIF
// and nothing else. Outlook on Windows renders GIFs through Word, which shows
// ONLY THE FIRST FRAME, so frame 0 here is deliberately the clean wordmark:
// the worst case degrades to a correct logo rather than a frozen slip.
//
// The glitch is the same technique as the site (see head.ejs): horizontal slice
// displacement — a band of the word is cut out, shoved sideways and given a
// one-sided magenta/cyan fringe, while the rest holds still. Bands are painted
// with the background so they occlude what is beneath. Chromatic offsets appear
// only on slip frames, never at rest; a permanent fringe reads as a drop shadow,
// which is the bug the site already had once.
//
// The wordmark is real Inter ExtraBold, the same face the site uses, kept in
// assets/fonts so this is reproducible without a network fetch.
//
// Needs ImageMagick (`brew install imagemagick`). Output is committed — the GIF
// has to be served from a stable absolute URL because mail clients fetch it
// from wherever it lives, forever.
//
// Usage: npm run make:signature
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FONT = path.join(ROOT, 'assets', 'fonts', 'Inter-ExtraBold.ttf');
const OUT_DIR = path.join(ROOT, 'public', 'images', 'email');
const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sig-'));

const BG = '#0c0c0c';
const INK = '#ffffff';
const MAGENTA = '#ff0080';
const CYAN = '#00e5ff';

const TEXT = '2w12.one';
// Rendered at 2x and displayed at half size, so it stays sharp on retina mail.
const POINT = 52;
const KERN = -1.5; // the site's tracking-[-0.03em], at this size
const PAD_X = 20;
const PAD_Y = 11;

function magick(args) {
  return execFileSync('magick', args, { encoding: 'utf8' });
}

// ---------------------------------------------------------------- the wordmark
// One render per colour, so the fringe is a real glyph in that colour rather
// than a tinted crop — tinting a crop would recolour the background with it.
function renderText(color, file) {
  magick([
    '-background', 'none',
    '-font', FONT,
    '-pointsize', String(POINT),
    '-kerning', String(KERN),
    '-fill', color,
    `label:${TEXT}`,
    file
  ]);
}

const tWhite = path.join(TMP, 'w.png');
const tMagenta = path.join(TMP, 'm.png');
const tCyan = path.join(TMP, 'c.png');
renderText(INK, tWhite);
renderText(MAGENTA, tMagenta);
renderText(CYAN, tCyan);

const [tw, th] = magick(['identify', '-format', '%w %h', tWhite]).split(' ').map(Number);
const W = tw + PAD_X * 2;
const H = th + PAD_Y * 2;

// Two layer sets, and the difference matters. The opaque flat is the frame's
// starting point. The bands, though, are cropped from TRANSPARENT canvases —
// cropping them from the opaque flat instead means the displaced band carries
// its own background, which covers the fringe everywhere except the canvas
// edge. That produced a glitch with no colour anywhere in it.
//
// Every intermediate is MIFF, not PNG, and that is the whole reason the fringe
// survives. A white word on a black ground is pure grey, so PNG's encoder
// writes these as Grayscale — it re-detects the type on write and ignores
// -type entirely. Compositing the magenta fringe onto a greyscale base then
// discards every trace of colour, silently: the glitch rendered perfectly and
// came out black and white. MIFF stores the colourspace verbatim.
function place(src, file, bg) {
  magick([
    '-size', `${W}x${H}`, bg, src, '-geometry', `+${PAD_X}+${PAD_Y}`, '-composite',
    '-colorspace', 'sRGB', '-type', 'TrueColorAlpha', file
  ]);
  return file;
}
const fWhite = place(tWhite, path.join(TMP, 'fw.miff'), `xc:${BG}`);
const layerWhite = place(tWhite, path.join(TMP, 'lw.miff'), 'xc:none');
const layerMagenta = place(tMagenta, path.join(TMP, 'lm.miff'), 'xc:none');
const layerCyan = place(tCyan, path.join(TMP, 'lc.miff'), 'xc:none');

// ------------------------------------------------------------------ the frames
// Bands are fractions of the word's height and displacements are fractions of
// it too, so the look survives a change of POINT. Values track the site's
// keyframes: several bands per cycle, opposite directions, one-sided fringe.
const SLIPS = {
  a: [{ top: 0.30, bot: 0.42, dx: -0.075, fringe: layerMagenta, fdx: 3 }],
  b: [{ top: 0.62, bot: 0.73, dx: 0.055, fringe: layerCyan, fdx: -3 }],
  c: [
    { top: 0.44, bot: 0.54, dx: -0.10, fringe: layerMagenta, fdx: 4 },
    { top: 0.74, bot: 0.82, dx: 0.04, fringe: null, fdx: 0 }
  ],
  d: [{ top: 0.24, bot: 0.33, dx: 0.085, fringe: layerCyan, fdx: -3 }],
  e: [
    { top: 0.50, bot: 0.62, dx: 0.11, fringe: layerMagenta, fdx: -4 },
    { top: 0.34, bot: 0.41, dx: -0.05, fringe: null, fdx: 0 }
  ]
};

function buildFrame(bands, shake, file) {
  const args = [fWhite];
  const geom = (x, y) => `${x < 0 ? '' : '+'}${x}${y < 0 ? '' : '+'}${y}`;
  bands.forEach((b) => {
    const y1 = Math.round(PAD_Y + b.top * th);
    const y2 = Math.round(PAD_Y + b.bot * th);
    const bh = Math.max(1, y2 - y1);
    const dx = Math.round(b.dx * th);

    // Erase the band, then lay the fringe down and the word band over it, so
    // only a sliver of colour survives on one edge.
    args.push('-fill', BG, '-draw', `rectangle 0,${y1} ${W},${y2}`);
    if (b.fringe) {
      args.push('(', b.fringe, '-crop', `${W}x${bh}+0+${y1}`, '+repage', ')',
        '-geometry', geom(dx + b.fdx, y1), '-composite');
    }
    args.push('(', layerWhite, '-crop', `${W}x${bh}+0+${y1}`, '+repage', ')',
      '-geometry', geom(dx, y1), '-composite');
  });

  args.push(file);
  magick(args);

  // The word itself twitches only on frames where a slice lands, so the whole
  // thing reads as one event instead of drifting constantly. Done by
  // compositing onto a fresh background — -roll wraps pixels from one edge
  // around to the other, which showed up as debris at the frame's edges.
  if (shake) {
    magick(['-size', `${W}x${H}`, `xc:${BG}`, file, '-geometry', geom(shake[0], shake[1]), '-composite', file]);
  }
  return file;
}

// Uneven on purpose: long holds, then a burst. A fixed interval reads as a
// progress bar, which is the same note as the landing terminal's cadence.
const TIMELINE = [
  { bands: [], hold: 120 },              // frame 0 — clean. Outlook shows only this.
  { bands: SLIPS.a, hold: 7, shake: [2, -1] },
  { bands: [], hold: 5 },
  { bands: SLIPS.b, hold: 6, shake: [-2, 1] },
  { bands: [], hold: 95 },
  { bands: SLIPS.c, hold: 7, shake: [-3, 1] },
  { bands: SLIPS.d, hold: 5 },
  { bands: [], hold: 6 },
  { bands: SLIPS.b, hold: 6, shake: [2, 1] },
  { bands: [], hold: 78 },
  { bands: SLIPS.e, hold: 7, shake: [3, -1] },
  { bands: [], hold: 5 },
  { bands: SLIPS.a, hold: 6, shake: [-2, 0] },
  { bands: [], hold: 60 }
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const gifArgs = ['-loop', '0'];
TIMELINE.forEach((step, i) => {
  const file = buildFrame(step.bands, step.shake, path.join(TMP, `f${String(i).padStart(2, '0')}.miff`));
  gifArgs.push('-delay', String(step.hold), file);
});

const GIF = path.join(OUT_DIR, '2w12-wordmark.gif');
magick([...gifArgs, '-layers', 'Optimize', '-colors', '64', GIF]);

// A still for anywhere a GIF is unwelcome, and for the clean first frame.
const PNG = path.join(OUT_DIR, '2w12-wordmark.png');
magick([fWhite, '-strip', PNG]);

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(1) + ' KB';
console.log('');
console.log(`  ${TEXT}  ${W}x${H} @2x  (displays ${W / 2}x${H / 2})`);
console.log(`  ${TIMELINE.length} frames, ${TIMELINE.filter((s) => s.bands.length).length} of them slips`);
console.log(`  ${kb(GIF)}  ${path.relative(ROOT, GIF)}`);
console.log(`  ${kb(PNG)}  ${path.relative(ROOT, PNG)}`);

// Mail clients that block images show alt text, and some cap animation size.
// Neither fails loudly, so warn rather than let it ship silently oversized.
if (fs.statSync(GIF).size > 200 * 1024) {
  console.log('\n  WARNING: over 200 KB — some clients refuse to animate a GIF this large.');
}
console.log('');
fs.rmSync(TMP, { recursive: true, force: true });
