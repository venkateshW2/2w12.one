(function () {
  const items = window.ITEMS || {};
  const playlist = window.PLAYLIST || [];

  // ---------------------------------------------------------------- lightbox
  const lightbox = document.getElementById('lightbox');
  const lbVideo = document.getElementById('lb-video');
  const lbSide = document.getElementById('lb-side');
  const lbTitle = document.getElementById('lb-title');
  const lbPieces = document.getElementById('lb-pieces');

  function embedHtml(item) {
    if (item.kind === 'youtube' && item.embedUrl) {
      return `<iframe src="${item.embedUrl}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    }
    if (item.kind === 'vimeo' && item.embedUrl) {
      return `<iframe src="${item.embedUrl}?autoplay=1" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    }
    if (item.kind === 'direct_video') return `<video src="${item.src}" controls autoplay></video>`;
    if (item.kind === 'direct_audio' || item.kind === 'soundcloud') {
      return `<audio src="${item.src}" controls autoplay style="width:100%;margin-top:40%;"></audio>`;
    }
    return null;
  }

  const PIECE_BASE = 'px-3.5 py-2 text-[12.5px] border-t border-line cursor-pointer text-muted hover:text-ink transition-colors';
  const PIECE_ACTIVE = 'px-3.5 py-2 text-[12.5px] border-t border-line cursor-pointer text-accent transition-colors';

  function playInMain(id) {
    const item = items[id];
    if (!item) return;
    const html = embedHtml(item);
    if (!html) {
      if (item.src) window.open(item.src, '_blank', 'noopener');
      return;
    }
    lbVideo.innerHTML = html;
    document.querySelectorAll('.lb-piece').forEach((el) => {
      el.className = el.getAttribute('data-id') === String(id) ? PIECE_ACTIVE : PIECE_BASE;
    });
  }

  function openLightbox(id) {
    const item = items[id];
    if (!item) return;

    if (item.isAlbum && item.pieceIds.length) {
      lbSide.classList.remove('hidden');
      lbTitle.textContent = item.title;
      lbPieces.innerHTML = item.pieceIds
        .map((pid) => `<div class="lb-piece ${PIECE_BASE}" data-id="${pid}">${(items[pid] || {}).title || ''}</div>`)
        .join('');
      lbPieces.querySelectorAll('.lb-piece').forEach((el) => {
        el.addEventListener('click', () => playInMain(el.getAttribute('data-id')));
      });
      const first = item.pieceIds.find((pid) => embedHtml(items[pid] || {}));
      if (first) playInMain(first);
      else lbVideo.innerHTML = '<div class="text-muted text-xs flex items-center justify-center h-full">Select a track to open it</div>';
    } else {
      lbSide.classList.add('hidden');
      const html = embedHtml(item);
      if (!html) {
        if (item.src) window.open(item.src, '_blank', 'noopener');
        return;
      }
      lbVideo.innerHTML = html;
    }

    lightbox.classList.remove('hidden');
    lightbox.classList.add('open', 'flex');
  }

  function closeLightbox() {
    lbVideo.innerHTML = '';
    lbPieces.innerHTML = '';
    lightbox.classList.remove('open', 'flex');
    lightbox.classList.add('hidden');
  }

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  // ------------------------------------------------------------------ player
  // Only real audio ends up here — a YouTube link can't be streamed by an
  // <audio> element, so those stay in the lightbox instead.
  const audio = new Audio();
  audio.preload = 'metadata';
  let queue = playlist.slice();
  let current = -1;

  const el = {
    empty: document.getElementById('pl-empty'),
    body: document.getElementById('pl-body'),
    count: document.getElementById('pl-count'),
    cover: document.getElementById('pl-cover'),
    title: document.getElementById('pl-title'),
    project: document.getElementById('pl-project'),
    seek: document.getElementById('pl-seek'),
    progress: document.getElementById('pl-progress'),
    knob: document.getElementById('pl-knob'),
    now: document.getElementById('pl-now'),
    dur: document.getElementById('pl-dur'),
    toggle: document.getElementById('pl-toggle'),
    iconPlay: document.getElementById('pl-icon-play'),
    iconPause: document.getElementById('pl-icon-pause'),
    prev: document.getElementById('pl-prev'),
    next: document.getElementById('pl-next'),
    list: document.getElementById('pl-list')
  };

  const fmt = (s) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  };

  function renderQueue() {
    const has = queue.length > 0;
    el.empty.classList.toggle('hidden', has);
    el.body.classList.toggle('hidden', !has);
    el.count.textContent = has ? queue.length + (queue.length === 1 ? ' track' : ' tracks') : '';
    if (!has) return;

    el.list.innerHTML = queue
      .map(
        (t, i) =>
          `<div class="pl-row flex items-baseline gap-2 px-4 py-2 text-[11.5px] cursor-pointer border-b border-line/60 last:border-0 transition-colors ${
            i === current ? 'text-accent' : 'text-muted hover:text-ink'
          }" data-i="${i}">
             <span class="font-mono text-[9px] opacity-60 flex-shrink-0">${String(i + 1).padStart(2, '0')}</span>
             <span class="truncate flex-1">${t.title}</span>
           </div>`
      )
      .join('');
    el.list.querySelectorAll('.pl-row').forEach((row) => {
      row.addEventListener('click', () => load(Number(row.getAttribute('data-i')), true));
    });
  }

  function load(i, autoplay) {
    if (!queue[i]) return;
    current = i;
    const t = queue[i];
    audio.src = t.src;
    el.title.textContent = t.title;
    el.project.textContent = [t.project, t.role].filter(Boolean).join(' · ');
    if (t.cover) {
      el.cover.src = t.cover;
      el.cover.classList.remove('hidden');
    } else {
      el.cover.classList.add('hidden');
    }
    renderQueue();
    if (autoplay) audio.play().catch(() => {});
  }

  function setIcon(playing) {
    el.iconPlay.classList.toggle('hidden', playing);
    el.iconPause.classList.toggle('hidden', !playing);
  }

  el.toggle.addEventListener('click', () => {
    if (current < 0) return load(0, true);
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  el.prev.addEventListener('click', () => load(current > 0 ? current - 1 : queue.length - 1, true));
  el.next.addEventListener('click', () => load(current < queue.length - 1 ? current + 1 : 0, true));

  audio.addEventListener('play', () => setIcon(true));
  audio.addEventListener('pause', () => setIcon(false));
  audio.addEventListener('ended', () => { if (current < queue.length - 1) load(current + 1, true); else setIcon(false); });
  audio.addEventListener('loadedmetadata', () => { el.dur.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    el.progress.style.width = pct + '%';
    el.knob.style.left = pct + '%';
    el.now.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('error', () => {
    // A private B2 bucket returns 401/403 here, which would otherwise fail
    // silently and look like a broken player.
    el.project.textContent = 'Could not load this file (is the bucket public?)';
  });

  el.seek.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const r = el.seek.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });

  renderQueue();

  // ------------------------------------------------------- category tabs +ial
  // FLIP: measure, re-layout, then animate each card from its old position to
  // its new one. Cheaper and smoother than animating layout directly.
  const grid = document.getElementById('grid');
  const gridEmpty = document.getElementById('grid-empty');
  const cards = Array.prototype.slice.call(grid.querySelectorAll('.project-card'));
  const tabs = Array.prototype.slice.call(document.querySelectorAll('.cat-tab'));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function filterTo(cat) {
    const before = new Map();
    cards.forEach((c) => {
      if (c.style.display !== 'none') before.set(c, c.getBoundingClientRect());
    });

    let shown = 0;
    cards.forEach((c) => {
      const tags = (c.getAttribute('data-tags') || '').split(',');
      const show = !cat || tags.indexOf(cat) !== -1;
      c.style.display = show ? '' : 'none';
      c.classList.remove('expanded');
      if (show) shown++;
    });
    gridEmpty.classList.toggle('hidden', shown > 0);

    if (reduceMotion) return;

    cards.forEach((c) => {
      if (c.style.display === 'none') return;
      const now = c.getBoundingClientRect();
      const old = before.get(c);

      if (!old) {
        // Newly revealed: settle in rather than popping.
        c.animate(
          [
            { opacity: 0, transform: 'scale(.94) translateY(10px)' },
            { opacity: 1, transform: 'none' }
          ],
          { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' }
        );
        return;
      }

      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (!dx && !dy) return;
      c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: 420,
        easing: 'cubic-bezier(.22,1,.36,1)'
      });
    });
  }

  // Tab strip overflow: arrows and edge fades, so tabs clipped by a narrow
  // viewport are discoverable rather than just cut off.
  const strip = document.getElementById('tab-strip');
  const arrowL = document.getElementById('tab-left');
  const arrowR = document.getElementById('tab-right');
  const fadeL = document.getElementById('tab-fade-l');
  const fadeR = document.getElementById('tab-fade-r');

  function syncStrip() {
    const max = strip.scrollWidth - strip.clientWidth;
    const overflowing = max > 2;
    const atStart = strip.scrollLeft <= 1;
    const atEnd = strip.scrollLeft >= max - 1;

    [arrowL, arrowR].forEach((a) => a.classList.toggle('hidden', !overflowing));
    arrowL.disabled = atStart;
    arrowR.disabled = atEnd;
    fadeL.classList.toggle('on', overflowing && !atStart);
    fadeR.classList.toggle('on', overflowing && !atEnd);
  }

  function nudge(dir) {
    strip.scrollBy({ left: dir * Math.max(140, strip.clientWidth * 0.6), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  arrowL.addEventListener('click', () => nudge(-1));
  arrowR.addEventListener('click', () => nudge(1));
  strip.addEventListener('scroll', syncStrip, { passive: true });
  window.addEventListener('resize', syncStrip);
  syncStrip();

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      tab.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      filterTo(tab.getAttribute('data-cat'));
      // Keep the grid's top in view so a filtered category needs no scrolling.
      const top = grid.getBoundingClientRect().top + window.scrollY - 110;
      if (window.scrollY > top) window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  // ------------------------------------------------------------------- cards
  cards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button, .piece-play')) return;
      card.classList.toggle('expanded');
    });

    const playBtn = card.querySelector('.card-play');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightbox(card.getAttribute('data-id'));
      });
    }

    // Load just this project's audio into the sidebar player.
    const queueBtn = card.querySelector('.card-queue');
    if (queueBtn) {
      queueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ids = (queueBtn.getAttribute('data-queue') || '').split(',');
        const picked = playlist.filter((t) => ids.indexOf(String(t.id)) !== -1);
        if (!picked.length) return;
        queue = picked;
        current = -1;
        load(0, true);
        document.getElementById('player').scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }

    card.querySelectorAll('.piece-play').forEach((row) => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = row.getAttribute('data-play');
        if (!items[id]) return;
        openLightbox(card.getAttribute('data-id'));
        playInMain(id);
      });
    });

    const poster = card.querySelector('.card-img');
    if (poster) {
      poster.addEventListener('click', (e) => {
        const item = items[card.getAttribute('data-id')];
        if (!item || !item.src) return;
        e.stopPropagation();
        openLightbox(card.getAttribute('data-id'));
      });
    }
  });
})();
