(function () {
  const items = window.ITEMS || {};
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
    if (item.kind === 'direct_video') {
      return `<video src="${item.src}" controls autoplay></video>`;
    }
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
      window.open(item.src, '_blank', 'noopener');
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
      lbSide.classList.add('block');
      lbTitle.textContent = item.title;
      lbPieces.innerHTML = item.pieceIds
        .map((pid) => `<div class="lb-piece ${PIECE_BASE}" data-id="${pid}">${(items[pid] || {}).title || ''}</div>`)
        .join('');
      lbPieces.querySelectorAll('.lb-piece').forEach((el) => {
        el.addEventListener('click', () => playInMain(el.getAttribute('data-id')));
      });
      const firstPlayable = item.pieceIds.find((pid) => embedHtml(items[pid] || {}));
      if (firstPlayable) {
        playInMain(firstPlayable);
      } else {
        lbVideo.innerHTML = '<div class="text-muted text-xs flex items-center justify-center h-full">Select a track to open it</div>';
      }
    } else {
      lbSide.classList.add('hidden');
      lbSide.classList.remove('block');
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

  document.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      // Anything that has its own job — a link, the play button, a track row —
      // must not also toggle the card. Matches the old site's behaviour.
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

    // A track row inside an expanded album opens the player on that piece.
    card.querySelectorAll('.piece-play').forEach((row) => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = row.getAttribute('data-play');
        if (!items[id]) return;
        openLightbox(card.getAttribute('data-id'));
        playInMain(id);
      });
    });

    // Clicking the poster itself plays, since that's where the play overlay is.
    const poster = card.querySelector('.card-img');
    if (poster) {
      poster.addEventListener('click', (e) => {
        const item = items[card.getAttribute('data-id')];
        if (!item || !item.src) return; // details-only project: fall through to expand
        e.stopPropagation();
        openLightbox(card.getAttribute('data-id'));
      });
    }
  });
})();
