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
    if (item.kind === 'soundcloud' && item.embedUrl) {
      // SoundCloud's own file URL is signed and expiring, so the widget is the
      // only way to play it. Visible here, so let it show its artwork.
      const visual = item.embedUrl.replace('visual=false', 'visual=true').replace('show_artwork=false', 'show_artwork=true');
      return `<iframe src="${visual}&auto_play=true" allow="autoplay" style="width:100%;height:100%;border:0;"></iframe>`;
    }
    if (item.kind === 'direct_audio') {
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
  // Two ways to play, one interface. A direct file goes through <audio>. A
  // SoundCloud track or set cannot — its real file URL is signed and expiring —
  // so it plays through a hidden widget iframe driven by SoundCloud's Widget
  // API, while this sidebar stays the only player the visitor ever sees.
  const audio = new Audio();
  audio.preload = 'metadata';
  let queue = [];
  let current = -1;
  let mode = 'file'; // 'file' | 'sc'
  let widget = null;
  let loadedSet = null;
  let scDuration = 0;

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

  function paint(cur, dur) {
    const pct = dur ? (cur / dur) * 100 : 0;
    el.progress.style.width = pct + '%';
    el.knob.style.left = pct + '%';
    el.now.textContent = fmt(cur);
    if (dur) el.dur.textContent = fmt(dur);
  }

  function paintTrack(t) {
    el.title.textContent = t.title;
    el.project.textContent = [t.project, t.role].filter(Boolean).join(' \u00b7 ');
    if (t.cover) {
      el.cover.src = t.cover;
      el.cover.classList.remove('hidden');
    } else {
      el.cover.classList.add('hidden');
    }
  }

  // SC.Widget can only bind to an iframe that is ALREADY a SoundCloud player —
  // it talks to the widget over postMessage, and about:blank has no listener on
  // the other end. So the iframe is pointed at a real widget URL first and only
  // then wrapped, which is why this is a two-step boot rather than one call.
  function bindWidget(w) {
    const E = window.SC.Widget.Events;

    w.bind(E.PLAY, () => {
      if (mode !== 'sc') return;
      setIcon(true);
      revealPlayer();
      w.getDuration((d) => {
        scDuration = (d || 0) / 1000;
        el.dur.textContent = fmt(scDuration);
      });
      // Which track the widget is actually on is the truth; the sidebar follows
      // it, so SoundCloud advancing a set on its own keeps the list in sync.
      if (w.getCurrentSoundIndex) {
        w.getCurrentSoundIndex((idx) => {
          if (typeof idx === 'number' && queue[idx] && idx !== current) {
            current = idx;
            paintTrack(queue[idx]);
            renderQueue();
          }
        });
      }
    });
    w.bind(E.PAUSE, () => { if (mode === 'sc') setIcon(false); });
    w.bind(E.PLAY_PROGRESS, (e) => {
      if (mode === 'sc') paint((e.currentPosition || 0) / 1000, scDuration);
    });
    w.bind(E.FINISH, () => {
      if (mode === 'sc' && current >= queue.length - 1) setIcon(false);
    });
    if (E.ERROR) {
      w.bind(E.ERROR, () => {
        if (mode === 'sc') el.project.textContent = 'SoundCloud would not load this (check the secret link)';
      });
    }
  }

  // A set's track list only exists in the browser — the widget page is a 2 KB
  // shell and SoundCloud resolves the sounds client-side — so the queue for a
  // set has to be expanded on demand rather than baked in at build time.
  // SC.Widget.load() wants the resource — the playlist URL that sits inside the
  // player URL's own url= param — not the player URL itself. Handing it the
  // latter loads nothing, silently: no sounds, no playback, no error.
  function scResourceOf(widgetUrl) {
    const m = String(widgetUrl || '').match(/[?&]url=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function expandSet(w, entry, autoplay, attempt) {
    const tries = attempt || 0;
    w.getSounds(function (sounds) {
      // getSounds hands back placeholder objects for sounds SoundCloud has not
      // hydrated yet; those have no title, so they are not rows. An empty
      // answer usually means "not yet" rather than "no tracks", so retry
      // briefly instead of collapsing to the one-row fallback.
      const real = (sounds || []).filter((x) => x && x.title);
      if (!real.length && tries < 6) {
        setTimeout(() => expandSet(w, entry, autoplay, tries + 1), 400);
        return;
      }
      queue = real.length
        ? real.map((x, i) => ({
            title: x.title,
            project: entry.project || entry.title,
            cover: (x.artwork_url || '').replace('-large', '-t300x300') || entry.cover,
            role: entry.role || '',
            scIndex: i
          }))
        : [entry];
      current = 0;
      if (albums[activeAlbum]) albums[activeAlbum].count = queue.length;
      paintTrack(queue[0]);
      renderQueue();
      if (autoplay) w.play();
      else setIcon(false);
    });
  }

  function loadSet(entry, autoplay) {
    const frame = document.getElementById('pl-sc');
    if (!frame || !window.SC || !window.SC.Widget) {
      el.project.textContent = 'SoundCloud player unavailable';
      return;
    }

    mode = 'sc';
    scDuration = 0;
    audio.pause();
    paintTrack(entry);
    el.dur.textContent = '0:00';

    // Already a live widget: swapping the resource is enough.
    if (widget) {
      if (loadedSet === entry.widgetUrl) {
        if (autoplay) widget.play();
        return;
      }
      const resource = scResourceOf(entry.widgetUrl);
      if (!resource) {
        el.project.textContent = 'Could not read that SoundCloud link';
        return;
      }
      loadedSet = entry.widgetUrl;
      widget.load(resource, {
        auto_play: !!autoplay,
        visual: false,
        show_artwork: false,
        show_comments: false,
        show_user: false,
        show_teaser: false,
        hide_related: true,
        callback: function () { expandSet(widget, entry, autoplay); }
      });
      return;
    }

    loadedSet = entry.widgetUrl;
    frame.addEventListener('load', function booted() {
      frame.removeEventListener('load', booted);
      widget = window.SC.Widget(frame);
      bindWidget(widget);
      // READY may fire before or after the bind lands, so a timer backs it up
      // rather than the track list silently never appearing.
      let expanded = false;
      const once = () => { if (!expanded) { expanded = true; expandSet(widget, entry, autoplay); } };
      widget.bind(window.SC.Widget.Events.READY, once);
      setTimeout(once, 2500);
    });
    frame.src = entry.widgetUrl + (autoplay ? '&auto_play=true' : '&auto_play=false');
  }

  // The sidebar is a library, not a single album's transport: every album's
  // header is always present, and the one you open expands into its tracks.
  // Only the open album's sounds are known — the widget holds one resource at
  // a time and resolves its track list in the browser — so counts appear as
  // albums are opened rather than all at once.
  const albums = playlist.filter((t) => t.widgetUrl);
  const loose = playlist.filter((t) => !t.widgetUrl && t.src);
  let activeAlbum = -1;   // loaded in the widget
  let openAlbum = -1;     // showing its tracks

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }

  const ROW = 'pl-row flex items-baseline gap-2 px-4 py-2 text-[11.5px] cursor-pointer border-b border-line/60 transition-colors';

  function renderQueue() {
    const has = albums.length > 0 || loose.length > 0;
    el.empty.classList.toggle('hidden', has);
    el.body.classList.toggle('hidden', !has);
    if (!has) {
      el.count.textContent = '';
      return;
    }

    if (albums.length) {
      el.count.textContent = albums.length + (albums.length === 1 ? ' album' : ' albums');
    } else {
      el.count.textContent = loose.length + (loose.length === 1 ? ' track' : ' tracks');
    }

    let html = '';

    albums.forEach((a, ai) => {
      const open = ai === openAlbum;
      const live = ai === activeAlbum;
      html +=
        '<div class="pl-album flex items-baseline gap-2 px-4 py-2 cursor-pointer border-b border-line/60 transition-colors ' +
        (live ? 'text-accent' : 'text-ink/80 hover:text-ink') +
        '" data-album="' + ai + '">' +
        '<span class="font-mono text-[9px] opacity-70 flex-shrink-0">' + (open ? '&#9662;' : '&#9656;') + '</span>' +
        '<span class="truncate flex-1 text-[11px] font-mono uppercase tracking-wider">' + esc(a.title) + '</span>' +
        (a.count ? '<span class="font-mono text-[9px] opacity-50 flex-shrink-0">' + a.count + '</span>' : '') +
        '</div>';

      if (open) {
        // Tracks only exist for the album currently in the widget.
        const rows = live ? queue : [];
        rows.forEach((t, i) => {
          html +=
            '<div class="' + ROW + ' pl-8 ' + (i === current ? 'text-accent' : 'text-muted hover:text-ink') +
            '" data-i="' + i + '">' +
            '<span class="font-mono text-[9px] opacity-60 flex-shrink-0">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<span class="truncate flex-1">' + esc(t.title) + '</span>' +
            '</div>';
        });
        if (!rows.length) {
          html += '<div class="px-4 pl-8 py-2 text-[10.5px] font-mono text-muted/60 border-b border-line/60">loading&hellip;</div>';
        }
      }
    });

    loose.forEach((t, i) => {
      const idx = i;
      html +=
        '<div class="' + ROW + ' pl-loose ' + (activeAlbum === -1 && idx === current ? 'text-accent' : 'text-muted hover:text-ink') +
        '" data-loose="' + idx + '">' +
        '<span class="font-mono text-[9px] opacity-60 flex-shrink-0">' + String(idx + 1).padStart(2, '0') + '</span>' +
        '<span class="truncate flex-1">' + esc(t.title) + '</span>' +
        '</div>';
    });

    el.list.innerHTML = html;

    el.list.querySelectorAll('.pl-album').forEach((row) => {
      row.addEventListener('click', () => openAlbumAt(Number(row.getAttribute('data-album'))));
    });
    el.list.querySelectorAll('[data-i]').forEach((row) => {
      row.addEventListener('click', () => load(Number(row.getAttribute('data-i')), true));
    });
    el.list.querySelectorAll('[data-loose]').forEach((row) => {
      row.addEventListener('click', () => {
        activeAlbum = -1;
        openAlbum = -1;
        queue = loose;
        load(Number(row.getAttribute('data-loose')), true);
      });
    });
  }

  // Opening an album loads it; re-clicking the open one just folds it away, so
  // collapsing the list never interrupts what is playing.
  function openAlbumAt(ai, autoplay) {
    const a = albums[ai];
    if (!a) return;
    if (ai === activeAlbum) {
      openAlbum = openAlbum === ai ? -1 : ai;
      renderQueue();
      return;
    }
    openAlbum = ai;
    activeAlbum = ai;
    renderQueue();
    loadSet(a, autoplay !== false);
  }

  function load(i, autoplay) {
    if (!queue[i]) return;
    current = i;
    const t = queue[i];
    paintTrack(t);
    renderQueue();

    // Inside an already-loaded set, moving track is a skip, not a reload.
    if (mode === 'sc' && typeof t.scIndex === 'number') {
      if (widget) {
        widget.skip(t.scIndex);
        if (!autoplay) widget.pause();
      }
      return;
    }

    mode = 'file';
    scDuration = 0;
    if (widget) widget.pause();
    audio.src = t.src;
    if (autoplay) audio.play().catch(() => {});
  }

  function setIcon(playing) {
    el.iconPlay.classList.toggle('hidden', playing);
    el.iconPause.classList.toggle('hidden', !playing);
  }

  el.toggle.addEventListener('click', () => {
    if (current < 0) {
      revealPlayer();
      if (albums.length) return openAlbumAt(openAlbum >= 0 ? openAlbum : 0, true);
      if (loose.length) { queue = loose; return load(0, true); }
      return;
    }
    if (mode === 'sc') {
      if (widget) widget.isPaused((paused) => (paused ? widget.play() : widget.pause()));
      return;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  el.prev.addEventListener('click', () => { if (queue.length) load(current > 0 ? current - 1 : queue.length - 1, true); });
  el.next.addEventListener('click', () => { if (queue.length) load(current < queue.length - 1 ? current + 1 : 0, true); });

  audio.addEventListener('play', () => { if (mode === 'file') { setIcon(true); revealPlayer(); } });
  audio.addEventListener('pause', () => { if (mode === 'file') setIcon(false); });
  audio.addEventListener('ended', () => {
    if (mode !== 'file') return;
    if (current < queue.length - 1) load(current + 1, true);
    else setIcon(false);
  });
  audio.addEventListener('loadedmetadata', () => { el.dur.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    if (mode === 'file') paint(audio.currentTime, audio.duration);
  });
  audio.addEventListener('error', () => {
    // A private bucket returns 401/403 here, which would otherwise fail
    // silently and look like a broken player.
    if (mode === 'file' && audio.src) el.project.textContent = 'Could not load this file';
  });

  el.seek.addEventListener('click', (e) => {
    const r = el.seek.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (mode === 'sc') {
      if (widget) widget.getDuration((d) => widget.seekTo(frac * (d || 0)));
      return;
    }
    if (!audio.duration) return;
    audio.currentTime = frac * audio.duration;
  });

  // Below md the player is a bar pinned to the bottom, shown only once
  // something is loaded. On desktop it is already sticky and always visible,
  // so there is nothing to scroll to — which is what used to yank the page
  // back to the top after every card tap.
  function revealPlayer() {
    const player = document.getElementById('player');
    if (!player) return;
    player.classList.add('player-live');
    document.body.classList.add('player-live-pad');
  }

  const plHeader = document.getElementById('pl-header');
  if (plHeader) {
    plHeader.addEventListener('click', () => {
      const player = document.getElementById('player');
      if (player && player.classList.contains('player-live')) player.classList.toggle('bar-open');
    });
  }

  // Opening a card opens its album in the sidebar. Re-clicking the card whose
  // album is already playing must not restart it, so that case only resumes.
  function sendToPlayer(card) {
    const ids = (card.getAttribute('data-queue') || '').split(',').filter(Boolean);
    if (!ids.length) return;

    const ai = albums.findIndex((a) => ids.indexOf(String(a.id)) !== -1);
    if (ai !== -1) {
      if (ai === activeAlbum) {
        openAlbum = ai;
        renderQueue();
        if (widget) widget.isPaused((paused) => { if (paused) widget.play(); });
      } else {
        openAlbumAt(ai, true);
      }
      revealPlayer();
      return;
    }

    const picked = loose.filter((t) => ids.indexOf(String(t.id)) !== -1);
    if (!picked.length) return;
    activeAlbum = -1;
    openAlbum = -1;
    queue = picked;
    load(0, true);
    revealPlayer();
  }

  // Arrive with something real in the player rather than an empty frame: the
  // first set is loaded so its actual track list and artwork show up, but
  // auto_play is off, so the page never makes a sound uninvited.
  if (albums.length) {
    paintTrack(albums[0]);
    openAlbumAt(0, false);
  } else if (loose.length) {
    queue = loose;
    paintTrack(loose[0]);
  }

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
      // Opening a card with audio is itself the request to hear it — there is
      // no separate button, so this is the gesture browsers need for autoplay.
      if (card.classList.contains('expanded')) sendToPlayer(card);
    });

    const playBtn = card.querySelector('.card-play');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightbox(card.getAttribute('data-id'));
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

    // The poster deliberately has no click handler: it falls through to the
    // card's own toggle, so clicking anywhere neutral expands. Playback is an
    // explicit button inside the expanded card, and only exists where the
    // source can actually be embedded.
  });
})();
