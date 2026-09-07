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
      technical: t.technical,
      context: t.context,
      externalUrl: t.external_url,
      sortOrder: t.sort_order || 0,
      soloCredit: !!t.solo_credit,
      creditNote: t.credit_note,
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

    const tagsOf = (t) =>
      (t.tags || '')
        .split(',')
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);

    // One card per project, tagged with every category it belongs to. The page
    // used to render a project once per section, which duplicated anything
    // multi-tagged; now the category tabs filter a single flat grid instead.
    const items = topLevel
      .map((t) => {
        const item = enrich(t);
        item.tags = tagsOf(t).length ? tagsOf(t) : ['MORE'];
        item.pieces = pieces.filter((p) => p.parent_track_id === t.id).map(enrich);
        item.isAlbum = item.pieces.length > 0;
        // Only real audio can go in the sidebar player — a YouTube link can't.
        item.audioPieces = item.pieces.filter((p) => p.kind === 'direct_audio');
        if (item.kind === 'direct_audio') item.audioPieces = [item, ...item.audioPieces];
        return item;
      })
      // Page order: explicitly pinned cards first, then featured work, then
      // newest. Filtering only hides cards, so this ordering holds inside every
      // category tab too, not just "All".
      .sort(
        (a, b) =>
          (b.sortOrder || 0) - (a.sortOrder || 0) ||
          (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
          (b.year || 0) - (a.year || 0) ||
          a.title.localeCompare(b.title)
      );

    // Tabs, in taxonomy order, with counts — only categories that have work.
    const counts = {};
    items.forEach((it) => it.tags.forEach((tag) => (counts[tag] = (counts[tag] || 0) + 1)));
    const categories = TAG_ORDER.filter((tag) => counts[tag]).map((tag) => ({
      tag,
      label: TAG_LABELS[tag] || tag,
      count: counts[tag]
    }));
    Object.keys(counts)
      .filter((tag) => !TAG_ORDER.includes(tag))
      .forEach((tag) => categories.push({ tag, label: tag.charAt(0) + tag.slice(1).toLowerCase(), count: counts[tag] }));

    // Flat playlist for the sidebar player.
    const playlist = [];
    items.forEach((it) => {
      it.audioPieces.forEach((a) => {
        playlist.push({ id: a.id, title: a.title, src: a.src, cover: it.cover, project: it.title, role: a.roleShort || '' });
      });
    });

    const flatLookup = {};
    const addToLookup = (it) => {
      flatLookup[it.id] = {
        kind: it.kind,
        src: it.src,
        embedUrl: it.embedUrl,
        title: it.title,
        cover: it.cover,
        isAlbum: !!it.isAlbum,
        playable: !!it.src,
        pieceIds: (it.pieces || []).map((p) => p.id)
      };
      (it.pieces || []).forEach(addToLookup);
    };
    items.forEach(addToLookup);

    res.render('portfolio', {
      profile,
      items,
      categories,
      playlistJson: JSON.stringify(playlist),
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
