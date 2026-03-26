function toNumber(value, fallback = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toSigned(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.0";
  return value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function deriveTier(riskScore) {
  if (riskScore >= 70) return "Critical Reset";
  if (riskScore >= 45) return "Stabilize";
  return "Performance";
}

function deriveSummary(tier, riskScore, readinessScore) {
  if (tier === "Critical Reset") {
    return `Risk is elevated (${riskScore}/100). Prioritize recovery load today.`;
  }
  if (tier === "Stabilize") {
    return `Moderate risk (${riskScore}/100) with readiness at ${readinessScore}/100. Use controlled training and strict sleep timing.`;
  }
  return `Low risk (${riskScore}/100) and readiness at ${readinessScore}/100. Execute performance-focused protocol with recovery guardrails.`;
}

function buildProtocol(tier, readinessScore, stressScore, sleepHours) {
  const baseProtocol = [
    {
      id: "sleep-anchor",
      window: "Evening",
      title: "Circadian Anchor",
      priority: "high",
      objective: "Preserve endocrine recovery quality.",
      prescription: "Fix bedtime within a 30-minute window and remove screens 60 minutes pre-sleep.",
    },
    {
      id: "hydration",
      window: "Morning",
      title: "Electrolyte Hydration",
      priority: "medium",
      objective: "Improve autonomic stability and cognitive output.",
      prescription: "Drink 600-800ml water in first 90 minutes with sodium and potassium support.",
    },
  ];

  if (tier === "Critical Reset") {
    return [
      {
        id: "load-reduction",
        window: "Morning",
        title: "Load Reduction",
        priority: "critical",
        objective: "Lower sympathetic burden immediately.",
        prescription: "Avoid high-intensity training. Keep movement low intensity (zone 1-2) for 30-40 minutes.",
      },
      {
        id: "stress-downshift",
        window: "Midday",
        title: "Stress Downshift",
        priority: "high",
        objective: "Reduce stress biomarkers before evening.",
        prescription: "Run 2 cycles of breath work (6 breaths/min, 5 minutes each) and one 15-minute walk outdoors.",
      },
      {
        id: "sleep-extension",
        window: "Evening",
        title: "Sleep Extension",
        priority: "critical",
        objective: "Restore sleep debt and HRV trajectory.",
        prescription: "Target 8.5+ hours in bed and avoid caffeine after 1 PM.",
      },
      ...baseProtocol,
    ];
  }

  if (tier === "Stabilize") {
    return [
      {
        id: "controlled-intensity",
        window: "Morning",
        title: "Controlled Intensity",
        priority: "high",
        objective: "Preserve adaptation without overreaching.",
        prescription: "Use sub-threshold session (RPE 6-7 max) with strict warm-up and cooldown.",
      },
      {
        id: "nutrition-timing",
        window: "Midday",
        title: "Recovery Nutrition Window",
        priority: "high",
        objective: "Improve readiness for next cycle.",
        prescription: "Consume protein + complex carbs within 90 minutes post-training.",
      },
      {
        id: "sleep-protection",
        window: "Evening",
        title: "Sleep Protection",
        priority: "high",
        objective: "Prevent readiness decline overnight.",
        prescription: "Maintain dark/cool bedroom and pre-sleep wind-down routine.",
      },
      ...baseProtocol,
    ];
  }

  return [
    {
      id: "peak-work",
      window: "Morning",
      title: "Peak Output Block",
      priority: "high",
      objective: "Capitalize on readiness window.",
      prescription: "Schedule cognitively demanding work and training in first half of day.",
    },
    {
      id: "progressive-training",
      window: "Midday",
      title: "Progressive Training",
      priority: "medium",
      objective: "Drive adaptation while maintaining recovery.",
      prescription: "Execute planned intensity with post-session cooldown and hydration.",
    },
    {
      id: "sleep-consistency",
      window: "Evening",
      title: "Sleep Consistency",
      priority: "medium",
      objective: "Protect next-day readiness and HRV.",
      prescription: `Target ${sleepHours < 7 ? "7.5+" : "7.0+"} hours and keep pre-sleep routine consistent.`,
    },
    ...baseProtocol,
  ];
}

export function buildClinicalDailyPlan({ latest = null, trend = null, generatedAt } = {}) {
  const readinessScore = clamp(
    Math.round(toNumber(latest?.readinessScore, toNumber(trend?.datasets?.readiness?.latest, 78))),
    0,
    100
  );
  const stressScore = clamp(
    Math.round(toNumber(latest?.stressScore, toNumber(trend?.datasets?.stress?.latest, 30))),
    0,
    100
  );
  const restingHr = clamp(
    Math.round(toNumber(latest?.restingHrBpm, toNumber(trend?.datasets?.rhr?.latest, 58))),
    35,
    120
  );
  const sleepHours = toNumber(
    typeof latest?.sleepDurationMin === "number" ? latest.sleepDurationMin / 60 : null,
    toNumber(trend?.datasets?.sleep?.latest, 7.0)
  );
  const hrvDeltaPct = toNumber(trend?.datasets?.hrv?.deltaPct, 0);
  const anomalyCount = Array.isArray(trend?.anomalies) ? trend.anomalies.length : 0;

  const factors = [];
  if (readinessScore < 65) factors.push({ label: "Low readiness", points: 24 });
  else if (readinessScore < 75) factors.push({ label: "Suboptimal readiness", points: 12 });

  if (stressScore > 70) factors.push({ label: "High stress index", points: 22 });
  else if (stressScore > 55) factors.push({ label: "Moderate stress load", points: 12 });

  if (sleepHours < 6.5) factors.push({ label: "Sleep deficit", points: 20 });
  else if (sleepHours < 7.2) factors.push({ label: "Sleep below target", points: 10 });

  if (restingHr > 62) factors.push({ label: "Elevated resting HR", points: 12 });
  if (hrvDeltaPct < -8) factors.push({ label: "HRV trend decline", points: 14 });
  if (anomalyCount >= 3) factors.push({ label: "Multiple anomaly signals", points: 14 });

  const riskScore = clamp(factors.reduce((sum, factor) => sum + factor.points, 10), 0, 100);
  const tier = deriveTier(riskScore);
  const protocol = buildProtocol(tier, readinessScore, stressScore, sleepHours);
  const summary = deriveSummary(tier, riskScore, readinessScore);

  const coachContext = [
    `Clinical layer: risk ${riskScore}/100 (${tier}).`,
    `Readiness ${readinessScore}/100, stress ${stressScore}/100, RHR ${restingHr} bpm, sleep ${sleepHours.toFixed(1)}h, HRV delta ${toSigned(hrvDeltaPct)}%.`,
    `Top factors: ${factors.length > 0 ? factors.slice(0, 3).map((f) => f.label).join(", ") : "none critical"}.`,
  ].join(" ");

  return {
    version: "1.0.0",
    generatedAt: generatedAt || new Date().toISOString(),
    riskScore,
    readinessScore,
    tier,
    summary,
    factors,
    metrics: {
      stressScore,
      restingHr,
      sleepHours: Number(sleepHours.toFixed(1)),
      hrvDeltaPct: Number(hrvDeltaPct.toFixed(1)),
      anomalyCount,
    },
    protocol,
    coachContext,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestamp(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString();
}

function toDisplayLabel(value) {
  return String(value || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function toClinicianBrief(plan) {
  const safety = plan?.safety || {};
  const adherence = plan?.adherence || {};
  const flagged = Array.isArray(safety.activeFlags)
    ? safety.activeFlags.map(toDisplayLabel).join(", ")
    : "";

  const context = [
    `Today's protocol tier is ${plan?.tier || "Performance"} with risk ${plan?.riskScore ?? "N/A"}/100 and readiness ${plan?.readinessScore ?? "N/A"}/100.`,
    plan?.summary || "No summary available.",
    flagged
      ? `Active contraindication flags: ${flagged}.`
      : "No active contraindication flags were recorded.",
    `Safety envelope status is ${(safety.status || "clear").toUpperCase()} with ${safety.blockedCount || 0} blocked and ${safety.downgradedCount || 0} downgraded actions.`,
    `Adherence score is ${adherence.score ?? "N/A"}/100 with projected risk shift of +${adherence.projectedRiskDelta ?? 0}.`,
  ];

  return context.join(" ");
}

function getActionStatus(action) {
  if (action?.blocked) return "BLOCKED";
  if (action?.safetyReason === "high_risk_downgrade") return "DOWNGRADED";
  if (action?.done) return "COMPLETED";
  return "OPEN";
}

function buildPlanExportHtml(plan) {
  const factors = Array.isArray(plan?.factors) ? plan.factors : [];
  const protocol = Array.isArray(plan?.protocol) ? plan.protocol : [];
  const safety = plan?.safety || {};
  const adherence = plan?.adherence || {};
  const contraindications = safety?.contraindications || {};
  const contraindicationFlags = Object.entries(contraindications)
    .filter(([key, value]) => key !== "notes" && key !== "updatedAt" && value === true)
    .map(([key]) => toDisplayLabel(key));
  const riskTone = (plan?.riskScore || 0) >= 70 ? "critical" : (plan?.riskScore || 0) >= 45 ? "moderate" : "clear";
  const versionHistory = Array.isArray(plan?.versionHistory) ? plan.versionHistory : [];
  const versionHistoryHtml = versionHistory.length > 0
    ? versionHistory.map((item) => `
      <tr>
        <td>v${escapeHtml(item.versionNumber)}</td>
        <td>${escapeHtml(formatTimestamp(item.generatedAt))}</td>
        <td>${escapeHtml(String(item.reason || "unknown").replace(/_/g, " "))}</td>
        <td>${escapeHtml(item.summary?.changeType || "unknown")}</td>
        <td>+${escapeHtml(item.summary?.addedActions || 0)} / -${escapeHtml(item.summary?.removedActions || 0)} / ~${escapeHtml(item.summary?.modifiedActions || 0)}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="5">No version snapshots available.</td>
      </tr>
    `;

  const factorsHtml = factors.length > 0
    ? factors.map((factor, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(factor.label)}</td>
        <td>+${escapeHtml(factor.points)}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td>1</td>
        <td>Baseline load</td>
        <td>+10</td>
      </tr>
    `;

  const actionHtml = protocol.map((action, index) => {
    const status = getActionStatus(action);
    const chipClass = status === "BLOCKED"
      ? "chip danger"
      : status === "DOWNGRADED"
        ? "chip warning"
        : status === "COMPLETED"
          ? "chip success"
          : "chip neutral";

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(action.window || "Anytime")}</td>
        <td>
          <div class="action-title">${escapeHtml(action.title || "Action")}</div>
          <div class="action-sub">${escapeHtml(action.objective || "")}</div>
          <div class="action-rx">${escapeHtml(action.prescription || "")}</div>
          ${action.blockedReason ? `<div class="action-flag">${escapeHtml(action.blockedReason)}</div>` : ""}
          ${action.safetyReason && !action.blockedReason ? `<div class="action-flag">${escapeHtml(toDisplayLabel(action.safetyReason))}</div>` : ""}
        </td>
        <td>${escapeHtml(String(action.priority || "medium").toUpperCase())}</td>
        <td><span class="${chipClass}">${status}</span></td>
      </tr>
    `;
  }).join("");

  const contraindicationHtml = contraindicationFlags.length > 0
    ? contraindicationFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")
    : "<li>None declared</li>";

  const adherenceRows = Array.isArray(adherence?.daily) && adherence.daily.length > 0
    ? adherence.daily.map((day) => `
      <tr>
        <td>${escapeHtml(day.protocolDate || "N/A")}</td>
        <td>${escapeHtml(day.completedCount || 0)} / ${escapeHtml(day.actionableCount || 0)}</td>
        <td>${escapeHtml(day.completionRate || 0)}%</td>
        <td>${escapeHtml(day.keyActionMisses || 0)}</td>
      </tr>
    `).join("")
    : adherence?.provisionalToday
      ? `
        <tr>
          <td>${escapeHtml(`${adherence.provisionalToday.protocolDate || "N/A"} (Today - Provisional)`)}</td>
          <td>${escapeHtml(adherence.provisionalToday.completedCount || 0)} / ${escapeHtml(adherence.provisionalToday.actionableCount || 0)}</td>
          <td>${escapeHtml(adherence.provisionalToday.completionRate || 0)}%</td>
          <td>${escapeHtml(adherence.provisionalToday.keyActionMisses || 0)}</td>
        </tr>
      `
      : `
        <tr>
          <td colspan="4">No adherence history available.</td>
        </tr>
      `;

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>AEVUM Clinical Plan Export</title>
      <style>
        :root {
          --ink: #0c0f17;
          --sub: #4f5d78;
          --line: #d7dce8;
          --gold: #b88a2e;
          --success: #1f7a58;
          --warn: #a16913;
          --danger: #9f1f30;
          --paper: #ffffff;
        }
        @page { size: A4; margin: 14mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          color: var(--ink);
          background: var(--paper);
          font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
          font-size: 12px;
          line-height: 1.45;
        }
        h1, h2, h3 { margin: 0; }
        .header {
          border: 1px solid var(--line);
          padding: 16px;
          margin-bottom: 14px;
          background: linear-gradient(145deg, #fbfcff 0%, #f4f7fd 100%);
        }
        .brand {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 10px;
        }
        .brand-name {
          font-size: 20px;
          letter-spacing: 0.14em;
          color: var(--gold);
          font-weight: 600;
        }
        .title {
          font-size: 16px;
          font-weight: 600;
        }
        .meta {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 10px;
        }
        .card {
          border: 1px solid var(--line);
          padding: 8px;
          background: #fff;
        }
        .k {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--sub);
          margin-bottom: 4px;
        }
        .v {
          font-size: 16px;
          font-weight: 600;
        }
        .risk-critical { color: var(--danger); }
        .risk-moderate { color: var(--warn); }
        .risk-clear { color: var(--success); }
        .section {
          margin-bottom: 12px;
          border: 1px solid var(--line);
          padding: 12px;
        }
        .section h2 {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid var(--line);
          padding: 6px 7px;
          text-align: left;
          vertical-align: top;
        }
        th {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--sub);
          background: #f6f8fc;
        }
        .chip {
          display: inline-block;
          border-radius: 99px;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
        }
        .chip.success { background: #e9f7f0; color: var(--success); border: 1px solid #b8e4cf; }
        .chip.warning { background: #fff4e6; color: var(--warn); border: 1px solid #f2d0a4; }
        .chip.danger { background: #fdecef; color: var(--danger); border: 1px solid #efb7c1; }
        .chip.neutral { background: #f0f2f7; color: #415070; border: 1px solid #cfd6e7; }
        .action-title { font-weight: 600; margin-bottom: 2px; }
        .action-sub { color: var(--sub); margin-bottom: 3px; }
        .action-rx { color: #1b2843; }
        .action-flag { margin-top: 5px; color: var(--danger); font-weight: 600; }
        ul { margin: 6px 0 0 18px; padding: 0; }
        .footer {
          margin-top: 12px;
          border-top: 1px solid var(--line);
          padding-top: 8px;
          color: var(--sub);
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          <div class="brand-name">AEVUM</div>
          <div>${escapeHtml(formatTimestamp(plan?.generatedAt || Date.now()))}</div>
        </div>
        <div class="title">Clinical Decision Layer - Daily Plan Export</div>
        <div class="meta">
          <div class="card">
            <div class="k">Risk Score</div>
            <div class="v risk-${riskTone}">${escapeHtml(plan?.riskScore ?? "N/A")}/100</div>
          </div>
          <div class="card">
            <div class="k">Readiness</div>
            <div class="v">${escapeHtml(plan?.readinessScore ?? "N/A")}/100</div>
          </div>
          <div class="card">
            <div class="k">Strategy</div>
            <div class="v">${escapeHtml(plan?.tier || "Performance")}</div>
          </div>
          <div class="card">
            <div class="k">Protocol Date</div>
            <div class="v">${escapeHtml(plan?.protocolDate || new Date().toISOString().slice(0, 10))}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Clinician Brief</h2>
        <div>${escapeHtml(toClinicianBrief(plan))}</div>
      </div>

      <div class="section">
        <h2>Risk Rationale</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Factor</th>
              <th>Score Contribution</th>
            </tr>
          </thead>
          <tbody>
            ${factorsHtml}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Action Timeline</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Window</th>
              <th>Action</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${actionHtml}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Contraindication & Safety Appendix</h2>
        <div><strong>Safety Status:</strong> ${escapeHtml(String(safety.status || "clear").toUpperCase())}</div>
        <div><strong>Blocked Actions:</strong> ${escapeHtml(safety.blockedCount || 0)} | <strong>Downgraded Actions:</strong> ${escapeHtml(safety.downgradedCount || 0)}</div>
        <div style="margin-top:6px;"><strong>Active Contraindication Flags:</strong></div>
        <ul>
          ${contraindicationHtml}
        </ul>
      </div>

      <div class="section">
        <h2>Version History Appendix</h2>
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Generated At</th>
              <th>Reason</th>
              <th>Change Type</th>
              <th>Action Delta</th>
            </tr>
          </thead>
          <tbody>
            ${versionHistoryHtml}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Adherence Intelligence Appendix</h2>
        <div><strong>Adherence Score:</strong> ${escapeHtml(adherence.score ?? "N/A")}/100</div>
        <div><strong>Status:</strong> ${escapeHtml(String(adherence.status || "unknown").toUpperCase())} | <strong>Recovery Debt:</strong> ${escapeHtml(adherence.recoveryDebt ?? "N/A")} | <strong>Projected Risk Delta:</strong> +${escapeHtml(adherence.projectedRiskDelta ?? 0)}</div>
        <div style="margin-top:8px">
          <table>
            <thead>
              <tr>
                <th>Protocol Date</th>
                <th>Completed</th>
                <th>Completion Rate</th>
                <th>Key Misses</th>
              </tr>
            </thead>
            <tbody>
              ${adherenceRows}
            </tbody>
          </table>
        </div>
      </div>

      <div class="footer">
        <div><strong>Audit Footer:</strong> generated_at=${escapeHtml(formatTimestamp(plan?.generatedAt || Date.now()))}</div>
        <div>plan_id=${escapeHtml(plan?.id || "N/A")} | protocol_date=${escapeHtml(plan?.protocolDate || "N/A")} | engine_version=${escapeHtml(plan?.version || "1.0.0")} | safety_status=${escapeHtml(safety.status || "clear")}</div>
        <div>This report is informational and should be interpreted alongside licensed clinical judgment.</div>
      </div>
    </body>
  </html>`;
}

function downloadFallbackHtml(html, dateTag) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `aevum-clinical-plan-${dateTag}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

function toOutcomeRows(biometricsRecent = [], adherence = {}) {
  const normalized = [...(Array.isArray(biometricsRecent) ? biometricsRecent : [])]
    .filter((item) => item?.recordedAt)
    .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

  if (normalized.length === 0) {
    return [];
  }

  const baselineWindow = normalized.slice(0, Math.min(7, normalized.length));
  const latestWindow = normalized.slice(Math.max(0, normalized.length - 7));

  const metricDefs = [
    {
      label: "HRV",
      unit: "ms",
      betterWhenHigher: true,
      read: (entry) => Number(entry?.hrvMs),
    },
    {
      label: "Sleep Duration",
      unit: "min",
      betterWhenHigher: true,
      read: (entry) => Number(entry?.sleepDurationMin),
    },
    {
      label: "Readiness",
      unit: "/100",
      betterWhenHigher: true,
      read: (entry) => Number(entry?.readinessScore),
    },
    {
      label: "Stress",
      unit: "/100",
      betterWhenHigher: false,
      read: (entry) => Number(entry?.stressScore),
    },
    {
      label: "Resting HR",
      unit: "bpm",
      betterWhenHigher: false,
      read: (entry) => Number(entry?.restingHrBpm),
    },
  ];

  const rows = metricDefs.map((metric) => {
    const baselineValues = baselineWindow
      .map(metric.read)
      .filter((value) => Number.isFinite(value));
    const latestValues = latestWindow
      .map(metric.read)
      .filter((value) => Number.isFinite(value));
    const baseline = average(baselineValues);
    const latest = average(latestValues);

    if (!Number.isFinite(baseline) || !Number.isFinite(latest)) {
      return null;
    }

    const delta = latest - baseline;
    const deltaPct = baseline !== 0 ? (delta / Math.abs(baseline)) * 100 : 0;
    const favorable = metric.betterWhenHigher ? delta >= 0 : delta <= 0;

    return {
      metric: metric.label,
      baseline: Number(baseline.toFixed(1)),
      latest: Number(latest.toFixed(1)),
      delta: Number(delta.toFixed(1)),
      deltaPct: Number(deltaPct.toFixed(1)),
      unit: metric.unit,
      favorable,
    };
  }).filter(Boolean);

  rows.push({
    metric: "Adherence",
    baseline: null,
    latest: Number(adherence?.score ?? 0),
    delta: Number(adherence?.trendDelta ?? 0),
    deltaPct: null,
    unit: "/100",
    favorable: Number(adherence?.trendDelta ?? 0) >= 0,
  });

  return rows;
}

function buildInvestorPackHtml({ plan, biometricsRecent = [], user = null }) {
  const dateTag = new Date().toISOString().slice(0, 10);
  const adherence = plan?.adherence || {};
  const versionHistory = Array.isArray(plan?.versionHistory) ? plan.versionHistory : [];
  const outcomeRows = toOutcomeRows(biometricsRecent, adherence);
  const confidence = outcomeRows.length >= 5 ? "Moderate-High" : "Moderate";
  const subjectLabel = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : "Demo Subject";

  const outcomesHtml = outcomeRows.length > 0
    ? outcomeRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.metric)}</td>
        <td>${row.baseline == null ? "N/A" : `${escapeHtml(row.baseline)} ${escapeHtml(row.unit)}`}</td>
        <td>${escapeHtml(row.latest)} ${escapeHtml(row.unit)}</td>
        <td>${row.delta >= 0 ? "+" : ""}${escapeHtml(row.delta)}${row.deltaPct == null ? "" : ` (${row.deltaPct >= 0 ? "+" : ""}${escapeHtml(row.deltaPct)}%)`}</td>
        <td>${row.favorable ? "Favorable" : "Needs Attention"}</td>
      </tr>
    `).join("")
    : `
      <tr><td colspan="5">Insufficient biometric history for outcome deltas.</td></tr>
    `;

  const versionHtml = versionHistory.length > 0
    ? versionHistory.slice(0, 6).map((v) => `
      <tr>
        <td>v${escapeHtml(v.versionNumber)}</td>
        <td>${escapeHtml(formatTimestamp(v.generatedAt))}</td>
        <td>${escapeHtml(String(v.reason || "unknown").replace(/_/g, " "))}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="3">No version history available.</td></tr>`;

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>AEVUM Investor Pack</title>
      <style>
        :root {
          --ink: #0c0f17;
          --muted: #4f5d78;
          --line: #d6dbe7;
          --gold: #b88a2e;
          --good: #1f7a58;
          --warn: #9f1f30;
        }
        @page { size: A4; margin: 12mm; }
        body {
          font-family: "Segoe UI", Arial, sans-serif;
          margin: 0;
          color: var(--ink);
          line-height: 1.45;
          font-size: 12px;
        }
        .hero {
          border: 1px solid var(--line);
          padding: 14px;
          margin-bottom: 10px;
          background: linear-gradient(145deg, #fbfcff 0%, #f4f7fd 100%);
        }
        .brand {
          letter-spacing: 0.14em;
          color: var(--gold);
          font-weight: 700;
          margin-bottom: 6px;
        }
        h1 { margin: 0 0 6px 0; font-size: 18px; }
        h2 {
          margin: 0 0 8px 0;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .section { border: 1px solid var(--line); padding: 10px; margin-bottom: 10px; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .card { border: 1px solid var(--line); padding: 7px; }
        .k { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
        .v { font-size: 16px; font-weight: 600; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid var(--line); padding: 6px; text-align: left; vertical-align: top; }
        th {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          background: #f6f8fc;
        }
        .good { color: var(--good); font-weight: 600; }
        .warn { color: var(--warn); font-weight: 600; }
        .footer {
          margin-top: 10px;
          border-top: 1px solid var(--line);
          padding-top: 8px;
          font-size: 10px;
          color: var(--muted);
        }
      </style>
    </head>
    <body>
      <div class="hero">
        <div class="brand">AEVUM</div>
        <h1>Investor Evidence Pack</h1>
        <div>${escapeHtml(subjectLabel)} | generated ${escapeHtml(formatTimestamp(new Date().toISOString()))}</div>
      </div>

      <div class="section">
        <h2>Executive Snapshot</h2>
        <div class="grid">
          <div class="card"><div class="k">Risk Score</div><div class="v">${escapeHtml(plan?.riskScore ?? "N/A")}/100</div></div>
          <div class="card"><div class="k">Readiness</div><div class="v">${escapeHtml(plan?.readinessScore ?? "N/A")}/100</div></div>
          <div class="card"><div class="k">Adherence</div><div class="v">${escapeHtml(adherence?.score ?? "N/A")}/100</div></div>
          <div class="card"><div class="k">Model Confidence</div><div class="v">${escapeHtml(confidence)}</div></div>
        </div>
        <p>${escapeHtml(plan?.summary || "No summary available.")}</p>
      </div>

      <div class="section">
        <h2>Outcomes Validation (Baseline vs Recent)</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Baseline</th>
              <th>Recent</th>
              <th>Delta</th>
              <th>Signal</th>
            </tr>
          </thead>
          <tbody>
            ${outcomesHtml}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Clinical Version Stability</h2>
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Generated At</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${versionHtml}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2>Adherence & Risk Projection</h2>
        <div>
          Status:
          <span class="${String(adherence?.status || "").toLowerCase().includes("critical") ? "warn" : "good"}">
            ${escapeHtml(String(adherence?.status || "unknown").toUpperCase())}
          </span>
          | Recovery debt: ${escapeHtml(adherence?.recoveryDebt ?? "N/A")}
          | Projected risk delta: +${escapeHtml(adherence?.projectedRiskDelta ?? 0)}
        </div>
        <p>${escapeHtml(adherence?.summary || "Adherence summary unavailable.")}</p>
      </div>

      <div class="footer">
        plan_id=${escapeHtml(plan?.id || "N/A")} | protocol_date=${escapeHtml(plan?.protocolDate || dateTag)} | engine_version=${escapeHtml(plan?.version || "N/A")}
      </div>
    </body>
  </html>`;
}

export function downloadClinicalDailyPlan(plan) {
  if (!plan || typeof window === "undefined") return;

  const html = buildPlanExportHtml(plan);
  const dateTag = new Date().toISOString().slice(0, 10);
  const popup = window.open("", "_blank", "noopener,noreferrer");

  if (!popup) {
    downloadFallbackHtml(html, dateTag);
    return;
  }

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => {
    popup.print();
  }, 280);
}

export function downloadInvestorPack({ plan, biometricsRecent = [], user = null } = {}) {
  if (!plan || typeof window === "undefined") return;

  const html = buildInvestorPackHtml({ plan, biometricsRecent, user });
  const dateTag = new Date().toISOString().slice(0, 10);
  const popup = window.open("", "_blank", "noopener,noreferrer");

  if (!popup) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aevum-investor-pack-${dateTag}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    return;
  }

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => {
    popup.print();
  }, 280);
}
