const { nanoid } = require('nanoid');
const { requireAdmin, hashPassword } = require('../lib/auth');

// Admin panel + the invite-only signup flow.
//
// There is no open signup. `/signup/:token` only works against an unused invite
// row, so the only way to get an account is for an admin to pre-add the email.
module.exports = function (app) {
  const db = () => app.locals.db;
  const gate = requireAdmin(db);

  // ---------------------------------------------------------------- panel ----
  app.get('/admin', gate, async (req, res) => {
    const [users, invites] = await Promise.all([
      db()('users').select('id', 'email', 'is_admin', 'created_at').orderBy('id'),
      db()('invites').select('*').orderBy('created_at', 'desc')
    ]);

    const profiles = await db()('profiles').select('id', 'user_id', 'name', 'token');
    const counts = await db()('tracks').whereNull('parent_track_id').select('profile_id').count({ c: '*' }).groupBy('profile_id');

    const people = users.map((u) => {
      const profile = profiles.find((p) => p.user_id === u.id);
      const hit = profile && counts.find((c) => c.profile_id === profile.id);
      return {
        ...u,
        name: profile ? profile.name : '(no profile)',
        profileUrl: profile ? (u.id === req.user.id ? '/portfolio' : `/p/${profile.token}`) : null,
        projects: hit ? Number(hit.c) : 0
      };
    });

    res.render('admin', {
      me: req.user,
      people,
      pending: invites.filter((i) => !i.used_at),
      accepted: invites.filter((i) => i.used_at),
      baseUrl: `${req.protocol}://${req.get('host')}`,
      error: req.query.error || null,
      notice: req.query.notice || null,
      loggedIn: true
    });
  });

  app.post('/admin/invites', gate, async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    const name = (req.body.name || '').trim();
    if (!email || !name) {
      return res.redirect('/admin?error=' + encodeURIComponent('An invite needs both a name and an email.'));
    }

    const existingUser = await db()('users').where({ email }).first();
    if (existingUser) {
      return res.redirect('/admin?error=' + encodeURIComponent(`${email} already has an account.`));
    }
    const existingInvite = await db()('invites').where({ email }).first();
    if (existingInvite) {
      return res.redirect(
        '/admin?error=' +
          encodeURIComponent(
            existingInvite.used_at ? `${email} has already used their invite.` : `${email} is already invited — the link is below.`
          )
      );
    }

    await db()('invites').insert({
      email,
      name,
      token: nanoid(24),
      is_admin: req.body.is_admin === 'on',
      invited_by: req.user.id
    });
    res.redirect('/admin?notice=' + encodeURIComponent(`Invited ${name}. Send them the signup link.`));
  });

  app.post('/admin/invites/:id/delete', gate, async (req, res) => {
    // Revoking an accepted invite would not remove the account, so only pending
    // ones can be withdrawn.
    await db()('invites').where({ id: req.params.id }).whereNull('used_at').del();
    res.redirect('/admin?notice=' + encodeURIComponent('Invite revoked.'));
  });

  app.post('/admin/invites/:id/reissue', gate, async (req, res) => {
    await db()('invites').where({ id: req.params.id }).whereNull('used_at').update({ token: nanoid(24) });
    res.redirect('/admin?notice=' + encodeURIComponent('New link generated — the old one no longer works.'));
  });

  // Promote/demote, with a guard so the last admin can't lock everyone out.
  app.post('/admin/users/:id/admin', gate, async (req, res) => {
    const target = await db()('users').where({ id: req.params.id }).first();
    if (!target) return res.redirect('/admin');

    if (target.is_admin) {
      const admins = await db()('users').where({ is_admin: true }).count({ c: '*' }).first();
      if (Number(admins.c) <= 1) {
        return res.redirect('/admin?error=' + encodeURIComponent('That is the only admin — promote someone else first.'));
      }
    }

    await db()('users').where({ id: target.id }).update({ is_admin: !target.is_admin });
    res.redirect('/admin?notice=' + encodeURIComponent(`${target.email} is ${target.is_admin ? 'no longer' : 'now'} an admin.`));
  });

  // --------------------------------------------------------------- signup ----
  async function inviteFor(token) {
    return db()('invites').where({ token }).whereNull('used_at').first();
  }

  app.get('/signup/:token', async (req, res) => {
    const invite = await inviteFor(req.params.token);
    if (!invite) return res.status(404).render('not-found');
    res.render('signup', { invite, error: null, loggedIn: false });
  });

  app.post('/signup/:token', async (req, res) => {
    const invite = await inviteFor(req.params.token);
    if (!invite) return res.status(404).render('not-found');

    const password = req.body.password || '';
    const render = (error) => res.render('signup', { invite, error, loggedIn: false });

    if (password.length < 8) return render('Use at least 8 characters.');
    if (password !== req.body.password_confirm) return render('Those passwords do not match.');

    // Between rendering the form and submitting it, the email could have been
    // claimed another way.
    if (await db()('users').where({ email: invite.email }).first()) {
      return render('An account with this email already exists — try logging in.');
    }

    const [ret] = await db()('users')
      .insert({ email: invite.email, password_hash: hashPassword(password), is_admin: !!invite.is_admin })
      .returning('id');
    const userId = typeof ret === 'object' ? ret.id : ret;

    await db()('profiles').insert({
      user_id: userId,
      name: (req.body.name || invite.name).trim() || invite.name,
      token: nanoid(16)
    });

    await db()('invites').where({ id: invite.id }).update({ used_at: new Date().toISOString() });

    req.session.userId = userId;
    res.redirect('/dashboard');
  });
};
