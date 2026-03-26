const os = require('os');
const db = require('../db');
const { validateCriticalEnv } = require('../utils/env');
const { getHttpMetricsSnapshot } = require('./runtimeMetrics');

const bytesToMb = (value) => Number((Number(value || 0) / (1024 * 1024)).toFixed(1));

const getDeploymentObservabilityStatus = async () => {
  const startedAtIso = new Date(Date.now() - (process.uptime() * 1000)).toISOString();
  const memory = process.memoryUsage();

  let envValid = true;
  let envError = null;
  try {
    validateCriticalEnv();
  } catch (error) {
    envValid = false;
    envError = error.message;
  }

  let dbConnected = true;
  let dbLatencyMs = null;
  let dbError = null;
  const dbStart = Date.now();
  try {
    await db.query('SELECT 1 AS ok');
    dbLatencyMs = Date.now() - dbStart;
  } catch (error) {
    dbConnected = false;
    dbError = error.message;
  }

  const [
    recentRequests,
    recentFailures,
    pendingDeletionRequests,
    importFailures,
  ] = await Promise.all([
    db.query(`
      SELECT COUNT(*)::int AS total
      FROM audit_log
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `).catch(() => ({ rows: [{ total: 0 }] })),
    db.query(`
      SELECT COUNT(*)::int AS total
      FROM wearable_import_events
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND status = 'failed'
    `).catch(() => ({ rows: [{ total: 0 }] })),
    db.query(`
      SELECT COUNT(*)::int AS total
      FROM data_deletion_requests
      WHERE status IN ('pending', 'processing')
    `).catch(() => ({ rows: [{ total: 0 }] })),
    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM wearable_import_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `).catch(() => ({ rows: [{ total: 0, failed: 0 }] })),
  ]);

  const importsTotal = Number(importFailures.rows[0]?.total || 0);
  const importsFailed = Number(importFailures.rows[0]?.failed || 0);
  const importFailureRatePct = importsTotal > 0
    ? Number(((importsFailed / importsTotal) * 100).toFixed(2))
    : 0;
  const httpMetrics = getHttpMetricsSnapshot();
  const criticalErrorRatePct = Number(httpMetrics.criticalErrorRatePct || 0);
  const criticalAvailabilityPct = Number(httpMetrics.criticalAvailabilityPct || 100);

  const signals = {
    envValid,
    dbConnected,
    importFailureRatePct,
    pendingDeletionRequests: Number(pendingDeletionRequests.rows[0]?.total || 0),
    criticalErrorRatePct,
    criticalAvailabilityPct,
  };

  const systemStatus = !envValid || !dbConnected
    ? 'degraded'
    : (importFailureRatePct > 8 || criticalErrorRatePct > 1)
      ? 'warning'
      : 'operational';

  return {
    generatedAt: new Date().toISOString(),
    status: systemStatus,
    runtime: {
      nodeVersion: process.version,
      pid: process.pid,
      uptimeSeconds: Number(process.uptime().toFixed(1)),
      startedAt: startedAtIso,
      platform: process.platform,
      host: os.hostname(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg().map((value) => Number(value.toFixed(2))),
    },
    memory: {
      rssMb: bytesToMb(memory.rss),
      heapTotalMb: bytesToMb(memory.heapTotal),
      heapUsedMb: bytesToMb(memory.heapUsed),
      externalMb: bytesToMb(memory.external),
      freeSystemMb: bytesToMb(os.freemem()),
      totalSystemMb: bytesToMb(os.totalmem()),
    },
    dependencies: {
      env: {
        ok: envValid,
        error: envError,
      },
      database: {
        ok: dbConnected,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
    },
    telemetry: {
      auditEvents24h: Number(recentRequests.rows[0]?.total || 0),
      wearableImportFailures24h: Number(recentFailures.rows[0]?.total || 0),
      wearableImportFailureRate7d: importFailureRatePct,
      pendingDeletionRequests: Number(pendingDeletionRequests.rows[0]?.total || 0),
      http: httpMetrics,
    },
    deploymentReadiness: {
      clientUrlConfigured: Boolean(String(process.env.CLIENT_URL || '').trim()),
      jwtConfigured: Boolean(String(process.env.JWT_SECRET || '').trim()),
      dbPasswordConfigured: Boolean(String(process.env.DB_PASSWORD || '').trim()),
      productionSafe: envValid && dbConnected && criticalErrorRatePct <= 1,
      slo24h: {
        target: {
          criticalErrorRatePctLt: 1,
          criticalAvailabilityPctGte: 99,
        },
        actual: {
          criticalErrorRatePct,
          criticalAvailabilityPct,
        },
        passing: criticalErrorRatePct <= 1 && criticalAvailabilityPct >= 99,
      },
    },
    runbook: [
      '1) Confirm /health and /api/ops/status both return 200 before deploy.',
      '2) Verify DB backup snapshot exists before running schema updates.',
      '3) If status=degraded, resolve env/database errors before releasing.',
      '4) Keep wearable import failure rate under 8% over rolling 7 days.',
      '5) Keep critical-route 5xx under 1% over rolling 24 hours.',
    ],
    signals,
  };
};

module.exports = {
  getDeploymentObservabilityStatus,
};
