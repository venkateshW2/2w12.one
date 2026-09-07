// Single source of truth for project categories, shared by the admin form
// and the public profile page. Matches the taxonomy already established in
// the old static site's data.js (CATEGORY_MAPPING) plus the roles set up
// this session in the ReelCrafter tagging pass.

const TAG_ORDER = [
  'FILM',
  'SERIES',
  'TVC',
  'DIGITAL ADVT',
  'SHORT FILM',
  'DOCUMENTARY',
  'RECORDING',
  'GALLERY',
  'SOFTWARE',
  'RESEARCH',
  'LABS'
];

const TAG_LABELS = {
  FILM: 'Film',
  SERIES: 'Series',
  TVC: 'TVC',
  'DIGITAL ADVT': 'Digital',
  'SHORT FILM': 'Short Film',
  DOCUMENTARY: 'Documentary',
  RECORDING: 'Recording & Tracking',
  GALLERY: 'Installations',
  SOFTWARE: 'Software',
  RESEARCH: 'Research & Development',
  LABS: 'Labs'
};

// The canonical list offered in the CMS dropdown. These are the badge labels
// themselves — what actually gets stamped on a card.
const ROLES = [
  'Sound Design + Mix',
  'Score + Stem Mix',
  'Stem Mix + Supervision',
  'Music Production + Management',
  'Developed'
];

// The `role` column holds whatever the imported data said, which came from two
// different sources with nine different spellings. This collapses all of them
// onto the five badge labels above, so the public page stays consistent without
// having to rewrite the stored values.
const ROLE_SHORT = {
  // canonical values pass straight through
  'Sound Design + Mix': 'Sound Design + Mix',
  'Score + Stem Mix': 'Score + Stem Mix',
  'Stem Mix + Supervision': 'Stem Mix + Supervision',
  'Music Production + Management': 'Music Production + Management',
  Developed: 'Developed',

  // imported spellings, mapped onto the same five
  'Sound Design': 'Sound Design + Mix',
  'Sound Designer': 'Sound Design + Mix',
  'Film Mix': 'Sound Design + Mix',
  'Sound Designer / Music Producer': 'Sound Design + Mix',
  'Score Producer / Music Supervisor': 'Stem Mix + Supervision',
  'Music Production': 'Music Production + Management',
  'Mix & Recording': 'Score + Stem Mix',
  'Recording/MusicMix': 'Score + Stem Mix',
  'Recording & Tracking': 'Score + Stem Mix',
  'Concept / Development': 'Developed',
  Research: 'Developed'
};

module.exports = { TAG_ORDER, TAG_LABELS, ROLES, ROLE_SHORT };
