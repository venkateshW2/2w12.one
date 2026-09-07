// Handles are served under an @ prefix (/@venkatesh), so they can't shadow a
// real path and this list is no longer load-bearing for routing. It's kept so
// handles stay sensible — nobody wants /@admin or /@login as a person's card.
const RESERVED = new Set([
  // current routes
  'portfolio', 'gallery', 'work', 'login', 'logout', 'signup', 'dashboard', 'admin', 'p',
  // static mounts
  'js', 'css', 'images', 'tools', 'fonts', 'assets', 'static', 'docs', 'public',
  // plausible future pages, cheaper to reserve now than to migrate later
  'about', 'contact', 'team', 'blog', 'news', 'shop', 'store', 'press', 'jobs',
  'careers', 'privacy', 'terms', 'legal', 'help', 'support', 'faq', 'search',
  'api', 'auth', 'settings', 'account', 'profile', 'profiles', 'user', 'users',
  'me', 'new', 'edit', 'share', 'embed', 'feed', 'rss', 'sitemap', 'robots',
  'favicon', 'health', 'status', 'studio', 'labs', 'projects', 'work-with-us'
]);

function slugify(input) {
  return (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function isReserved(slug) {
  return RESERVED.has(slug);
}

// Why a slug can't be used, or null if it's fine.
function validate(slug) {
  if (!slug) return 'Pick a short name for the link.';
  if (slug.length < 2) return 'Too short — at least 2 characters.';
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return 'Use lowercase letters, numbers and hyphens only.';
  if (isReserved(slug)) return `"${slug}" is reserved — try something else.`;
  return null;
}

// First free variant: venkatesh, venkatesh-2, venkatesh-3 ...
async function uniqueSlug(db, base, ignoreProfileId) {
  const root = slugify(base) || 'profile';
  for (let n = 0; n < 60; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    if (isReserved(candidate)) continue;
    const clash = await db('profiles')
      .where({ slug: candidate })
      .modify((q) => {
        if (ignoreProfileId) q.whereNot({ id: ignoreProfileId });
      })
      .first();
    if (!clash) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

module.exports = { slugify, isReserved, validate, uniqueSlug, RESERVED };
