// One-off: splits data/content.json into the file layout the CMS edits well.
//
// A single JSON file holding 46 projects would mean one enormous form with a
// 46-item list widget. A folder of one file per project gives a real list view
// with search and per-project edit pages — the same shape the old dashboard
// had, which is the point of having a CMS at all.
//
//   data/profile.json          the person
//   data/projects/<slug>.json  one per project
//   data/status.json           the landing page's status lines
//   data/gallery.json          loose images and video
//
// Usage: node scripts/split-content.js
const fs = require('fs');
const path = require('path');
const { slugify } = require('../lib/slug');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'content.json');
const PROJECTS = path.join(ROOT, 'data', 'projects');

const content = JSON.parse(fs.readFileSync(SRC, 'utf8'));

fs.writeFileSync(path.join(ROOT, 'data', 'profile.json'), JSON.stringify(content.profile, null, 2) + '\n');

fs.mkdirSync(PROJECTS, { recursive: true });
let n = 0;
for (const t of content.tracks) {
  const out = {
    title: t.title,
    year: t.year ?? null,
    role: t.role || '',
    // A list, not a comma-separated string — so the CMS can offer checkboxes
    // instead of asking someone to type commas correctly.
    tags: (t.tags || '')
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean),
    cover_image_url: t.cover_image_url || '',
    source_url: t.source_url || '',
    external_url: t.external_url || '',
    description: t.description || '',
    collaboration: t.collaboration || '',
    location: t.location || '',
    technical: t.technical || '',
    context: t.context || '',
    featured: !!t.featured,
    hidden: !!t.hidden,
    solo_credit: !!t.solo_credit,
    credit_note: t.credit_note || '',
    sort_order: t.sort_order || 0,
    parent_title: t.parent_title || ''
  };
  fs.writeFileSync(path.join(PROJECTS, `${slugify(t.title)}.json`), JSON.stringify(out, null, 2) + '\n');
  n++;
}

fs.writeFileSync(path.join(ROOT, 'data', 'status.json'), JSON.stringify({ lines: content.status_lines || [] }, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'data', 'gallery.json'), JSON.stringify({ items: content.gallery_items || [] }, null, 2) + '\n');

console.log(`  data/profile.json`);
console.log(`  data/projects/    ${n} files`);
console.log(`  data/status.json  ${(content.status_lines || []).length} lines`);
console.log(`  data/gallery.json ${(content.gallery_items || []).length} items`);
