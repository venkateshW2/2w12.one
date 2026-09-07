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

module.exports = { classify, youtubeEmbedUrl, vimeoEmbedUrl, youtubeId, vimeoId, youtubeThumbnail };
