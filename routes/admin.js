const fs = require('fs');
const multer = require('multer');
const os = require('os');
const { requireAuth } = require('../lib/auth');
const { classify, youtubeThumbnail } = require('../lib/sourceType');
const { uploadToB2, configured: b2Configured } = require('../lib/storage');
const { TAG_ORDER, TAG_LABELS, ROLES } = require('../lib/taxonomy');

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
  app.get('/dashboard', gate, async (req, res) => {
    const allTracks = await db()('tracks').where({ profile_id: req.profile.id }).select('*').orderBy('created_at', 'desc');
    allTracks.forEach(withThumb);
    const tracks = allTracks.filter((t) => !t.parent_track_id);
    tracks.forEach((t) => {
      t.pieces = allTracks.filter((p) => p.parent_track_id === t.id);
    });

    res.render('dashboard', {
      profile: req.profile,
      tracks,
      roles: ROLES,
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

    let coverUrl = null;
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
    res.render('track-edit', { track, roles: ROLES, tagOrder: TAG_ORDER, tagLabels: TAG_LABELS, parentCandidates });
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
    }

    await db()('tracks').where({ id: track.id }).update(update);
    res.redirect('/dashboard');
  });

  app.post('/dashboard/tracks/:id/delete', gate, async (req, res) => {
    await db()('tracks').where({ id: req.params.id, profile_id: req.profile.id }).del();
    res.redirect('/dashboard');
  });
};
