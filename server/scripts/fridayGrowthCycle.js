const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const db = require('../db');
const { generate28DayProofReport } = require('./export28DayProof');

const ensureCsv = (filePath, headerLine) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${headerLine}\n`, 'utf8');
  }
};

const upsertTrendRow = (report, trendPath) => {
  const date = report?.window?.endDateIso || new Date().toISOString().slice(0, 10);
  const row = [
    date,
    report?.kpis?.cohort?.totalActive ?? 0,
    report?.kpis?.cohort?.totalPaid ?? 0,
    report?.kpis?.cohort?.activationRatePct ?? 0,
    report?.kpis?.cohort?.conversionPct ?? 0,
    report?.kpis?.adherence?.completionRatePct ?? 0,
    report?.kpis?.outcomes?.readiness?.deltaPct ?? 0,
    report?.kpis?.outcomes?.risk?.reductionPct ?? 0,
    report?.kpis?.retention?.retentionPct ?? 0,
    report?.kpis?.monetization?.netExpansionMrr ?? 0,
  ].join(',');

  const raw = fs.readFileSync(trendPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines[0];
  const existingRows = lines.slice(1).filter((line) => !line.startsWith(`${date},`));
  const output = [header, ...existingRows, row].join('\n');
  fs.writeFileSync(trendPath, `${output}\n`, 'utf8');
};

const buildDeckSummaryMarkdown = (report, proofPath, trendPath) => {
  const cohort = report?.kpis?.cohort || {};
  const adherence = report?.kpis?.adherence || {};
  const outcomes = report?.kpis?.outcomes || {};
  const retention = report?.kpis?.retention || {};
  const monetization = report?.kpis?.monetization || {};

  return [
    '# Founder Deck Metrics (Latest 28-Day Window)',
    '',
    `- Generated At: ${report.generatedAt}`,
    `- Window: ${report?.window?.startDateIso} to ${report?.window?.endDateIso}`,
    `- Integrity Mode: ${report?.integrity?.includeSyntheticInBiometricMetrics ? 'includes synthetic biometric data' : 'real-only biometric metrics'}`,
    `- Synthetic Biometric Entries In Window: ${report?.integrity?.syntheticBiometricEntries ?? 0}`,
    '',
    '## Core KPIs',
    `- Active Users: ${cohort.totalActive ?? 0}`,
    `- Paid Users: ${cohort.totalPaid ?? 0}`,
    `- Activation Rate: ${cohort.activationRatePct ?? 0}%`,
    `- Conversion Rate: ${cohort.conversionPct ?? 0}%`,
    `- Adherence Completion: ${adherence.completionRatePct ?? 0}%`,
    `- Readiness Delta: ${outcomes?.readiness?.deltaPct ?? 0}%`,
    `- Risk Reduction: ${outcomes?.risk?.reductionPct ?? 0}%`,
    `- 28-Day Retention: ${retention.retentionPct ?? 0}%`,
    `- Net Expansion MRR: ${monetization.netExpansionMrr ?? 0}`,
    '',
    '## Narrative',
    ...(Array.isArray(report.narrative) ? report.narrative.map((line) => `- ${line}`) : []),
    '',
    '## Sources',
    `- Proof JSON: ${proofPath}`,
    `- Trend CSV: ${trendPath}`,
    '',
  ].join('\n');
};

const run = async () => {
  const { report, outputPath } = await generate28DayProofReport({ includeSynthetic: false });
  const reportsDir = path.resolve(__dirname, '..', '..', 'docs', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const trendPath = path.resolve(reportsDir, 'premium-growth-trend.csv');
  ensureCsv(
    trendPath,
    'date,total_active,total_paid,activation_rate_pct,conversion_pct,adherence_completion_pct,readiness_delta_pct,risk_reduction_pct,retention_28d_pct,net_expansion_mrr'
  );
  upsertTrendRow(report, trendPath);

  const deckPath = path.resolve(reportsDir, 'founder-deck-metrics-latest.md');
  fs.writeFileSync(deckPath, buildDeckSummaryMarkdown(report, outputPath, trendPath), 'utf8');

  console.log(`[growth] proof report: ${outputPath}`);
  console.log(`[growth] trend updated: ${trendPath}`);
  console.log(`[growth] deck summary updated: ${deckPath}`);
};

run()
  .catch((error) => {
    console.error('[growth] friday cycle failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.pool.end();
    } catch (error) {
      console.error('[growth] failed to close DB pool:', error.message);
    }
  });
