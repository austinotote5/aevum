const DAY_MS = 24 * 60 * 60 * 1000;

const METRIC_CONFIG = {
  hrv: {
    key: 'hrv',
    label: 'Heart Rate Variability',
    unit: 'ms',
    color: '#C4973A',
    lowerIsBetter: false,
    fallback: [52, 55, 50, 58, 62, 57, 61, 67],
    read: (entry) => toNumber(entry?.hrvMs),
  },
  sleep: {
    key: 'sleep',
    label: 'Sleep Duration',
    unit: 'hrs',
    color: '#3498DB',
    lowerIsBetter: false,
    fallback: [6.1, 6.7, 7.0, 6.4, 7.3, 6.8, 7.1, 7.4],
    read: (entry) => {
      const mins = toNumber(entry?.sleepDurationMin);
      return mins == null ? null : mins / 60;
    },
  },
  rhr: {
    key: 'rhr',
    label: 'Resting Heart Rate',
    unit: 'bpm',
    color: '#2ECC71',
    lowerIsBetter: true,
    fallback: [61, 60, 59, 58, 57, 56, 55, 54],
    read: (entry) => toNumber(entry?.restingHrBpm),
  },
  readiness: {
    key: 'readiness',
    label: 'Readiness Index',
    unit: '/100',
    color: '#B7770D',
    lowerIsBetter: false,
    fallback: [68, 72, 70, 75, 80, 77, 83, 91],
    read: (entry) => toNumber(entry?.readinessScore),
  },
  stress: {
    key: 'stress',
    label: 'Stress Index',
    unit: '/100',
    color: '#E74C3C',
    lowerIsBetter: true,
    fallback: [42, 38, 33, 36, 29, 27, 24, 22],
    read: (entry) => toNumber(entry?.stressScore),
  },
};

function toNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sortAscByRecordedAt(entries = []) {
  return [...entries]
    .filter((entry) => entry?.recordedAt)
    .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
}

function filterWindow(entries, windowDays) {
  const now = Date.now();
  const cutoff = now - windowDays * DAY_MS;
  return entries.filter((entry) => new Date(entry.recordedAt).getTime() >= cutoff);
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function detectMetricAnomalies(series, { metricKey, label, lowerIsBetter }) {
  const anomalies = [];
  if (series.length < 6) {
    return anomalies;
  }

  for (let index = 5; index < series.length; index += 1) {
    const window = series.slice(Math.max(0, index - 5), index).map((point) => point.value);
    const baseline = window.reduce((sum, value) => sum + value, 0) / window.length;
    if (!baseline) continue;

    const current = series[index].value;
    const deltaPct = (current - baseline) / Math.abs(baseline);
    const absDeltaPct = Math.abs(deltaPct);
    if (absDeltaPct < 0.18) continue;

    const severity = absDeltaPct >= 0.30 ? 'high' : 'medium';
    const worseDirection = lowerIsBetter ? deltaPct > 0 : deltaPct < 0;

    anomalies.push({
      metricKey,
      label,
      index,
      timestamp: series[index].timestamp,
      value: current,
      baseline,
      deltaPct: round(deltaPct * 100, 1),
      severity,
      polarity: worseDirection ? 'risk' : 'positive',
      explanation: worseDirection
        ? `${label} moved ${round(absDeltaPct * 100, 1)}% away from baseline.`
        : `${label} improved ${round(absDeltaPct * 100, 1)}% relative to baseline.`,
    });
  }

  return anomalies;
}

function buildDataset(entries, config) {
  const points = entries
    .map((entry) => {
      const value = config.read(entry);
      if (value == null) return null;
      return {
        timestamp: entry.recordedAt,
        value,
      };
    })
    .filter(Boolean);

  const source = points.length >= 2
    ? points
    : config.fallback.map((value, index) => ({
      timestamp: new Date(Date.now() - (config.fallback.length - index) * DAY_MS).toISOString(),
      value,
    }));

  const values = source.map((point) => point.value);
  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : latest;
  const deltaPct = previous ? ((latest - previous) / Math.abs(previous)) * 100 : 0;
  const improving = config.lowerIsBetter ? deltaPct <= 0 : deltaPct >= 0;

  return {
    key: config.key,
    label: config.label,
    unit: config.unit,
    color: config.color,
    lowerIsBetter: config.lowerIsBetter,
    values: values.map((value) => round(value, 1)),
    latest: round(latest, 1),
    deltaPct: round(deltaPct, 1),
    improving,
    points: source,
    anomalies: detectMetricAnomalies(source, config),
  };
}

function buildInsights(datasets, anomalies, windowDays) {
  const readiness = datasets.readiness;
  const stress = datasets.stress;
  const hrv = datasets.hrv;
  const sleep = datasets.sleep;

  const insights = [];

  if (readiness && stress) {
    const stableLoad = readiness.improving && stress.improving;
    insights.push({
      title: stableLoad ? 'Recovery Window Is Open' : 'Recovery Needs Active Correction',
      body: stableLoad
        ? `Readiness trend is positive while stress trend remains controlled over ${windowDays} days.`
        : `Readiness and stress diverged over ${windowDays} days; reduce load for the next 24 hours.`,
      tone: stableLoad ? 'positive' : 'risk',
    });
  }

  if (hrv && sleep) {
    const aligned = hrv.improving && sleep.improving;
    insights.push({
      title: aligned ? 'Sleep-HRV Coupling Is Strong' : 'Sleep Architecture Is Limiting Recovery',
      body: aligned
        ? `HRV and sleep are rising together. Preserve bedtime consistency this week.`
        : `Sleep trend is not supporting HRV adaptation. Shift bedtime earlier by 20-30 minutes.`,
      tone: aligned ? 'positive' : 'risk',
    });
  }

  if (anomalies.length > 0) {
    const top = anomalies[0];
    insights.push({
      title: top.polarity === 'risk' ? 'Anomaly Requires Intervention' : 'Positive Outlier Detected',
      body: `${top.label} changed ${Math.abs(top.deltaPct).toFixed(1)}% vs short baseline (${windowDays}d window).`,
      tone: top.polarity === 'risk' ? 'risk' : 'positive',
    });
  } else {
    insights.push({
      title: 'No Critical Outliers',
      body: `No high-severity anomalies detected in the last ${windowDays} days.`,
      tone: 'neutral',
    });
  }

  return insights.slice(0, 3);
}

function buildCoachBrief(datasets, anomalies, windowDays) {
  const parts = [`Window ${windowDays}d.`];
  const addMetric = (key, name) => {
    const ds = datasets[key];
    if (!ds) return;
    parts.push(`${name}: ${ds.latest}${ds.unit} (${ds.deltaPct >= 0 ? '+' : ''}${ds.deltaPct}%).`);
  };

  addMetric('hrv', 'HRV');
  addMetric('sleep', 'Sleep');
  addMetric('rhr', 'RHR');
  addMetric('readiness', 'Readiness');
  addMetric('stress', 'Stress');

  if (anomalies.length > 0) {
    const top = anomalies[0];
    parts.push(`Top anomaly: ${top.label} ${top.deltaPct >= 0 ? '+' : ''}${top.deltaPct}% vs baseline.`);
  } else {
    parts.push('No critical anomalies.');
  }

  return parts.join(' ');
}

export function buildTrendIntelligence(entries = [], windowDays = 30) {
  const normalized = sortAscByRecordedAt(entries);
  const windowed = filterWindow(normalized, windowDays);

  const datasets = Object.fromEntries(
    Object.values(METRIC_CONFIG).map((config) => [config.key, buildDataset(windowed, config)])
  );

  const anomalies = Object.values(datasets)
    .flatMap((dataset) => dataset.anomalies)
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, 6);

  const insights = buildInsights(datasets, anomalies, windowDays);
  const coachBrief = buildCoachBrief(datasets, anomalies, windowDays);

  return {
    windowDays,
    pointsInWindow: windowed.length,
    datasets,
    anomalies,
    insights,
    coachBrief,
  };
}
