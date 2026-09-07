(function () {
  const term = document.getElementById('term');
  if (!term) return;

  const lines = Array.prototype.slice
    .call(term.querySelectorAll('.term-line'))
    .filter((el) => el.querySelector('.term-label, .term-body, .term-note'));
  if (!lines.length) return;

  // Reduced motion: leave the text exactly as rendered.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const GLITCH_CHARS = '!<>-_\\/[]{}—=+*^?#________ABCDEF0123456789█▓▒░';
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = () => GLITCH_CHARS[rnd(GLITCH_CHARS.length)];

  // Each line's spans are captured, emptied, then refilled character by
  // character. Storing the text first means the DOM keeps the real content for
  // no-JS and for search engines.
  const plan = lines.map((line) => {
    const parts = Array.prototype.slice
      .call(line.querySelectorAll('.term-label, .term-body, .term-note'))
      .map((el) => {
        const text = el.textContent;
        el.textContent = '';
        return { el, text };
      });
    line.style.visibility = 'hidden';
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
    if (n >= plan.length) {
      // Park the cursor on the trailing prompt so the terminal reads as live
      // rather than finished.
      const idle = document.getElementById('term-idle');
      if (idle) idle.appendChild(cursor);
      else cursor.remove();
      return;
    }
    const { line, parts } = plan[n];
    line.style.visibility = '';

    let p = 0;
    (function nextPart() {
      if (p >= parts.length) {
        return setTimeout(() => typeLine(n + 1), 170);
      }
      typePart(parts[p++], nextPart);
    })();
  }

  // Small beat before it starts, so the wordmark lands first.
  setTimeout(() => typeLine(0), 420);
})();
