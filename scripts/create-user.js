// One-off CLI to create the first (and, for Phase 1, only) user account and
// link it to a profile. No public signup UI exists yet — this is it.
//
// Usage: node scripts/create-user.js "you@example.com" "your-password" "Your Name"
require('dotenv').config();
const { nanoid } = require('nanoid');
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);
const { hashPassword } = require('../lib/auth');

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password || !name) {
    console.error('Usage: node scripts/create-user.js "you@example.com" "password" "Your Name"');
    process.exit(1);
  }

  const existing = await knex('users').where({ email: email.toLowerCase().trim() }).first();
  if (existing) {
    console.error(`A user with email ${email} already exists (id ${existing.id}).`);
    process.exit(1);
  }

  const [userId] = await knex('users')
    .insert({ email: email.toLowerCase().trim(), password_hash: hashPassword(password) })
    .returning('id');
  const id = typeof userId === 'object' ? userId.id : userId;

  await knex('profiles').insert({
    user_id: id,
    name,
    token: nanoid(16)
  });

  console.log(`Created user ${email} (id ${id}) with a linked profile. You can log in at /login now.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
