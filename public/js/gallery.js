(function () {
  const items = window.GALLERY || [];
  if (!items.length) return;

  const view = document.getElementById('gal-view');
  const stage = document.getElementById('gal-stage');
  const caption = document.getElementById('gal-caption');
  let i = 0;

  function show(n) {
    i = (n + items.length) % items.length;
    const it = items[i];
    stage.innerHTML =
      it.kind === 'video'
        ? `<video src="${it.url}" class="max-w-full max-h-[88vh]" controls autoplay loop></video>`
        : `<img src="${it.url}" alt="" class="max-w-full max-h-[88vh] object-contain">`;
    caption.textContent = it.caption || '';
  }

  function open(n) {
    show(n);
    view.classList.remove('hidden');
    view.classList.add('flex');
  }

  function close() {
    stage.innerHTML = ''; // stops playback rather than leaving audio running
    view.classList.add('hidden');
    view.classList.remove('flex');
  }

  document.querySelectorAll('.gal-item').forEach((fig, n) => {
    fig.addEventListener('click', () => open(n));
    // Hover-preview muted video, the way a photo library does.
    const v = fig.querySelector('video');
    if (v) {
      fig.addEventListener('mouseenter', () => v.play().catch(() => {}));
      fig.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
    }
  });

  document.getElementById('gal-close').addEventListener('click', close);
  document.getElementById('gal-prev').addEventListener('click', (e) => { e.stopPropagation(); show(i - 1); });
  document.getElementById('gal-next').addEventListener('click', (e) => { e.stopPropagation(); show(i + 1); });
  view.addEventListener('click', (e) => { if (e.target === view) close(); });
  document.addEventListener('keydown', (e) => {
    if (view.classList.contains('hidden')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(i - 1);
    if (e.key === 'ArrowRight') show(i + 1);
  });
})();
