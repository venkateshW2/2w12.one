const { classify, youtubeId, vimeoId, youtubeThumbnail, youtubeEmbedUrl, vimeoEmbedUrl } = require('../lib/sourceType');
const { TAG_ORDER, TAG_LABELS, ROLE_SHORT } = require('../lib/taxonomy');

module.exports = function (app) {
  const db = () => app.locals.db;

  function enrich(t) {
    const kind = classify(t.source_url);
    return {
      id: t.id,
      title: t.title,
      description: t.description || '',
      role: t.role || '',
      roleShort: ROLE_SHORT[t.role] || t.role || '',
      year: t.year,
      collaboration: t.collaboration,
      location: t.location,
      featured: !!t.featured,
      cover: t.cover_image_url || (kind === 'youtube' ? youtubeThumbnail(t.source_url) : null) || '',
      kind,
      src: t.source_url,
      embedUrl: kind === 'youtube' ? youtubeEmbedUrl(t.source_url) : kind === 'vimeo' ? vimeoEmbedUrl(t.source_url) : null,
      youtubeId: kind === 'youtube' ? youtubeId(t.source_url) : null,
      vimeoId: kind === 'vimeo' ? vimeoId(t.source_url) : null
    };
  }

  async function renderProfile(req, res, profile) {
    const allTracks = await db()('tracks').where({ profile_id: profile.id }).select('*');
    const pieces = allTracks.filter((t) => t.parent_track_id);
    const topLevel = allTracks.filter((t) => !t.parent_track_id);

    const items = topLevel.map((t) => {
      const item = enrich(t);
      item.pieces = pieces.filter((p) => p.parent_track_id === t.id).map(enrich);
      item.isAlbum = item.pieces.length > 0;
      return item;
    });

    const byTag = {};
    items.forEach((item) => {
      const raw = allTracks.find((t) => t.id === item.id).tags || '';
      const tags = raw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      (tags.length ? tags : ['MORE']).forEach((tag) => {
        (byTag[tag] = byTag[tag] || []).push(item);
      });
    });

    const sections = [];
    TAG_ORDER.forEach((tag) => {
      if (byTag[tag]) sections.push({ tag, label: TAG_LABELS[tag] || tag, items: byTag[tag] });
    });
    Object.keys(byTag)
      .filter((tag) => !TAG_ORDER.includes(tag))
      .forEach((tag) => sections.push({ tag, label: tag.charAt(0) + tag.slice(1).toLowerCase(), items: byTag[tag] }));

    const flatLookup = {};
    const addToLookup = (it) => {
      flatLookup[it.id] = {
        kind: it.kind,
        src: it.src,
        embedUrl: it.embedUrl,
        title: it.title,
        cover: it.cover,
        isAlbum: !!it.isAlbum,
        pieceIds: (it.pieces || []).map((p) => p.id)
      };
      (it.pieces || []).forEach(addToLookup);
    };
    items.forEach(addToLookup);

    res.render('portfolio', {
      profile,
      sections,
      itemsJson: JSON.stringify(flatLookup),
      loggedIn: !!(req.session && req.session.userId)
    });
  }

  // Primary public profile — single-tenant for Phase 1: whichever profile
  // has a user_id (a real logged-in owner) is the site's main profile.
  app.get('/portfolio', async (req, res) => {
    const profile = await db()('profiles').whereNotNull('user_id').first();
    if (!profile) return res.status(404).render('not-found');
    renderProfile(req, res, profile);
  });

  // Token-based profile view — kept for forward-compat with Phase 2 and the
  // legacy collaborator-add-link flow.
  app.get('/p/:token', async (req, res) => {
    const profile = await db()('profiles').where({ token: req.params.token }).first();
    if (!profile) return res.status(404).render('not-found');
    renderProfile(req, res, profile);
  });
};
