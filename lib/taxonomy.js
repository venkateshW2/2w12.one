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

const ROLES = [
  'Music Production',
  'Mix & Recording',
  'Score Producer / Music Supervisor',
  'Sound Design',
  'Film Mix',
  'Recording & Tracking',
  'Concept / Development',
  'Research'
];

// The role column holds a longer descriptive label; this is what actually
// gets stamped on each card so a client can tell sound design from score at a glance.
const ROLE_SHORT = {
  'Sound Design': 'Sound Design',
  'Score Producer / Music Supervisor': 'Score',
  'Music Production': 'Music Production',
  'Mix & Recording': 'Mix & Recording',
  'Film Mix': 'Film Mix',
  'Recording & Tracking': 'Recording',
  'Concept / Development': 'Development',
  Research: 'Research'
};

module.exports = { TAG_ORDER, TAG_LABELS, ROLES, ROLE_SHORT };
