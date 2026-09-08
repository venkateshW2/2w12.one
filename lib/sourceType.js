// Figures out how a given URL should be played, so the uploader never has
// to pick a type manually — just paste the link.
function classify(url) {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('vimeo.com')) return 'vimeo';
  if (u.includes('soundcloud.com')) return 'soundcloud';
  if (/\.(mp3|wav|ogg|m4a|flac)(\?.*)?$/.test(u)) return 'direct_audio';
  if (/\.(mp4|webm|mov)(\?.*)?$/.test(u)) return 'direct_video';
  return 'link'; // fallback: just show it as an "open link" button
}

// SoundCloud is the one source that can never be fed to an <audio> element:
// the real file sits behind a signed, expiring URL that needs an API client_id.
// So it streams through SoundCloud's own widget iframe, which we then drive
// programmatically with the Widget API. Private tracks and sets work because
// the secret token travels inside the widget URL.
const WIDGET_PARAMS = [
  'visual=false',
  'show_artwork=false',
  'show_comments=false',
  'show_user=false',
  'show_teaser=false',
  'hide_related=true',
  'sharing=false',
  'download=false',
  'buying=false'
].join('&');

// Accepts what SoundCloud's Share > Embed panel actually gives you — the whole
// iframe src — as well as a plain permalink, so nobody has to hand-assemble a
// widget URL in the CMS.
function soundcloudWidgetUrl(url) {
  if (!url) return null;
  let resource = String(url).trim();

  if (resource.includes('w.soundcloud.com/player')) {
    const m = resource.match(/[?&]url=([^&"']+)/);
    if (!m) return null;
    resource = decodeURIComponent(m[1]);
  } else if (!resource.includes('soundcloud.com')) {
    return null;
  }

  return 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(resource) + '&' + WIDGET_PARAMS;
}

function youtubeEmbedUrl(url) {
  let id = null;
  const watch = url.match(/[?&]v=([^&]+)/);
  const short = url.match(/youtu\.be\/([^?&]+)/);
  if (watch) id = watch[1];
  else if (short) id = short[1];
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

function vimeoEmbedUrl(url) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : null;
}

function youtubeId(url) {
  const watch = url.match(/[?&]v=([^&]+)/);
  const short = url.match(/youtu\.be\/([^?&]+)/);
  return watch ? watch[1] : short ? short[1] : null;
}

function vimeoId(url) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

// hqdefault is the one YouTube guarantees exists for every public video
// (maxresdefault often 404s for older or vertical uploads).
function youtubeThumbnail(url) {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

module.exports = { classify, soundcloudWidgetUrl, youtubeEmbedUrl, vimeoEmbedUrl, youtubeId, vimeoId, youtubeThumbnail };
