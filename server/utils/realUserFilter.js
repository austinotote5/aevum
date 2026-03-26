const DEFAULT_EXCLUDED_DOMAINS = [
  'aevum.dev',
  'example.com',
  'test.local',
  'localhost',
];

const sanitizeDomain = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9.-]/g, '');

const getExcludedEmailDomains = () => {
  const configured = String(process.env.METRICS_EXCLUDED_EMAIL_DOMAINS || '')
    .split(',')
    .map(sanitizeDomain)
    .filter(Boolean);

  const fallback = DEFAULT_EXCLUDED_DOMAINS
    .map(sanitizeDomain)
    .filter(Boolean);

  return Array.from(new Set(configured.length ? configured : fallback));
};

const buildRealUserEmailFilterSql = (emailColumn = 'email') => {
  const domains = getExcludedEmailDomains();
  if (!domains.length) {
    return 'TRUE';
  }
  const quotedDomains = domains
    .map((domain) => `'${domain.replace(/'/g, "''")}'`)
    .join(', ');

  return `LOWER(COALESCE(split_part(${emailColumn}, '@', 2), '')) NOT IN (${quotedDomains})`;
};

const isRealUserEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized.includes('@')) {
    return false;
  }
  const domain = sanitizeDomain(normalized.split('@')[1] || '');
  if (!domain) {
    return false;
  }
  const excluded = getExcludedEmailDomains();
  return !excluded.includes(domain);
};

module.exports = {
  DEFAULT_EXCLUDED_DOMAINS,
  getExcludedEmailDomains,
  buildRealUserEmailFilterSql,
  isRealUserEmail,
};
