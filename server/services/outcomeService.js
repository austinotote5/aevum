const db = require('../db');

const HORIZONS = Object.freeze([30, 60, 90]);

const METRICS = Object.freeze([
  {
    key: 'hrv',
    label: 'HRV',
    unit: 'ms',
    column: 'hrv_ms',
    higherIsBetter: true,
  },
  {
    key: 'resting_hr',
    label: 'Resting HR',
    unit: 'bpm',
    column: 'resting_hr_bpm',
    higherIsBetter: false,
  },
  {
    key: 'sleep_duration',
    label: 'Sleep Duration',
    unit: 'min',
    column: 'sleep_duration_min',
    higherIsBetter: true,
  },
  {
    key: 'readiness',
    label: 'Readiness',
    unit: '/100',
    column: 'readiness_score',
    higherIsBetter: true,
  },
  {
    key: 'stress',
    label: 'Stress',
    unit: '/100',
    column: 'stress_score',
    higherIsBetter: false,
  },
]);

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const average = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toChangeSignal = ({ deltaPct, favorable }) => {
  if (!Number.isFinite(deltaPct)) {
    return 'insufficient';
  }

  if (Math.abs(deltaPct) < 3.5) {
    return 'stable';
  }

  if (favorable) {
    return deltaPct > 0 ? 'improving' : 'stable';
  }

  return 'declining';
};

const toMetricOutcome = ({ metric, baselineRows, currentRows }) => {
  const baselineValues = baselineRows
    .map((row) => toNumber(row[metric.column]))
    .filter((value) => Number.isFinite(value));
  const currentValues = currentRows
    .map((row) => toNumber(row[metric.column]))
    .filter((value) => Number.isFinite(value));

  if (baselineValues.length === 0 || currentValues.length === 0) {
    return null;
  }

  const baseline = average(baselineValues);
  const current = average(currentValues);
  if (!Number.isFinite(baseline) || !Number.isFinite(current)) {
    return null;
  }

  const delta = current - baseline;
  const deltaPct = baseline !== 0 ? (delta / Math.abs(baseline)) * 100 : 0;
  const favorable = metric.higherIsBetter ? delta >= 0 : delta <= 0;
  const signal = toChangeSignal({ deltaPct, favorable });
  const normalizedDirection = metric.higherIsBetter ? deltaPct : -deltaPct;
  const score = clamp(Math.round(50 + (normalizedDirection * 1.15)), 0, 100);

  return {
    key: metric.key,
    label: metric.label,
    unit: metric.unit,
    higherIsBetter: metric.higherIsBetter,
    baseline: Number(baseline.toFixed(1)),
    current: Number(current.toFixed(1)),
    delta: Number(delta.toFixed(1)),
    deltaPct: Number(deltaPct.toFixed(1)),
    favorable,
    signal,
    score,
  };
};

const buildWindowSlices = (rows = []) => {
  if (rows.length < 6) {
    return null;
  }

  const windowSize = Math.min(7, Math.floor(rows.length / 2));
  if (windowSize < 3) {
    return null;
  }

  return {
    windowSize,
    baselineRows: rows.slice(0, windowSize),
    currentRows: rows.slice(rows.length - windowSize),
  };
};

const toHorizonOutcome = ({ rows, days }) => {
  const slices = buildWindowSlices(rows);
  if (!slices) {
    return {
      days,
      sampleSize: rows.length,
      baselineWindowSize: 0,
      currentWindowSize: 0,
      sufficientData: false,
      score: null,
      status: 'insufficient',
      summary: 'Not enough biometric history for this horizon yet.',
      metrics: [],
    };
  }

  const metrics = METRICS
    .map((metric) => toMetricOutcome({
      metric,
      baselineRows: slices.baselineRows,
      currentRows: slices.currentRows,
    }))
    .filter(Boolean);

  if (metrics.length === 0) {
    return {
      days,
      sampleSize: rows.length,
      baselineWindowSize: slices.windowSize,
      currentWindowSize: slices.windowSize,
      sufficientData: false,
      score: null,
      status: 'insufficient',
      summary: 'Metrics were missing in this horizon window.',
      metrics: [],
    };
  }

  const scoreRaw = average(metrics.map((metric) => metric.score));
  const score = Number((scoreRaw || 0).toFixed(1));
  const improvingCount = metrics.filter((metric) => metric.signal === 'improving').length;
  const decliningCount = metrics.filter((metric) => metric.signal === 'declining').length;
  const status = score >= 58
    ? 'improving'
    : score <= 44
      ? 'watch'
      : 'stable';

  const summary = status === 'improving'
    ? `${improvingCount} metrics are improving across ${days} days.`
    : status === 'watch'
      ? `${decliningCount} metrics need attention across ${days} days.`
      : `Trajectory is stable with mixed movement across ${days} days.`;

  return {
    days,
    sampleSize: rows.length,
    baselineWindowSize: slices.windowSize,
    currentWindowSize: slices.windowSize,
    sufficientData: true,
    score,
    status,
    summary,
    metrics,
  };
};

const getOutcomeSummary = async (userId) => {
  const maxHorizon = Math.max(...HORIZONS);
  const { rows } = await db.query(`
    SELECT
      recorded_at,
      hrv_ms,
      resting_hr_bpm,
      sleep_duration_min,
      readiness_score,
      stress_score
    FROM biometric_entries
    WHERE user_id = $1
      AND recorded_at >= (NOW() - ($2::text || ' days')::interval)
    ORDER BY recorded_at ASC
  `, [userId, maxHorizon]);

  const now = Date.now();
  const horizons = HORIZONS.map((days) => {
    const lowerBound = now - (days * 24 * 60 * 60 * 1000);
    const scopedRows = rows.filter((row) => {
      const timestamp = new Date(row.recorded_at).getTime();
      return Number.isFinite(timestamp) && timestamp >= lowerBound;
    });

    return toHorizonOutcome({ rows: scopedRows, days });
  });

  const latestRecordedAt = rows.length > 0 ? rows[rows.length - 1].recorded_at : null;
  const availableHorizonScores = horizons
    .map((horizon) => horizon.score)
    .filter((score) => Number.isFinite(score));
  const aggregateScore = availableHorizonScores.length > 0
    ? Number(average(availableHorizonScores).toFixed(1))
    : null;

  return {
    generatedAt: new Date().toISOString(),
    aggregateScore,
    latestRecordedAt,
    horizons,
  };
};

module.exports = {
  getOutcomeSummary,
};
