const fs = require('fs');
const multer = require('multer');
const os = require('os');
const { requireAuth } = require('../lib/auth');
const { classify, youtubeThumbnail } = require('../lib/sourceType');
const { uploadToB2, configured: b2Configured } = require('../lib/storage');
const { TAG_ORDER, TAG_LABELS, ROLES, ROLE_SHORT } = require('../lib/taxonomy');

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } });

function withThumb(t) {
  const kind = classify(t.source_url);
  t.thumb = t.cover_image_url || (kind === 'youtube' ? youtubeThumbnail(t.source_url) : null) || '';
  return t;
}

function folderFor(mimetype) {
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('image/')) return 'images';
  return 'files';
}

// Uploads a multer diskStorage temp file to B2 by streaming it (not buffering
// in RAM), then deletes the temp file. Returns the resulting public URL.
async function streamUploadAndCleanup(file) {
  const stream = fs.createReadStream(file.path);
  try {
    const url = await uploadToB2(
      { stream, mimetype: file.mimetype, originalname: file.originalname },
      folderFor(file.mimetype)
    );
    return url;
  } finally {
    fs.unlink(file.path, () => {});
  }
}

module.exports = function (app) {
  const db = () => app.locals.db;
  const gate = requireAuth(db);

  // ---------- Dashboard: this user's own projects ----------
  const SORTS = {
    page: (a, b) =>
      (b.sort_order || 0) - (a.sort_order || 0) ||
      (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
      (b.year || 0) - (a.year || 0) ||
      a.title.localeCompare(b.title),
    recent: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    title: (a, b) => a.title.localeCompare(b.title),
    year: (a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title),
    role: (a, b) => (a.role || '~').localeCompare(b.role || '~') || a.title.localeCompare(b.title)
  };

  app.get('/dashboard', gate, async (req, res) => {
    const allTracks = await db()('tracks').where({ profile_id: req.profile.id }).select('*');
    allTracks.forEach(withThumb);

    const sort = SORTS[req.query.sort] ? req.query.sort : 'recent';
    const tracks = allTracks.filter((t) => !t.parent_track_id).sort(SORTS[sort]);
    tracks.forEach((t) => {
      t.pieces = allTracks.filter((p) => p.parent_track_id === t.id);
      // Everything the list filters/searches on, precomputed into one string so
      // the client-side filter doesn't have to know the row's structure.
      t.badge = t.role || '';
      t.haystack = [t.title, t.role, t.badge, t.tags, t.year, t.description].filter(Boolean).join(' ').toLowerCase();
    });

    const galleryRows = await db()('gallery_items')
      .where((q) => q.where({ profile_id: req.profile.id }).orWhereNull('profile_id'))
      .orderBy('sort_order', 'desc')
      .orderBy('created_at', 'desc');
    const galleryItems = galleryRows.map((g) => ({ ...g, scope: g.profile_id ? 'mine' : 'company' }));

    // Everything the sidebar player can actually stream.
    const audioTracks = allTracks.filter((t) => classify(t.source_url || '') === 'direct_audio');

    res.render('dashboard', {
      profile: req.profile,
      tracks,
      galleryItems,
      audioTracks,
      sort,
      stats: {
        projects: tracks.length,
        pieces: allTracks.length - tracks.length,
        noCover: allTracks.filter((t) => !t.cover_image_url && !t.thumb).length,
        noYear: allTracks.filter((t) => !t.year).length,
        featured: allTracks.filter((t) => t.featured).length,
        solo: allTracks.filter((t) => t.solo_credit).length,
        hidden: allTracks.filter((t) => t.hidden).length
      },
      roles: ROLES,
      roleShort: ROLE_SHORT,
      tagOrder: TAG_ORDER,
      tagLabels: TAG_LABELS,
      b2Ready: b2Configured(),
      error: req.query.error || null
    });
  });

  // ---------- Profile / bio editing ----------
  app.post('/dashboard/profile', gate, upload.single('headshot'), async (req, res) => {
    const { name, tagline, bio_long, education, email, linkedin_url, website_url } = req.body;
    const update = { name, tagline, bio_long, education, email, linkedin_url, website_url };

    // Contact + social surface. Anyone building a portfolio here needs their own.
    ['instagram_url', 'twitter_url', 'substack_url', 'soundcloud_url', 'spotify_url', 'imdb_url', 'phone', 'location'].forEach((f) => {
      if (typeof req.body[f] === 'string') update[f] = req.body[f].trim() || null;
    });

    // A pasted path works without B2; an actual upload overrides it below.
    if (typeof req.body.avatar_url === 'string') {
      update.avatar_url = req.body.avatar_url.trim() || null;
    }

    if (req.file) {
      try {
        update.avatar_url = await streamUploadAndCleanup(req.file);
      } catch (err) {
        return res.redirect('/dashboard?error=' + encodeURIComponent('Headshot upload failed: ' + err.message));
      }
    }

    await db()('profiles').where({ id: req.profile.id }).update(update);
    res.redirect('/dashboard');
  });

  // ---------- Create a track: paste-link OR upload-file ----------
  app.post('/dashboard/tracks', gate, upload.fields([{ name: 'media_file', maxCount: 1 }, { name: 'cover_file', maxCount: 1 }]), async (req, res) => {
    const { title, source_url, description, role, year, collaboration, location, technical, context, parent_track_id } = req.body;
    const tags = Array.isArray(req.body.tags) ? req.body.tags.join(',') : req.body.tags || '';
    const featured = req.body.featured === 'on';
    const soloCredit = req.body.solo_credit === 'on';
    const hidden = req.body.hidden === 'on';

    let finalSourceUrl = source_url || '';
    let type = 'link';
    const mediaFile = req.files && req.files.media_file && req.files.media_file[0];
    if (mediaFile) {
      try {
        finalSourceUrl = await streamUploadAndCleanup(mediaFile);
        type = 'upload';
      } catch (err) {
        return res.redirect('/dashboard?error=' + encodeURIComponent('Upload failed: ' + err.message));
      }
    }

    if (!finalSourceUrl || !title) {
      return res.redirect('/dashboard?error=' + encodeURIComponent('Title and either a link or a file are required.'));
    }

    // An uploaded cover wins over a pasted one; either is optional, and with
    // neither, the public page falls back to the YouTube thumbnail.
    let coverUrl = (req.body.cover_image_url || '').trim() || null;
    const coverFile = req.files && req.files.cover_file && req.files.cover_file[0];
    if (coverFile) {
      try {
        coverUrl = await streamUploadAndCleanup(coverFile);
      } catch (err) {
        return res.redirect('/dashboard?error=' + encodeURIComponent('Cover image upload failed: ' + err.message));
      }
    }

    await db()('tracks').insert({
      profile_id: req.profile.id,
      parent_track_id: parent_track_id ? Number(parent_track_id) : null,
      type,
      source_url: finalSourceUrl,
      title,
      description: description || null,
      cover_image_url: coverUrl,
      role: role || null,
      tags,
      year: year ? Number(year) : null,
      collaboration: collaboration || null,
      location: location || null,
      technical: technical || null,
      context: context || null,
      external_url: (req.body.external_url || '').trim() || null,
      solo_credit: soloCredit,
      credit_note: (req.body.credit_note || '').trim() || null,
      sort_order: Number(req.body.sort_order) || 0,
      hidden,
      featured
    });

    res.redirect('/dashboard');
  });

  app.get('/dashboard/tracks/:id/edit', gate, async (req, res) => {
    const track = await db()('tracks').where({ id: req.params.id, profile_id: req.profile.id }).first();
    if (!track) return res.redirect('/dashboard');
    const parentCandidates = await db()('tracks')
      .where({ profile_id: req.profile.id })
      .whereNull('parent_track_id')
      .whereNot({ id: track.id })
      .select('id', 'title');
    res.render('track-edit', { track, roles: ROLES, roleShort: ROLE_SHORT, tagOrder: TAG_ORDER, tagLabels: TAG_LABELS, parentCandidates });
  });

  app.post('/dashboard/tracks/:id/edit', gate, upload.fields([{ name: 'media_file', maxCount: 1 }, { name: 'cover_file', maxCount: 1 }]), async (req, res) => {
    const track = await db()('tracks').where({ id: req.params.id, profile_id: req.profile.id }).first();
    if (!track) return res.redirect('/dashboard');

    const { title, source_url, description, role, year, collaboration, location, technical, context, parent_track_id } = req.body;
    const tags = Array.isArray(req.body.tags) ? req.body.tags.join(',') : req.body.tags || '';
    const featured = req.body.featured === 'on';
    const update = {
      title,
      description: description || null,
      role: role || null,
      tags,
      year: year ? Number(year) : null,
      collaboration: collaboration || null,
      location: location || null,
      technical: technical || null,
      context: context || null,
      featured,
      external_url: (req.body.external_url || '').trim() || null,
      solo_credit: req.body.solo_credit === 'on',
      credit_note: (req.body.credit_note || '').trim() || null,
      sort_order: Number(req.body.sort_order) || 0,
      hidden: req.body.hidden === 'on',
      parent_track_id: parent_track_id ? Number(parent_track_id) : null
    };

    const mediaFile = req.files && req.files.media_file && req.files.media_file[0];
    if (mediaFile) {
      update.source_url = await streamUploadAndCleanup(mediaFile);
      update.type = 'upload';
    } else if (source_url) {
      update.source_url = source_url;
    }

    const coverFile = req.files && req.files.cover_file && req.files.cover_file[0];
    if (coverFile) {
      update.cover_image_url = await streamUploadAndCleanup(coverFile);
    } else if (typeof req.body.cover_image_url === 'string') {
      // Present but empty means "clear the cover", so this can't be a truthiness
      // check — the imported covers are URLs and have to be removable from here.
      update.cover_image_url = req.body.cover_image_url.trim() || null;
    }

    await db()('tracks').where({ id: track.id }).update(update);
    res.redirect('/dashboard');
  });

  // Planned sections. Skeletons on purpose — the shape of the product is
  // decided here, the features get built later.
  const SOON = {
    files: {
      title: 'Send your files',
      lede: 'Send finished mixes, stems and masters to clients without email attachment limits.',
      points: [
        'Upload once, share a link that expires',
        'Download tracking so you know it arrived',
        'No account needed for whoever receives it'
      ]
    },
    share: {
      title: 'Share audio for feedback',
      lede: 'Private streaming links for work in progress — like Samply. Send a mix, collect timestamped notes.',
      points: [
        'Streaming-only links, no downloadable file',
        'Timestamped comments from clients and collaborators',
        'Versions side by side so notes stay attached to the right take'
      ]
    },
    tools: {
      title: 'Your tools',
      lede: 'The studio tools, available to everyone with a portfolio here.',
      points: [
        'Visualizer, Key Finder and the YouTube reference grabber',
        'Batch audio analysis over a whole library',
        'Saved presets and analysis history per account'
      ]
    }
  };

  Object.entries(SOON).forEach(([slug, section]) => {
    app.get(`/dashboard/${slug}`, gate, (req, res) => {
      res.render('dashboard-soon', { profile: req.profile, active: slug, section });
    });
  });

  // ---------- Gallery: loose images/video from tests and experiments ----------
  app.post('/dashboard/gallery', gate, upload.single('gallery_file'), async (req, res) => {
    let url = (req.body.url || '').trim();
    let kind = req.body.kind === 'video' ? 'video' : 'image';

    if (req.file) {
      try {
        url = await streamUploadAndCleanup(req.file);
        kind = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      } catch (err) {
        return res.redirect('/dashboard?error=' + encodeURIComponent('Gallery upload failed: ' + err.message));
      }
    }

    if (!url) {
      return res.redirect('/dashboard?error=' + encodeURIComponent('Give the gallery item a file or a URL.'));
    }

    // A pasted link can be classified rather than trusting the radio button.
    const detected = classify(url);
    if (detected === 'direct_video') kind = 'video';

    await db()('gallery_items').insert({
      // NULL profile_id = the studio gallery at /gallery; otherwise it belongs
      // to this profile's own gallery at /portfolio/gallery.
      profile_id: req.body.scope === 'company' ? null : req.profile.id,
      url,
      kind,
      caption: (req.body.caption || '').trim() || null,
      sort_order: Number(req.body.sort_order) || 0
    });
    res.redirect('/dashboard#gallery');
  });

  app.post('/dashboard/gallery/:id/delete', gate, async (req, res) => {
    // The studio gallery's rows have no profile_id, so scoping the delete to
    // this profile alone would make them undeletable.
    await db()('gallery_items')
      .where({ id: req.params.id })
      .where((q) => q.where({ profile_id: req.profile.id }).orWhereNull('profile_id'))
      .del();
    res.redirect('/dashboard#gallery');
  });

  // ---------- Audio: the songs/samples that feed the sidebar player ----------
  // Separate from "Add a project" because these are pieces *of* a project and
  // need almost none of that form — just a file/URL, a name and a parent.
  app.post('/dashboard/audio', gate, upload.single('audio_file'), async (req, res) => {
    let url = (req.body.source_url || '').trim();

    if (req.file) {
      try {
        url = await streamUploadAndCleanup(req.file);
      } catch (err) {
        return res.redirect('/dashboard?error=' + encodeURIComponent('Audio upload failed: ' + err.message));
      }
    }

    const title = (req.body.title || '').trim();
    if (!url || !title) {
      return res.redirect('/dashboard?error=' + encodeURIComponent('Audio needs a title and either a file or a URL.'));
    }

    // The sidebar player only picks up tracks classify() calls direct_audio, so
    // say so plainly rather than silently adding something that won't stream.
    if (classify(url) !== 'direct_audio') {
      return res.redirect(
        '/dashboard?error=' +
          encodeURIComponent(
            'That URL is not a direct audio file (needs to end .mp3/.wav/.ogg/.m4a/.flac), so the player cannot stream it. Added nothing.'
          )
      );
    }

    await db()('tracks').insert({
      profile_id: req.profile.id,
      parent_track_id: req.body.parent_track_id ? Number(req.body.parent_track_id) : null,
      type: req.file ? 'upload' : 'link',
      source_url: url,
      title,
      role: (req.body.role || '').trim() || null,
      tags: '',
      description: (req.body.description || '').trim() || null
    });
    res.redirect('/dashboard#audio');
  });

  // Toggled straight from the list — the one edit frequent enough to not be
  // worth a round trip through the full edit form.
  app.post('/dashboard/tracks/:id/featured', gate, async (req, res) => {
    const track = await db()('tracks').where({ id: req.params.id, profile_id: req.profile.id }).first();
    if (track) {
      await db()('tracks').where({ id: track.id }).update({ featured: !track.featured });
    }
    res.redirect('/dashboard?sort=' + encodeURIComponent(req.body.sort || 'recent'));
  });

  app.post('/dashboard/tracks/:id/hidden', gate, async (req, res) => {
    const track = await db()('tracks').where({ id: req.params.id, profile_id: req.profile.id }).first();
    if (track) await db()('tracks').where({ id: track.id }).update({ hidden: !track.hidden });
    res.redirect('/dashboard?sort=' + encodeURIComponent(req.body.sort || 'recent'));
  });

  app.post('/dashboard/tracks/:id/delete', gate, async (req, res) => {
    await db()('tracks').where({ id: req.params.id, profile_id: req.profile.id }).del();
    res.redirect('/dashboard');
  });
};
