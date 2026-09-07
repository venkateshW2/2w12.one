require('dotenv').config();
const express = require('express');
const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);
const path = require('path');
const knexConfig = require('./knexfile');
const knex = require('knex')(knexConfig);

const app = express();
const PORT = process.env.PORT || 3060;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const isProd = process.env.NODE_ENV === 'production';

// Render terminates TLS at its edge; without this, req.protocol and secure
// cookies both misbehave in production.
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new KnexSessionStore({
      knex,
      tablename: 'sessions',
      createtable: false,
      // The store sweeps expired sessions on a timer and does `.catch(cb)` with
      // whatever callback is passed. With none, that's `.catch(undefined)` — an
      // unhandled rejection, which Node exits on. So a single failing sweep
      // query killed the whole site (it did: a bigint/timestamptz mismatch on
      // the first Postgres deploy). Losing session pruning is survivable;
      // losing the site is not.
      onDbCleanupError: (err) => console.error('[sessions] cleanup failed:', err && err.message)
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30, secure: isProd } // 30 days
  })
);

app.locals.db = knex;

// The header menu lists every portfolio, so it needs profiles on each render.
// Tiny table, single query — cheaper than threading it through every route.
app.use(async (req, res, next) => {
  try {
    res.locals.navProfiles = await knex('profiles').select('id', 'name', 'token', 'slug', 'user_id').orderBy('id');
    // The header's Admin link needs to know, on every page, not just admin ones.
    res.locals.currentPath = req.path;
    res.locals.navIsAdmin = false;
    if (req.session && req.session.userId) {
      const u = await knex('users').where({ id: req.session.userId }).first();
      res.locals.navIsAdmin = !!(u && u.is_admin);
    }
  } catch {
    res.locals.navProfiles = []; // never let the menu break a page
    res.locals.navIsAdmin = false;
    res.locals.currentPath = req.path;
  }
  next();
});

// The landing page route must come before the docs/ static mount, or
// express.static answers "/" with the old static index.html instead.
require('./routes/home')(app);

// Static passthrough for the parts of the old static site that don't need a
// backend: the self-contained client-side tools under docs/tools/.
// index files stay enabled so docs/tools/<tool>/index.html resolves; "/" never
// reaches here because routes/home.js above already answered it.
app.use(express.static(path.join(__dirname, 'docs')));

require('./routes/auth')(app);
require('./routes/admin')(app);
require('./routes/portfolio')(app);
require('./routes/gallery')(app);
require('./routes/admin-panel')(app);

app.use((req, res) => {
  res.status(404).render('not-found');
});

// Last line of defence. Anything that escapes a route's try/catch or fires from
// a timer would otherwise exit the process and take every page down with it.
// Logged loudly rather than swallowed silently — but the site stays up.
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err && (err.stack || err.message || err));
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && (err.stack || err.message || err));
});

app.listen(PORT, () => {
  console.log(`2w12.one running on port ${PORT}`);
});
