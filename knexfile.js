require('dotenv').config();

const usePostgres = !!process.env.DATABASE_URL;

module.exports = {
  client: usePostgres ? 'pg' : 'better-sqlite3',
  connection: usePostgres
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { filename: process.env.SQLITE_PATH || './data/2w12.sqlite3' },
  useNullAsDefault: !usePostgres,
  pool: usePostgres
    ? {}
    : {
        afterCreate(conn, done) {
          conn.pragma('foreign_keys = ON');
          done(null, conn);
        }
      },
  migrations: {
    directory: './migrations'
  }
};
