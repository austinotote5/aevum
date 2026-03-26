const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 12000;

const events = [];

const CRITICAL_ROUTE_PATTERNS = [
  /^\/health$/,
  /^\/health\/ready$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/register$/,
  /^\/api\/biometrics\/latest$/,
  /^\/api\/protocols\/today$/,
  /^\/api\/platform\/summary$/,
  /^\/api\/compliance\/consent$/,
  /^\/api\/ops\/status$/,
];

const round = (value, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round(Number(value || 0) * factor) / factor;
};

const normalizePath = (path) => String(path || '')
  .split('?')[0]
  .trim()
  .toLowerCase();

const isCriticalPath = (path) => {
  const normalized = normalizePath(path);
  return CRITICAL_ROUTE_PATTERNS.some((pattern) => pattern.test(normalized));
};

const prune = (now = Date.now()) => {
  const cutoff = now - WINDOW_MS;
  while (events.length && events[0].at < cutoff) {
    events.shift();
  }
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
};

const recordHttpEvent = ({ method, path, statusCode, durationMs }) => {
  const now = Date.now();
  prune(now);
  events.push({
    at: now,
    method: String(method || 'GET').toUpperCase(),
    path: normalizePath(path),
    statusCode: Number(statusCode || 0),
    durationMs: Number(durationMs || 0),
  });
  if (events.length > MAX_EVENTS) {
    events.shift();
  }
};

const percentile = (values, p = 0.95) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
};

const getHttpMetricsSnapshot = () => {
  const now = Date.now();
  prune(now);

  const cutoff = now - WINDOW_MS;
  const windowed = events.filter((event) => event.at >= cutoff);
  const critical = windowed.filter((event) => isCriticalPath(event.path));
  const criticalFailures = critical.filter((event) => event.statusCode >= 500);

  const totalRequests24h = windowed.length;
  const failedRequests24h = windowed.filter((event) => event.statusCode >= 500).length;
  const criticalRequests24h = critical.length;
  const criticalFailures24h = criticalFailures.length;

  const criticalErrorRatePct = criticalRequests24h > 0
    ? round((criticalFailures24h / criticalRequests24h) * 100, 3)
    : 0;
  const criticalAvailabilityPct = criticalRequests24h > 0
    ? round(((criticalRequests24h - criticalFailures24h) / criticalRequests24h) * 100, 3)
    : 100;
  const criticalLatencyP95Ms = percentile(
    critical
      .map((event) => Number(event.durationMs))
      .filter((value) => Number.isFinite(value) && value >= 0),
    0.95
  );

  return {
    generatedAt: new Date(now).toISOString(),
    windowHours: 24,
    totalRequests24h,
    failedRequests24h,
    criticalRequests24h,
    criticalFailures24h,
    criticalErrorRatePct,
    criticalAvailabilityPct,
    criticalLatencyP95Ms: criticalLatencyP95Ms === null ? null : round(criticalLatencyP95Ms, 1),
  };
};

module.exports = {
  recordHttpEvent,
  getHttpMetricsSnapshot,
};
