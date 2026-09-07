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

// Static passthrough for the parts of the old static site that don't need
// a backend: the landing page and the self-contained client-side tools.
app.use(express.static(path.join(__dirname, 'docs')));

app.use(
  session({
    store: new KnexSessionStore({ knex, tablename: 'sessions', createtable: false }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30, secure: isProd } // 30 days
  })
);

app.locals.db = knex;

require('./routes/auth')(app);
require('./routes/admin')(app);
require('./routes/portfolio')(app);

app.use((req, res) => {
  res.status(404).render('not-found');
});

app.listen(PORT, () => {
  console.log(`2w12.one running on port ${PORT}`);
});
