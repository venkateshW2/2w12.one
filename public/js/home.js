(function () {
  const term = document.getElementById('term');
  if (!term) return;

  // Every row, including the trailing prompt — the prompt has to be hidden too
  // or it sits at the bottom from the start and the stack can't grow into it.
  const rows = Array.prototype.slice.call(term.querySelectorAll('.term-line'));
  if (!rows.length) return;

  // Reduced motion: leave the text exactly as rendered.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const GLITCH_CHARS = '!<>-_\\/[]{}—=+*^?#________ABCDEF0123456789█▓▒░';
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = () => GLITCH_CHARS[rnd(GLITCH_CHARS.length)];

  // Each row's spans are captured and emptied, then refilled character by
  // character. Storing the text first means the DOM keeps the real content for
  // no-JS and for search engines.
  //
  // Rows are display:none rather than hidden — they must take no space, so that
  // revealing one appends it at the bottom of a bottom-anchored stack and
  // pushes the earlier rows up, the way a terminal scrolls.
  const plan = rows.map((line) => {
    const parts = Array.prototype.slice
      .call(line.querySelectorAll('.term-label, .term-body, .term-note'))
      .map((el) => {
        const text = el.textContent;
        el.textContent = '';
        return { el, text };
      });
    line.style.display = 'none';
    return { line, parts };
  });

  const cursor = document.createElement('span');
  cursor.className = 'term-cursor';
  cursor.textContent = '█';

  function typePart(part, done) {
    const { el, text } = part;
    let i = 0;
    el.parentNode.insertBefore(cursor, el.nextSibling);

    (function step() {
      if (i >= text.length) {
        el.textContent = text;
        return done();
      }

      // Settled characters, then a couple of scrambled ones at the head so the
      // line looks like it's resolving rather than simply appearing.
      const settled = text.slice(0, i);
      const noise = i < text.length - 1 ? pick() + (Math.random() < 0.5 ? pick() : '') : '';
      el.textContent = settled + noise;

      i++;
      // Uneven cadence — a fixed interval reads as a progress bar, not typing.
      let delay = 9 + rnd(22);
      if (/[\s—,.]/.test(text[i - 1] || '')) delay += 24; // brief catch at punctuation
      if (Math.random() < 0.02) delay += 90; // occasional stall
      setTimeout(step, delay);
    })();
  }

  function typeLine(n) {
    if (n >= plan.length) return;

    const { line, parts } = plan[n];
    line.style.display = ''; // appears at the bottom; everything above shifts up

    // A row with nothing to type is the trailing prompt: park the cursor there
    // and stop, so the terminal reads as waiting for input rather than finished.
    if (!parts.length) {
      const idle = document.getElementById('term-idle');
      if (idle) idle.appendChild(cursor);
      else cursor.remove();
      return;
    }

    let p = 0;
    (function nextPart() {
      if (p >= parts.length) {
        // Beat between rows — longer after the command line, as though it ran.
        return setTimeout(() => typeLine(n + 1), n === 0 ? 340 : 150);
      }
      typePart(parts[p++], nextPart);
    })();
  }

  // Small beat before it starts, so the wordmark lands first.
  setTimeout(() => typeLine(0), 420);
})();
