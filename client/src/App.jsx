import { Profiler, useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  authApi,
  coachApi,
  biometricsApi,
  protocolsApi,
  contraindicationsApi,
  wearablesApi,
  outcomesApi,
  platformApi,
  clinicianApi,
  billingApi,
  complianceApi,
  opsApi,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
} from "./api/client";
import { buildTrendIntelligence } from "./lib/trendIntelligence";
import { downloadClinicalDailyPlan, downloadInvestorPack } from "./lib/clinicalDecisionLayer";
import { C, F, STYLES } from "./theme/designSystem";
import { Rule, Tag, VitalRing, StatCard, Ticker } from "./components/ui/Primitives";
import { onAppRenderProfile } from "./lib/renderProfiler";

const DEFAULT_CONTRAINDICATIONS = {
  avoidHighIntensity: false,
  avoidColdExposure: false,
  avoidBreathwork: false,
  recentInjury: false,
  clinicianOverride: false,
  notes: "",
};

const WEARABLE_PROVIDER_OPTIONS = ["apple_health", "oura", "garmin", "fitbit"];

const WEARABLE_PROVIDER_LABELS = {
  apple_health: "Apple Health",
  oura: "Oura",
  garmin: "Garmin",
  fitbit: "Fitbit",
};

const PLAN_LEVEL = {
  free: 0,
  premium: 1,
  enterprise: 2,
};

const normalizePlan = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PLAN_LEVEL, key) ? key : "free";
};

const isPlanAtLeast = (currentPlan, minimumPlan) => (
  PLAN_LEVEL[normalizePlan(currentPlan)] >= PLAN_LEVEL[normalizePlan(minimumPlan)]
);

const normalizeErrorText = (value) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const toEnterpriseErrorMessage = (value, fallback = '') => {
  const text = normalizeErrorText(value || fallback);
  if (!text) {
    return '';
  }
  if (/failed to fetch|network ?error|load failed/i.test(text)) {
    return 'Backend unavailable. Start backend with "npm start" in C:\\Users\\Austin\\OneDrive\\aevum, then click Refresh.';
  }
  if (/enterprise endpoint unavailable on current backend/i.test(text)) {
    return 'Enterprise endpoint unavailable on current backend. Restart backend with "npm start" in C:\\Users\\Austin\\OneDrive\\aevum.';
  }
  if (/route not found/i.test(text)) {
    return 'Enterprise route unavailable on current backend. Restart backend and refresh.';
  }
  return text;
};

// PAGE: OVERVIEW
const AuthGate = ({ onAuthenticated, initialError = "" }) => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    setError(initialError || "");
  }, [initialError]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        email: form.email.trim(),
        password: form.password,
      };

      const result = mode === "register"
        ? await authApi.register({
          ...payload,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
        })
        : await authApi.login(payload);

      onAuthenticated(result);
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSubmit = mode === "register"
    ? form.firstName.trim() && form.lastName.trim() && form.email.trim() && form.password
    : form.email.trim() && form.password;

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(circle at 20% 10%, ${C.gold}14 0%, transparent 35%), ${C.void}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <style>{STYLES}</style>
      <div style={{
        width: "100%",
        maxWidth: 520,
        background: `linear-gradient(170deg, ${C.surface} 0%, ${C.depth} 100%)`,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "36px 34px",
      }}>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.gold, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>
          Secure Access
        </div>
        <h1 style={{ fontFamily: F.display, fontSize: 34, color: C.cream, fontWeight: 500, marginBottom: 10 }}>
          AEVUM Command
        </h1>
        <p style={{ color: C.creamDim, fontSize: 13, lineHeight: 1.8, marginBottom: 24 }}>
          Sign in to access biometric intelligence and secure AI coaching.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["login", "register"].map((opt) => (
            <button
              key={opt}
              onClick={() => { setMode(opt); setError(""); }}
              style={{
                background: mode === opt ? `${C.gold}20` : "transparent",
                border: `1px solid ${mode === opt ? C.goldBorder : C.border}`,
                borderRadius: 4,
                color: mode === opt ? C.gold : C.platinumDim,
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              {opt}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {mode === "register" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                placeholder="First name"
                style={{
                  background: C.lift,
                  border: `1px solid ${C.border}`,
                  borderRadius: 5,
                  color: C.cream,
                  padding: "12px 13px",
                }}
              />
              <input
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                placeholder="Last name"
                style={{
                  background: C.lift,
                  border: `1px solid ${C.border}`,
                  borderRadius: 5,
                  color: C.cream,
                  padding: "12px 13px",
                }}
              />
            </div>
          )}

          <input
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="Email"
            type="email"
            style={{
              background: C.lift,
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              color: C.cream,
              padding: "12px 13px",
            }}
          />
          <input
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="Password"
            type="password"
            style={{
              background: C.lift,
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              color: C.cream,
              padding: "12px 13px",
            }}
          />
        </div>

        {error && (
          <div style={{
            marginTop: 14,
            background: `${C.rose}15`,
            border: `1px solid ${C.rose}40`,
            borderRadius: 5,
            color: C.roseLight,
            fontSize: 12,
            lineHeight: 1.6,
            padding: "10px 12px",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          style={{
            marginTop: 18,
            width: "100%",
            background: canSubmit && !submitting
              ? `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`
              : C.lift,
            border: `1px solid ${canSubmit && !submitting ? C.gold : C.border}`,
            borderRadius: 6,
            color: canSubmit && !submitting ? C.void : C.platinumMuted,
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "12px 14px",
            cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
            fontWeight: 700,
          }}
        >
          {submitting ? "Please wait..." : mode === "register" ? "Create Account" : "Sign In"}
        </button>

      </div>
    </div>
  );
};

const BootScreen = ({ note = "Securing your workspace..." }) => (
  <div style={{
    minHeight: "100vh",
    background: C.void,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 14,
  }}>
    <style>{STYLES}</style>
    <div style={{ width: 44, height: 44, borderRadius: "50%", border: `2px solid ${C.goldBorder}`, borderTopColor: C.gold, animation: "spin 1s linear infinite" }} />
    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.platinumMuted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{note}</div>
  </div>
);

const numberOr = (value, fallback) => (
  typeof value === "number" && Number.isFinite(value) ? value : fallback
);

const toMetricText = (value, digits = 1) => (
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : null
);

const buildTrendMeta = ({ current, previous, lowerIsBetter = false }) => {
  if (typeof current !== "number" || typeof previous !== "number" || previous === 0) {
    return {
      text: "Baseline calibrating",
      trendDir: "up",
    };
  }

  const deltaPct = ((current - previous) / Math.abs(previous)) * 100;
  const improved = lowerIsBetter ? deltaPct <= 0 : deltaPct >= 0;
  const directionText = deltaPct >= 0 ? "higher" : "lower";

  return {
    text: `${Math.abs(deltaPct).toFixed(1)}% ${directionText} vs previous`,
    trendDir: improved ? "up" : "down",
  };
};

const formatRecordedStamp = (isoDate) => {
  if (!isoDate) {
    return "Awaiting sync";
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Awaiting sync";
  }

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toWearableLabel = (provider) => (
  WEARABLE_PROVIDER_LABELS[provider] || String(provider || "provider")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

const downloadJson = (filename, payload) => {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const outcomeStatusTheme = (status) => {
  if (status === "improving") {
    return {
      color: C.emeraldLight,
      border: `${C.emerald}55`,
      bg: `${C.emerald}18`,
      label: "Improving",
    };
  }

  if (status === "watch") {
    return {
      color: C.roseLight,
      border: `${C.rose}55`,
      bg: `${C.rose}18`,
      label: "Watch",
    };
  }

  if (status === "stable") {
    return {
      color: C.gold,
      border: `${C.goldBorder}`,
      bg: `${C.gold}14`,
      label: "Stable",
    };
  }

  return {
    color: C.platinumDim,
    border: C.border,
    bg: C.lift,
    label: "Calibrating",
  };
};

const Overview = ({
  authUser,
  biometricLatest,
  biometricsRecent = [],
  biometricsBusy,
  biometricsError,
  onCreateBiometric,
  wearableConnections = [],
  wearablesBusy,
  wearablesError,
  onQuickConnectWearable,
}) => {
  const h = new Date().getHours();
  const greet = h < 5 ? "Still awake," : h < 12 ? "Good morning," : h < 17 ? "Good afternoon," : "Good evening,";
  const dateStr = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
  const [entryDraft, setEntryDraft] = useState({
    hrvMs: "",
    restingHrBpm: "",
    sleepDurationHrs: "",
    readinessScore: "",
    stressScore: "",
    bodyTempC: "",
  });
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [entryFeedback, setEntryFeedback] = useState("");
  const [wearableProvider, setWearableProvider] = useState("oura");
  const [wearableFeedback, setWearableFeedback] = useState("");

  const previousEntry = biometricsRecent[1] || null;
  const hrvCurrent = biometricLatest?.hrvMs;
  const hrvFallback = numberOr(hrvCurrent, 67);
  const rhrCurrent = biometricLatest?.restingHrBpm;
  const rhrFallback = numberOr(rhrCurrent, 54);
  const readinessCurrent = biometricLatest?.readinessScore;
  const readinessFallback = numberOr(readinessCurrent, 91);
  const stressCurrent = biometricLatest?.stressScore;
  const sleepHrsCurrent = typeof biometricLatest?.sleepDurationMin === "number"
    ? biometricLatest.sleepDurationMin / 60
    : null;
  const sleepHrsFallback = numberOr(sleepHrsCurrent, 7.4);

  const hrvTrend = buildTrendMeta({
    current: hrvCurrent,
    previous: previousEntry?.hrvMs,
  });
  const sleepTrend = buildTrendMeta({
    current: sleepHrsCurrent,
    previous: typeof previousEntry?.sleepDurationMin === "number" ? previousEntry.sleepDurationMin / 60 : undefined,
  });
  const rhrTrend = buildTrendMeta({
    current: rhrCurrent,
    previous: previousEntry?.restingHrBpm,
    lowerIsBetter: true,
  });
  const readinessTrend = buildTrendMeta({
    current: readinessCurrent,
    previous: previousEntry?.readinessScore,
  });

  const derivedVitalScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (
          numberOr(readinessCurrent, 82) * 0.55
          + numberOr(hrvCurrent, 67) * 0.2
          + (100 - numberOr(stressCurrent, 30)) * 0.25
        )
      )
    )
  );

  const handleDraft = (field, value) => {
    setEntryDraft((prev) => ({ ...prev, [field]: value }));
  };

  const submitMetricEntry = async () => {
    if (entrySubmitting || !onCreateBiometric) return;
    setEntrySubmitting(true);
    setEntryFeedback("");

    try {
      const payload = {
        source: "manual",
        recordedAt: new Date().toISOString(),
      };

      if (entryDraft.hrvMs) payload.hrvMs = Number(entryDraft.hrvMs);
      if (entryDraft.restingHrBpm) payload.restingHrBpm = Number(entryDraft.restingHrBpm);
      if (entryDraft.sleepDurationHrs) payload.sleepDurationMin = Math.round(Number(entryDraft.sleepDurationHrs) * 60);
      if (entryDraft.readinessScore) payload.readinessScore = Number(entryDraft.readinessScore);
      if (entryDraft.stressScore) payload.stressScore = Number(entryDraft.stressScore);
      if (entryDraft.bodyTempC) payload.bodyTempC = Number(entryDraft.bodyTempC);

      if (Object.keys(payload).length <= 2) {
        throw new Error("Add at least one metric before syncing.");
      }

      await onCreateBiometric(payload);
      setEntryFeedback("Metrics synced.");
      setEntryDraft({
        hrvMs: "",
        restingHrBpm: "",
        sleepDurationHrs: "",
        readinessScore: "",
        stressScore: "",
        bodyTempC: "",
      });
    } catch (err) {
      setEntryFeedback(err.message || "Unable to sync metrics right now.");
    } finally {
      setEntrySubmitting(false);
    }
  };

  const connectWearableProvider = async () => {
    if (!onQuickConnectWearable || wearablesBusy) return;

    setWearableFeedback("");
    try {
      await onQuickConnectWearable(wearableProvider);
      setWearableFeedback(`${toWearableLabel(wearableProvider)} connected.`);
    } catch (err) {
      setWearableFeedback(err.message || "Unable to connect wearable provider.");
    }
  };

  return (
    <div style={{ padding:"40px 36px", maxWidth:1140, margin:"0 auto" }}>

      {/* Hero Row */}
      <div className="fu" style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.22em",
            textTransform:"uppercase", color:C.platinumMuted, marginBottom:14 }}>{dateStr}</div>
          <h1 style={{ fontFamily:F.display, fontSize:44, fontWeight:400,
            color:C.cream, lineHeight:1.08, marginBottom:16 }}>
            {greet}<br />
            <em style={{ color:C.gold, fontStyle:"italic" }}>{authUser?.firstName || "Alexander"}.</em>
          </h1>
          <p style={{ color:C.creamDim, fontSize:13.5, fontWeight:300,
            lineHeight:1.8, maxWidth:500, marginBottom:24 }}>
            Your body recovered above its 30-day baseline overnight. Parasympathetic activity was dominant for 6 of 7 sleep hours. Three high-leverage actions are prioritised for today.
          </p>
          <div style={{ display:"flex", gap:10 }}>
            <Tag>Peak Window Active</Tag>
            <Tag variant="emerald">Recovery: Optimal</Tag>
          </div>
        </div>
        <div style={{ flexShrink:0, marginLeft:48 }}>
          <VitalRing score={derivedVitalScore} />
        </div>
      </div>

      <Rule style={{ margin:"36px 0" }} />

      {/* Live Alert Banner */}
      <div className="fu1" style={{
        background: `linear-gradient(135deg, ${C.surface} 0%, ${C.lift} 100%)`,
        border: `1px solid ${C.goldBorder}`,
        borderRadius: 6, padding: "16px 22px", marginBottom: 32,
        display:"flex", alignItems:"center", gap:16,
      }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:C.gold,
          flexShrink:0, animation:"pulse 2s ease infinite" }} />
        <div style={{ flex:1 }}>
          <span style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
            textTransform:"uppercase", color:C.gold, marginRight:14 }}>Cortisol Intelligence</span>
          <span style={{ fontSize:13, color:C.creamDim, fontWeight:300 }}>
            Diurnal cortisol peak in approximately 35 minutes. This is your highest-leverage window for strategic thinking, complex decisions, and creative output. Defer routine tasks.
          </span>
        </div>
        <div style={{ fontFamily:F.mono, fontSize:10, color:C.platinumMuted,
          borderLeft:`1px solid ${C.border}`, paddingLeft:18, flexShrink:0 }}>
          {formatRecordedStamp(biometricLatest?.recordedAt)}
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:32 }}>
        <StatCard cls="fu1" label="Heart Rate Variability" value={toMetricText(hrvFallback, 0)} unit="ms"
          trend={hrvTrend.text} trendDir={hrvTrend.trendDir}
          note="Parasympathetic dominance. Nervous system well-regulated and ready for load." />
        <StatCard cls="fu2" label="Sleep Architecture" value={toMetricText(sleepHrsFallback, 1)} unit="hrs"
          trend={sleepTrend.text} trendDir={sleepTrend.trendDir}
          note="83% efficiency. Three complete REM cycles. Memory consolidation optimal." />
        <StatCard cls="fu3" label="Resting Heart Rate" value={toMetricText(rhrFallback, 0)} unit="bpm"
          trend={rhrTrend.text} trendDir={rhrTrend.trendDir}
          note="Consistent improvement over 6 weeks. Stroke volume increasing." />
        <StatCard cls="fu4" label="Readiness Index" value={toMetricText(readinessFallback, 0)} unit="/ 100"
          trend={readinessTrend.text} trendDir={readinessTrend.trendDir}
          note="Highest score in 14 days. High-intensity training is appropriate today." />
      </div>

      {/* Two column row */}
      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:14, marginBottom:14 }}>

        {/* Daily Protocol */}
        <div className="fu3" style={{ background:C.surface, border:`1px solid ${C.border}`,
          borderRadius:6, padding:28 }}>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:24 }}>
            <div>
              <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
                textTransform:"uppercase", color:C.platinumMuted, marginBottom:8 }}>Today's Protocol</div>
              <h3 style={{ fontFamily:F.display, fontSize:22, fontWeight:400,
                color:C.cream }}>Precision Daily Regimen</h3>
            </div>
            <Tag>3 / 6 Done</Tag>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { t:"06:45", name:"Cold Thermogenesis",     sub:"2-min cold exposure - norepinephrine activation protocol",          done:true  },
              { t:"07:30", name:"Morning Nutrition",      sub:"High-protein, leucine-threshold met - anabolic window capitalised",  done:true  },
              { t:"08:10", name:"Focused Work Block",     sub:"Peak cortisol window - cognitive-intensive tasks only",              done:true  },
              { t:"12:30", name:"Midday Movement",        sub:"10-min walk post-lunch - postprandial glucose regulation",           done:false },
              { t:"14:00", name:"Supplement Stack",       sub:"Magnesium glycinate + L-theanine - afternoon stability",             done:false },
              { t:"21:30", name:"Sleep Onset Protocol",   sub:"Blue light off, core temperature drop - melatonin onset window",     done:false },
            ].map((item, i) => (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:16, padding:"12px 16px",
                borderRadius:5, background: item.done ? `${C.gold}07` : C.lift,
                border:`1px solid ${item.done ? C.goldBorder : C.border}`,
                opacity: item.done ? 0.72 : 1,
                transition: "all .2s",
              }}>
                <div style={{ fontFamily:F.mono, fontSize:10, color: item.done ? C.gold : C.platinumMuted,
                  minWidth:44, flexShrink:0 }}>{item.t}</div>
                <div style={{ width:16, height:16, borderRadius:"50%", flexShrink:0,
                  background: item.done ? C.gold : "transparent",
                  border: `1.5px solid ${item.done ? C.gold : C.borderSoft}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:9, color:C.void }}>
                  {item.done ? "OK" : ""}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:C.cream, fontWeight:400,
                    marginBottom:2 }}>{item.name}</div>
                  <div style={{ fontSize:11, color:C.platinumMuted, lineHeight:1.5 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Body Clock */}
        <div className="fu4" style={{ background:C.surface, border:`1px solid ${C.border}`,
          borderRadius:6, padding:28 }}>
          <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
            textTransform:"uppercase", color:C.platinumMuted, marginBottom:8 }}>Circadian Intelligence</div>
          <h3 style={{ fontFamily:F.display, fontSize:22, fontWeight:400,
            color:C.cream, marginBottom:20 }}>Body Clock Status</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { label:"Cortisol",        pct:78, dir:"Peaking",    color:C.amber,         note:"Peak in ~35 min" },
              { label:"Melatonin",       pct:8,  dir:"Suppressed", color:C.sapphireLight, note:"Daytime baseline" },
              { label:"Core Temp",       pct:62, dir:"Rising",     color:C.gold,          note:"36.7 C | Optimal" },
              { label:"Alertness",       pct:85, dir:"High",       color:C.emeraldLight,  note:"Caffeine synergy" },
              { label:"Adenosine",       pct:22, dir:"Low",        color:C.platinumDim,   note:"Sleep pressure minimal" },
              { label:"Growth Hormone",  pct:15, dir:"Baseline",   color:"#9B59B6",       note:"Peaks in deep sleep" },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  marginBottom:5, alignItems:"baseline" }}>
                  <span style={{ fontSize:12, color:C.cream, fontWeight:400 }}>{item.label}</span>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <span style={{ fontFamily:F.mono, fontSize:9,
                      color:item.color }}>{item.dir}</span>
                    <span style={{ fontSize:10, color:C.platinumMuted }}>{item.note}</span>
                  </div>
                </div>
                <div style={{ height:3, background:C.border, borderRadius:2 }}>
                  <div style={{ height:"100%", width:`${item.pct}%`,
                    background:`linear-gradient(90deg, ${item.color}88, ${item.color})`,
                    borderRadius:2, transition:"width .8s cubic-bezier(.16,1,.3,1)" }} />
                </div>
              </div>
            ))}
          </div>
          <Rule style={{ margin:"22px 0 16px" }} />
          <div style={{ fontSize:11.5, color:C.creamDim, lineHeight:1.7, fontStyle:"italic" }}>
            Your circadian phase is well-aligned with a natural schedule. Consistency within +/-15 minutes of your current sleep-wake times preserves this alignment.
          </div>
        </div>
      </div>

      {/* Weekly Snapshot */}
      <div className="fu5" style={{ background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:6, padding:"24px 28px" }}>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
              textTransform:"uppercase", color:C.platinumMuted, marginBottom:6 }}>Weekly Summary</div>
            <h3 style={{ fontFamily:F.display, fontSize:20, fontWeight:400, color:C.cream }}>
              7-Day Health Compliance
            </h3>
          </div>
          <div style={{ fontFamily:F.mono, fontSize:10, color:C.gold }}>89% overall</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8 }}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day, i) => {
            const scores = [84, 91, 78, 86, 88, 74, 82];
            const s = scores[i];
            const isTod = i === 6;
            return (
              <div key={i} style={{ textAlign:"center" }}>
                <div style={{ fontFamily:F.mono, fontSize:9, color: isTod ? C.gold : C.platinumMuted,
                  letterSpacing:"0.1em", marginBottom:8 }}>{day}</div>
                <div style={{
                  height:64, borderRadius:4, position:"relative", overflow:"hidden",
                  background:C.lift, border:`1px solid ${isTod ? C.goldBorder : C.border}`,
                  display:"flex", alignItems:"flex-end",
                }}>
                  <div style={{
                    width:"100%", borderRadius:3,
                    background: s >= 85 ? `linear-gradient(180deg, ${C.gold}80, ${C.goldDim})` :
                                s >= 70 ? `linear-gradient(180deg, ${C.amber}70, ${C.amber}30)` :
                                `linear-gradient(180deg, ${C.platinumMuted}50, ${C.platinumMuted}20)`,
                    height:`${s}%`, transition:"height .6s cubic-bezier(.16,1,.3,1)",
                  }} />
                </div>
                <div style={{ fontFamily:F.mono, fontSize:10, marginTop:6,
                  color: isTod ? C.gold : C.platinumDim }}>{s}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fu5" style={{ background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:6, padding:"24px 28px", marginTop:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div>
            <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
              textTransform:"uppercase", color:C.platinumMuted, marginBottom:6 }}>Biometric Intake</div>
            <h3 style={{ fontFamily:F.display, fontSize:20, fontWeight:400, color:C.cream }}>
              Sync Today&apos;s Core Metrics
            </h3>
          </div>
          <Tag variant="platinum">{biometricsBusy ? "Syncing..." : "Manual Input"}</Tag>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10 }}>
          {[
            { key:"hrvMs", label:"HRV (ms)" },
            { key:"restingHrBpm", label:"RHR (bpm)" },
            { key:"sleepDurationHrs", label:"Sleep (hrs)" },
            { key:"readinessScore", label:"Readiness" },
            { key:"stressScore", label:"Stress" },
            { key:"bodyTempC", label:"Temp C" },
          ].map((field) => (
            <input
              key={field.key}
              value={entryDraft[field.key]}
              onChange={(e) => handleDraft(field.key, e.target.value)}
              placeholder={field.label}
              inputMode="decimal"
              style={{
                background:C.lift,
                border:`1px solid ${C.border}`,
                borderRadius:5,
                color:C.cream,
                padding:"11px 12px",
                fontSize:12,
              }}
            />
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12 }}>
          <div style={{ fontSize:11, color: biometricsError ? C.roseLight : C.platinumMuted }}>
            {entryFeedback || biometricsError || "Input optional values and sync when ready."}
          </div>
          <button onClick={submitMetricEntry} disabled={entrySubmitting} style={{
            background: entrySubmitting ? C.lift : `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
            border:`1px solid ${entrySubmitting ? C.border : C.gold}`,
            borderRadius:6,
            color: entrySubmitting ? C.platinumMuted : C.void,
            padding:"10px 16px",
            fontFamily:F.mono,
            fontSize:10,
            letterSpacing:"0.1em",
            textTransform:"uppercase",
            cursor: entrySubmitting ? "not-allowed" : "pointer",
            fontWeight:700,
          }}>
            {entrySubmitting ? "Syncing" : "Sync Metrics"}
          </button>
        </div>
      </div>

      <div className="fu5" style={{ background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:6, padding:"24px 28px", marginTop:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div>
            <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
              textTransform:"uppercase", color:C.platinumMuted, marginBottom:6 }}>Wearable Sync Layer</div>
            <h3 style={{ fontFamily:F.display, fontSize:20, fontWeight:400, color:C.cream }}>
              Provider Connection & Ingestion
            </h3>
          </div>
          <Tag variant="platinum">{wearablesBusy ? "Refreshing..." : "Pipeline Ready"}</Tag>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, alignItems:"center" }}>
          <select
            value={wearableProvider}
            onChange={(e) => setWearableProvider(e.target.value)}
            style={{
              background:C.lift,
              border:`1px solid ${C.border}`,
              borderRadius:5,
              color:C.cream,
              padding:"11px 12px",
              fontSize:12,
            }}
          >
            {WEARABLE_PROVIDER_OPTIONS.map((provider) => (
              <option key={provider} value={provider}>
                {toWearableLabel(provider)}
              </option>
            ))}
          </select>

          <button onClick={connectWearableProvider} disabled={wearablesBusy} style={{
            background: wearablesBusy ? C.lift : "transparent",
            border:`1px solid ${wearablesBusy ? C.border : C.goldBorder}`,
            borderRadius:6,
            color: wearablesBusy ? C.platinumMuted : C.gold,
            padding:"10px 14px",
            fontFamily:F.mono,
            fontSize:10,
            letterSpacing:"0.1em",
            textTransform:"uppercase",
            cursor: wearablesBusy ? "not-allowed" : "pointer",
            fontWeight:700,
          }}>
            Connect
          </button>

        </div>

        <div style={{ marginTop:12, fontSize:11, color: wearablesError ? C.roseLight : C.platinumMuted }}>
          {wearableFeedback || wearablesError || "Connect your provider to start ingesting real biometric data."}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:14 }}>
          {(Array.isArray(wearableConnections) ? wearableConnections : []).map((connection) => (
            <div key={connection.provider} style={{
              border:`1px solid ${connection.connected ? C.goldBorder : C.border}`,
              borderRadius:5,
              background: connection.connected ? `${C.gold}08` : C.lift,
              padding:"10px 12px",
            }}>
              <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.1em", color:C.platinumMuted, marginBottom:5 }}>
                {toWearableLabel(connection.provider)}
              </div>
              <div style={{ fontSize:12, color: connection.connected ? C.gold : C.creamDim, marginBottom:4 }}>
                {connection.connected ? "Connected" : "Not Connected"}
              </div>
              <div style={{ fontSize:10, color:C.platinumMuted }}>
                {connection.lastSyncedAt ? `Last sync ${formatRecordedStamp(connection.lastSyncedAt)}` : "Awaiting first sync"}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

// PAGE: AI COACH
const AICoach = ({ authToken, onUnauthorized, biometricLatest, coachContext = "" }) => {
  const [msgs, setMsgs] = useState([{
    role:"assistant",
    content:"Your biometrics have been reviewed.\n\nHRV is elevated above baseline and readiness is high. You have a strong performance window open.\n\nWhat do you want to optimize right now: training, recovery, nutrition, or sleep?"
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [msgs, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role:"user", content: input.trim() };
    setMsgs(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await coachApi.sendMessage({
        token: authToken,
        message: userMsg.content,
        sessionId,
        context: coachContext,
      });

      setSessionId(data.sessionId);
      setMsgs(prev => [...prev, {
        role:"assistant",
        content: data.message?.content || "Signal quality degraded. Please retry.",
      }]);
    } catch (err) {
      if (err.status === 401) {
        onUnauthorized?.();
        return;
      }

      setMsgs(prev => [...prev, {
        role:"assistant",
        content: err.message || "Connection interrupted. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Explain my HRV result", "Best training for today",
    "How to extend my REM", "Optimal supplement timing",
    "Stress and cortisol today", "Nutrition for recovery",
  ];

  return (
    <div style={{ display:"flex", height:"calc(100vh - 112px)" }}>

      {/* Sidebar */}
      <div style={{ width:240, borderRight:`1px solid ${C.border}`,
        background:C.depth, padding:"28px 20px", flexShrink:0,
        display:"flex", flexDirection:"column", gap:0 }}>
        <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.18em",
          textTransform:"uppercase", color:C.platinumMuted, marginBottom:20 }}>Live Status</div>
                {[
          { k:"HRV",       v:`${toMetricText(numberOr(biometricLatest?.hrvMs, 67), 0)}ms`, c:C.gold         },
          { k:"Readiness", v:`${toMetricText(numberOr(biometricLatest?.readinessScore, 91), 0)}/100`, c:C.emeraldLight  },
          { k:"RHR",       v:`${toMetricText(numberOr(biometricLatest?.restingHrBpm, 54), 0)} bpm`, c:C.gold         },
          { k:"SpO2",      v:`${toMetricText(numberOr(biometricLatest?.spo2Percent, 98), 0)}%`, c:C.sapphireLight },
          { k:"Stress",    v:`${toMetricText(numberOr(biometricLatest?.stressScore, 22), 0)}/100`, c:C.emeraldLight  },
          { k:"Temp",      v:`${toMetricText(numberOr(biometricLatest?.bodyTempC, 36.7), 1)} C`, c:C.gold         },
        ].map((s, i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between",
            padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontFamily:F.mono, fontSize:10, color:C.platinumMuted }}>{s.k}</span>
            <span style={{ fontFamily:F.mono, fontSize:10, color:s.c }}>{s.v}</span>
          </div>
        ))}
        <Rule style={{ margin:"24px 0 18px" }} />
        <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
          textTransform:"uppercase", color:C.platinumMuted, marginBottom:14 }}>Suggest</div>
        {suggestions.map((q, i) => (
          <button key={i} onClick={() => setInput(q)} style={{
            background:"transparent", border:`1px solid ${C.border}`,
            borderRadius:4, padding:"8px 10px", cursor:"pointer",
            fontFamily:F.body, fontSize:11, color:C.creamDim,
            textAlign:"left", marginBottom:6, transition:"all .2s",
            lineHeight:1.4,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=C.goldBorder; e.currentTarget.style.color=C.cream; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.creamDim; }}
          >{q}</button>
        ))}
      </div>

      {/* Chat */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", background:C.void }}>
        {/* Header */}
        <div style={{ padding:"20px 28px", borderBottom:`1px solid ${C.border}`,
          background:C.depth, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:36, height:36, borderRadius:"50%",
              background:`linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:F.display, fontSize:16, color:C.void, fontWeight:600,
              animation:"glow 3s ease infinite" }}>A</div>
            <div>
              <div style={{ fontSize:14, color:C.cream, fontWeight:400 }}>AEVUM Intelligence</div>
              <div style={{ fontFamily:F.mono, fontSize:9, color:C.emeraldLight,
                letterSpacing:"0.12em", display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ width:5, height:5, borderRadius:"50%",
                  background:C.emeraldLight, display:"inline-block" }} />
                BIOMETRICS SYNCED | {sessionId ? "SESSION SECURED" : "CONTEXT LOADED"}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:"28px" }}>
          {msgs.map((msg, i) => (
            <div key={i} style={{
              display:"flex", justifyContent: msg.role==="user" ? "flex-end" : "flex-start",
              marginBottom:22, animation:"slideRight .35s ease both",
            }}>
              {msg.role==="assistant" && (
                <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0,
                  marginRight:12, marginTop:2,
                  background:`linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:F.display, fontSize:11, color:C.void, fontWeight:600 }}>A</div>
              )}
              <div style={{
                maxWidth:"68%",
                background: msg.role==="user"
                  ? `linear-gradient(135deg, ${C.gold}18, ${C.gold}08)`
                  : C.surface,
                border:`1px solid ${msg.role==="user" ? C.goldBorder : C.border}`,
                borderRadius: msg.role==="user" ? "10px 3px 10px 10px" : "3px 10px 10px 10px",
                padding:"14px 18px",
              }}>
                <div style={{ fontSize:13.5, color:C.cream, lineHeight:1.82,
                  fontWeight:300, whiteSpace:"pre-wrap" }}>{msg.content}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              <div style={{ width:28, height:28, borderRadius:"50%",
                background:`linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:F.display, fontSize:11, color:C.void }}>A</div>
              <div style={{ display:"flex", gap:5 }}>
                {[0,1,2].map(j => (
                  <div key={j} style={{ width:6, height:6, borderRadius:"50%",
                    background:C.gold, animation:`pulse 1.2s ${j*.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div style={{ padding:"16px 28px 24px", borderTop:`1px solid ${C.border}`,
          background:C.depth, flexShrink:0 }}>
          <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter" && !e.shiftKey){e.preventDefault();send();} }}
              placeholder="Ask about your performance, sleep architecture, nutrition biochemistry, stress response..."
              rows={2} style={{
                flex:1, background:C.surface, border:`1px solid ${C.border}`,
                borderRadius:6, padding:"13px 16px", color:C.cream, fontSize:13.5,
                fontWeight:300, resize:"none", lineHeight:1.65, transition:"border-color .25s",
              }}
              onFocus={e => e.target.style.borderColor=C.goldBorder}
              onBlur={e => e.target.style.borderColor=C.border}
            />
            <button onClick={send} disabled={loading||!input.trim()} style={{
              background: input.trim()&&!loading ? `linear-gradient(135deg, ${C.gold}, ${C.goldDim})` : C.surface,
              border:`1px solid ${input.trim()&&!loading ? C.gold : C.border}`,
              borderRadius:6, padding:"13px 22px",
              color: input.trim()&&!loading ? C.void : C.platinumMuted,
              fontFamily:F.mono, fontSize:10, letterSpacing:"0.12em",
              cursor: input.trim()&&!loading ? "pointer" : "not-allowed",
              transition:"all .25s", fontWeight:700,
            }}>SEND</button>
          </div>
          <div style={{ fontFamily:F.mono, fontSize:9, color:C.platinumMuted,
            letterSpacing:"0.1em", marginTop:10, textAlign:"center" }}>
            SHIFT + ENTER FOR NEW LINE | ENTER TO SEND | ALL DATA END-TO-END ENCRYPTED
          </div>
        </div>
      </div>
    </div>
  );
};

// PAGE: INSIGHTS
const Insights = ({
  biometricsRecent = [],
  trendWindowDays = 30,
  onTrendWindowChange,
  outcomesSummary = null,
  outcomesBusy = false,
  outcomesError = "",
  onRefreshOutcomes,
  clinicalPlan,
  clinicalPlanBusy = false,
  clinicalPlanError = "",
  onExportDailyPlan,
  onExportInvestorPack,
  onToggleClinicalAction,
  clinicalActionBusy = false,
  contraindications = DEFAULT_CONTRAINDICATIONS,
  contraindicationBusy = false,
  contraindicationError = "",
  onContraindicationChange,
  onSaveContraindications,
}) => {
  const trend = useMemo(
    () => buildTrendIntelligence(biometricsRecent, trendWindowDays),
    [biometricsRecent, trendWindowDays]
  );

  const datasets = [
    trend.datasets.hrv,
    trend.datasets.sleep,
    trend.datasets.rhr,
    trend.datasets.readiness,
    trend.datasets.stress,
  ].filter(Boolean);
  const safety = clinicalPlan?.safety || null;
  const changeIntelligence = clinicalPlan?.changeIntelligence || null;
  const versionHistory = Array.isArray(clinicalPlan?.versionHistory) ? clinicalPlan.versionHistory : [];
  const adherence = clinicalPlan?.adherence || null;
  const reasonLabel = String(changeIntelligence?.reason || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const outcomeHorizons = Array.isArray(outcomesSummary?.horizons) ? outcomesSummary.horizons : [];
  const outcomeAggregate = typeof outcomesSummary?.aggregateScore === "number"
    ? outcomesSummary.aggregateScore
    : null;

  const Spark = ({ values, color, anomalies = [], height = 64 }) => {
    const W = 280;
    const H = height;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pts = values.map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * W;
      const y = H - ((value - lo) / Math.max(1, hi - lo)) * H;
      return [x, y];
    });

    const anomalySet = new Set(anomalies.map((item) => item.index));
    const path = pts.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ');

    return (
      <svg width={W} height={H + 8} style={{ overflow: 'visible' }}>
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
        {pts.map(([x, y], index) => (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={anomalySet.has(index) ? 5 : 3}
            fill={anomalySet.has(index) ? C.roseLight : C.void}
            stroke={color}
            strokeWidth="1.5"
          />
        ))}
      </svg>
    );
  };

  return (
    <div style={{ padding: '40px 36px', maxWidth: 1140, margin: '0 auto' }}>
      <div className="fu" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.platinumMuted, marginBottom: 10 }}>
            Clinical Trend Intelligence
          </div>
          <h2 style={{ fontFamily: F.display, fontSize: 38, fontWeight: 400, color: C.cream, marginBottom: 8 }}>
            Trajectory & Risk Engine
          </h2>
          <p style={{ color: C.creamDim, fontSize: 13, lineHeight: 1.8, maxWidth: 700 }}>
            Windowed analytics, anomaly detection, and intervention-grade recommendations built from your biometric trajectory.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => onTrendWindowChange?.(days)}
              style={{
                background: trendWindowDays === days ? `${C.gold}22` : 'transparent',
                border: `1px solid ${trendWindowDays === days ? C.gold : C.border}`,
                borderRadius: 4,
                color: trendWindowDays === days ? C.gold : C.platinumDim,
                padding: '8px 11px',
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              {days}D
            </button>
          ))}
        </div>
      </div>

      <Rule style={{ marginBottom: 22 }} />

      <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted, letterSpacing: '0.1em', marginBottom: 14 }}>
        Data points in window: {trend.pointsInWindow}
      </div>

      <div className="fu2" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.platinumMuted, marginBottom: 7 }}>
              Pilot Outcomes Engine
            </div>
            <div style={{ fontSize: 12, color: C.creamDim }}>
              Baseline vs current movement across 30, 60, and 90-day windows.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold }}>
              Aggregate {outcomeAggregate ?? "--"}
            </div>
            <button
              onClick={onRefreshOutcomes}
              disabled={outcomesBusy}
              style={{
                background: outcomesBusy ? C.lift : "transparent",
                border: `1px solid ${outcomesBusy ? C.border : C.goldBorder}`,
                borderRadius: 4,
                color: outcomesBusy ? C.platinumMuted : C.gold,
                padding: "7px 10px",
                fontFamily: F.mono,
                fontSize: 9,
                letterSpacing: "0.08em",
                cursor: outcomesBusy ? "not-allowed" : "pointer",
                textTransform: "uppercase",
              }}
            >
              {outcomesBusy ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {outcomesError && (
          <div style={{ fontSize: 11, color: C.roseLight, marginBottom: 10 }}>
            {outcomesError}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {outcomeHorizons.map((horizon) => {
            const theme = outcomeStatusTheme(horizon.status);
            const topMetrics = Array.isArray(horizon.metrics)
              ? [...horizon.metrics]
                .sort((a, b) => Math.abs(b.deltaPct || 0) - Math.abs(a.deltaPct || 0))
                .slice(0, 2)
              : [];

            return (
              <div key={horizon.days} style={{
                border: `1px solid ${theme.border}`,
                borderRadius: 5,
                background: theme.bg,
                padding: "10px 12px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.platinumMuted }}>
                    {horizon.days}D WINDOW
                  </span>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: theme.color }}>
                    {theme.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 6 }}>
                  <span style={{ fontFamily: F.display, fontSize: 24, color: C.cream }}>
                    {horizon.score ?? "--"}
                  </span>
                  <span style={{ fontSize: 10, color: C.platinumDim }}>
                    score
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: C.creamDim, lineHeight: 1.6, marginBottom: 8 }}>
                  {horizon.summary}
                </div>
                {topMetrics.map((metric) => (
                  <div key={`${horizon.days}-${metric.key}`} style={{ fontSize: 10, color: C.platinumMuted, marginBottom: 4 }}>
                    {metric.label}: {metric.delta >= 0 ? "+" : ""}{metric.delta} {metric.unit}
                    {" "}({metric.deltaPct >= 0 ? "+" : ""}{metric.deltaPct}%)
                  </div>
                ))}
                {!horizon.sufficientData && (
                  <div style={{ fontSize: 10, color: C.platinumMuted }}>
                    Need at least 6 readings in this horizon.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 16 }}>
        {datasets.map((dataset, index) => {
          const positive = dataset.improving;
          return (
            <div key={dataset.key} className={`fu${(index % 5) + 1}`} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.platinumMuted, marginBottom: 7 }}>
                    {dataset.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: F.display, fontSize: 30, color: C.cream }}>{dataset.latest}</span>
                    <span style={{ color: C.platinumDim, fontSize: 12 }}>{dataset.unit}</span>
                  </div>
                </div>
                <div style={{
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: positive ? C.emeraldLight : C.roseLight,
                  border: `1px solid ${positive ? C.emerald : C.rose}50`,
                  background: positive ? `${C.emerald}20` : `${C.rose}20`,
                  borderRadius: 3,
                  padding: '4px 8px',
                  height: 'fit-content',
                }}>
                  {dataset.deltaPct >= 0 ? '+' : ''}{dataset.deltaPct}%
                </div>
              </div>

              <Spark values={dataset.values} color={dataset.color} anomalies={dataset.anomalies} />

              <div style={{ marginTop: 8, fontSize: 11, color: C.platinumMuted }}>
                {dataset.anomalies.length > 0
                  ? `${dataset.anomalies.length} anomaly signal(s) flagged in this window.`
                  : 'No anomaly signal in this metric window.'}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="fu4" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 22 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.platinumMuted, marginBottom: 14 }}>
            Anomaly Feed
          </div>
          {trend.anomalies.length === 0 && (
            <div style={{ fontSize: 12, color: C.creamDim }}>No high-risk anomalies detected in this range.</div>
          )}
          {trend.anomalies.slice(0, 4).map((item, index) => (
            <div key={`${item.metricKey}-${index}`} style={{
              border: `1px solid ${item.polarity === 'risk' ? C.rose : C.border}`,
              background: item.polarity === 'risk' ? `${C.rose}12` : C.lift,
              borderRadius: 5,
              padding: '10px 12px',
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.cream }}>{item.label}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: item.polarity === 'risk' ? C.roseLight : C.emeraldLight }}>
                  {item.deltaPct >= 0 ? '+' : ''}{item.deltaPct}%
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.platinumMuted }}>{item.explanation}</div>
            </div>
          ))}
        </div>

        <div className="fu5" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 22 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.platinumMuted, marginBottom: 14 }}>
            Intervention Notes
          </div>
          {trend.insights.map((insight, index) => (
            <div key={index} style={{
              borderLeft: `2px solid ${insight.tone === 'risk' ? C.roseLight : insight.tone === 'positive' ? C.gold : C.platinumDim}`,
              paddingLeft: 12,
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 12.5, color: C.cream, marginBottom: 4 }}>{insight.title}</div>
              <div style={{ fontSize: 11, color: C.creamDim, lineHeight: 1.65 }}>{insight.body}</div>
            </div>
          ))}
        </div>
      </div>

      <Rule style={{ margin: "26px 0 18px" }} />

      <div className="fu3" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.platinumMuted, marginBottom: 7 }}>
              Clinical Decision Layer
            </div>
            <div style={{ fontSize: 13, color: C.creamDim }}>
              Priority scoring, protocol generation, and export-ready daily plan.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onExportDailyPlan}
              disabled={!clinicalPlan || clinicalPlanBusy}
              style={{
                background: clinicalPlan && !clinicalPlanBusy ? `linear-gradient(135deg, ${C.gold}, ${C.goldDim})` : C.lift,
                border: `1px solid ${clinicalPlan && !clinicalPlanBusy ? C.gold : C.border}`,
                borderRadius: 5,
                color: clinicalPlan && !clinicalPlanBusy ? C.void : C.platinumMuted,
                padding: "9px 12px",
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                cursor: clinicalPlan && !clinicalPlanBusy ? "pointer" : "not-allowed",
                textTransform: "uppercase",
              }}
            >
              Export Daily Plan
            </button>
            <button
              onClick={onExportInvestorPack}
              disabled={!clinicalPlan || clinicalPlanBusy}
              style={{
                background: "transparent",
                border: `1px solid ${clinicalPlan && !clinicalPlanBusy ? C.goldBorder : C.border}`,
                borderRadius: 5,
                color: clinicalPlan && !clinicalPlanBusy ? C.gold : C.platinumMuted,
                padding: "9px 12px",
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                cursor: clinicalPlan && !clinicalPlanBusy ? "pointer" : "not-allowed",
                textTransform: "uppercase",
              }}
            >
              Investor Pack
            </button>
          </div>
        </div>

        {clinicalPlanBusy && (
          <div style={{ fontSize: 12, color: C.platinumMuted, marginBottom: 10 }}>
            Building server-grade protocol...
          </div>
        )}

        {clinicalPlanError && (
          <div style={{ fontSize: 12, color: C.roseLight, marginBottom: 10 }}>
            {clinicalPlanError}
          </div>
        )}

        {!clinicalPlan && (
          <div style={{ fontSize: 12, color: C.platinumMuted }}>
            Daily plan will appear after biometric data is available.
          </div>
        )}

        {clinicalPlan && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: "10px 12px", background: C.lift }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted, letterSpacing: "0.1em" }}>Risk Score</div>
                <div style={{ fontFamily: F.display, fontSize: 28, color: C.cream }}>{clinicalPlan.riskScore}<span style={{ fontSize: 12, color: C.platinumDim }}>/100</span></div>
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: "10px 12px", background: C.lift }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted, letterSpacing: "0.1em" }}>Readiness</div>
                <div style={{ fontFamily: F.display, fontSize: 28, color: C.cream }}>{clinicalPlan.readinessScore}<span style={{ fontSize: 12, color: C.platinumDim }}>/100</span></div>
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: "10px 12px", background: C.lift }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted, letterSpacing: "0.1em" }}>Strategy</div>
                <div style={{ fontSize: 16, color: C.gold, marginTop: 6 }}>{clinicalPlan.tier}</div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: C.creamDim, lineHeight: 1.7, marginBottom: 12 }}>
              {clinicalPlan.summary}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ border: `1px solid ${safety?.blockedCount > 0 ? C.rose : C.border}`, borderRadius: 5, padding: "10px 12px", background: C.lift }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted, letterSpacing: "0.1em", marginBottom: 7 }}>
                  Safety Envelope
                </div>
                <div style={{ fontSize: 12, color: safety?.status === "guarded" ? C.roseLight : safety?.status === "conservative" ? C.gold : C.emeraldLight, marginBottom: 6 }}>
                  {String(safety?.status || "clear").toUpperCase()}
                </div>
                <div style={{ fontSize: 11, color: C.creamDim, lineHeight: 1.6 }}>
                  {safety?.blockedCount || 0} blocked, {safety?.downgradedCount || 0} downgraded for safety.
                </div>
              </div>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: "10px 12px", background: C.lift }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted, letterSpacing: "0.1em", marginBottom: 7 }}>
                  Contraindication Profile
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                  {[
                    { key: "avoidHighIntensity", label: "Avoid High Intensity" },
                    { key: "avoidColdExposure", label: "Avoid Cold Exposure" },
                    { key: "avoidBreathwork", label: "Avoid Breathwork Strain" },
                    { key: "recentInjury", label: "Recent Injury" },
                    { key: "clinicianOverride", label: "Clinician Override" },
                  ].map((item) => (
                    <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: C.creamDim }}>
                      <input
                        type="checkbox"
                        checked={Boolean(contraindications?.[item.key])}
                        onChange={(e) => onContraindicationChange?.(item.key, e.target.checked)}
                        disabled={contraindicationBusy}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
                <button
                  onClick={onSaveContraindications}
                  disabled={contraindicationBusy}
                  style={{
                    background: contraindicationBusy ? C.surface : `${C.gold}20`,
                    border: `1px solid ${contraindicationBusy ? C.border : C.goldBorder}`,
                    color: contraindicationBusy ? C.platinumMuted : C.gold,
                    borderRadius: 4,
                    padding: "6px 9px",
                    fontFamily: F.mono,
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    cursor: contraindicationBusy ? "not-allowed" : "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  {contraindicationBusy ? "Saving..." : "Apply Safety Profile"}
                </button>
              </div>
            </div>

            {contraindicationError && (
              <div style={{ fontSize: 11, color: C.roseLight, marginBottom: 10 }}>
                {contraindicationError}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: "10px 12px", background: C.lift }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted, letterSpacing: "0.1em", marginBottom: 7 }}>
                  Change Intelligence
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.gold }}>
                    v{changeIntelligence?.latestVersion ?? "-"}
                  </span>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted }}>
                    prev v{changeIntelligence?.previousVersion ?? "-"}
                  </span>
                  <span style={{ fontFamily: F.mono, fontSize: 9, color: C.creamDim }}>
                    {reasonLabel}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.creamDim, lineHeight: 1.6 }}>
                  {(changeIntelligence?.summary?.addedActions || 0)} added, {(changeIntelligence?.summary?.removedActions || 0)} removed, {(changeIntelligence?.summary?.modifiedActions || 0)} modified actions.
                </div>
                <div style={{ fontSize: 11, color: C.creamDim, lineHeight: 1.6 }}>
                  Risk {changeIntelligence?.summary?.riskDelta >= 0 ? "+" : ""}{changeIntelligence?.summary?.riskDelta || 0}, readiness {changeIntelligence?.summary?.readinessDelta >= 0 ? "+" : ""}{changeIntelligence?.summary?.readinessDelta || 0}.
                </div>
              </div>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: 5, padding: "10px 12px", background: C.lift }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted, letterSpacing: "0.1em", marginBottom: 7 }}>
                  Version History
                </div>
                {versionHistory.slice(0, 4).map((item) => (
                  <div key={item.id || item.versionNumber} style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 6 }}>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.gold }}>v{item.versionNumber}</span>
                    <span style={{ fontSize: 10.5, color: C.creamDim }}>
                      {String(item.reason || "unknown").replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
                {versionHistory.length === 0 && (
                  <div style={{ fontSize: 11, color: C.platinumMuted }}>
                    Version snapshots will appear after protocol generation.
                  </div>
                )}
              </div>
            </div>

            <div style={{ border: `1px solid ${adherence?.status === "critical" ? C.rose : adherence?.status === "at_risk" ? C.goldBorder : C.border}`, borderRadius: 5, padding: "10px 12px", background: C.lift, marginBottom: 10 }}>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted, letterSpacing: "0.1em", marginBottom: 7 }}>
                Adherence Intelligence
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted }}>Score</div>
                  <div style={{ fontSize: 16, color: adherence?.score >= 80 ? C.emeraldLight : adherence?.score >= 65 ? C.gold : C.roseLight }}>
                    {adherence?.score ?? "--"}<span style={{ fontSize: 11, color: C.platinumMuted }}>/100</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted }}>Trend</div>
                  <div style={{ fontSize: 16, color: (adherence?.trendDelta || 0) >= 0 ? C.emeraldLight : C.roseLight }}>
                    {(adherence?.trendDelta || 0) >= 0 ? "+" : ""}{adherence?.trendDelta || 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted }}>Recovery Debt</div>
                  <div style={{ fontSize: 16, color: C.cream }}>{adherence?.recoveryDebt ?? "--"}</div>
                </div>
                <div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted }}>Projected Risk</div>
                  <div style={{ fontSize: 16, color: (adherence?.projectedRiskDelta || 0) > 0 ? C.roseLight : C.emeraldLight }}>
                    {(adherence?.projectedRiskDelta || 0) > 0 ? "+" : ""}{adherence?.projectedRiskDelta || 0}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.creamDim, lineHeight: 1.6 }}>
                {adherence?.summary || "Adherence analysis updates as protocol completions accumulate."}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {clinicalPlan.protocol.slice(0, 6).map((item, index) => (
                <div
                  key={item.id || `${item.title}-${index}`}
                  style={{
                    border: `1px solid ${item.blocked ? C.rose : item.done ? C.emerald : C.border}`,
                    borderRadius: 5,
                    padding: "10px 12px",
                    background: C.lift,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, color: C.cream }}>{item.title}</span>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: item.priority === "critical" ? C.roseLight : C.gold, marginLeft: 8 }}>
                      {item.priority.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 9, color: C.platinumMuted, marginBottom: 6 }}>{item.window}</div>
                  <div style={{ fontSize: 11, color: C.platinumDim, marginBottom: 5 }}>{item.objective}</div>
                  <div style={{ fontSize: 11, color: C.creamDim, lineHeight: 1.6 }}>{item.prescription}</div>
                  {item.blocked && (
                    <div style={{ fontSize: 10, color: C.roseLight, marginTop: 8 }}>
                      {item.blockedReason || "Blocked by safety profile."}
                    </div>
                  )}
                  {!item.blocked && item.adherenceWarning && (
                    <div style={{
                      fontSize: 10,
                      marginTop: 8,
                      color: item.adherenceSeverity === "high"
                        ? C.roseLight
                        : item.adherenceSeverity === "medium"
                          ? C.gold
                          : C.platinumMuted,
                    }}>
                      {item.adherenceWarning}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: item.blocked ? C.roseLight : item.done ? C.emeraldLight : C.platinumMuted }}>
                      {item.blocked ? "BLOCKED" : item.done ? "COMPLETED" : "OPEN"}
                    </span>
                    <button
                      onClick={() => onToggleClinicalAction?.(clinicalPlan.id, item.actionIndex ?? index, !item.done)}
                      disabled={clinicalActionBusy || item.blocked}
                      style={{
                        background: item.blocked
                          ? "transparent"
                          : item.done
                            ? "transparent"
                            : `${C.gold}20`,
                        border: `1px solid ${item.blocked ? C.rose : item.done ? C.border : C.goldBorder}`,
                        color: item.blocked ? C.roseLight : item.done ? C.platinumMuted : C.gold,
                        borderRadius: 4,
                        padding: "6px 9px",
                        fontFamily: F.mono,
                        fontSize: 9,
                        letterSpacing: "0.08em",
                        cursor: clinicalActionBusy || item.blocked ? "not-allowed" : "pointer",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.blocked ? "Unavailable" : item.done ? "Undo" : "Mark Done"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Nutrition = () => (
  <div style={{ padding:"40px 36px", maxWidth:1140, margin:"0 auto" }}>
    <div className="fu" style={{ marginBottom:36 }}>
      <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.2em",
        textTransform:"uppercase", color:C.platinumMuted, marginBottom:10 }}>Biochemical Nutrition Protocol</div>
      <h2 style={{ fontFamily:F.display, fontSize:38, fontWeight:400,
        color:C.cream, marginBottom:12 }}>Precision Fueling</h2>
      <p style={{ color:C.creamDim, fontSize:13.5, fontWeight:300,
        lineHeight:1.8, maxWidth:600 }}>
        Macronutrient targets, meal architecture, and supplement protocols calibrated to your HRV of 67ms, sleep efficiency of 83%, and readiness score of 91 - not a generic calculator.
      </p>
    </div>

    <Rule style={{ marginBottom:32 }} />

    <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16, marginBottom:16 }}>
      {/* Macro Targets */}
      <div className="fu1" style={{ background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:6, padding:28 }}>
        <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
          textTransform:"uppercase", color:C.platinumMuted, marginBottom:18 }}>Daily Macronutrient Targets</div>
        {[
          { label:"Protein",      current:96,   target:182, unit:"g",   color:C.gold,
            science:"At 91 readiness with high HRV, mTOR sensitivity is elevated. 182g ensures leucine threshold (3.1g/meal) is met across all three meals. Distribute evenly - not front-loaded." },
          { label:"Carbohydrates",current:140,  target:240, unit:"g",   color:C.sapphireLight,
            science:"Time 60% of carbs within a 90-min window post-training for maximal GLUT4 translocation and muscle glycogen repletion. Avoid >30g in a single bolus outside that window." },
          { label:"Healthy Fats", current:52,   target:78,  unit:"g",   color:C.amber,
            science:"Target EPA:AA ratio >1.5 for systemic anti-inflammatory effect. Prioritise wild salmon, sardines, and olive oil. Avoid refined seed oils at all meals today." },
          { label:"Hydration",    current:1800, target:3200,unit:"ml",  color:C.emeraldLight,
            science:"Add 500ml per hour of training above 65% HRmax. Include 3-4g sodium and 2g potassium to prevent dilutional hyponatremia and optimise cellular hydration." },
          { label:"Fibre",        current:18,   target:35,  unit:"g",   color:"#9B59B6",
            science:"Fibre diversity drives microbiome richness. Target 30+ distinct plant foods per week. Today, include leeks, dark berries, and cruciferous vegetables." },
        ].map((item, i) => (
          <div key={i} style={{ marginBottom:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:13, color:C.cream, fontWeight:400 }}>{item.label}</span>
              <span style={{ fontFamily:F.mono, fontSize:10, color:item.color }}>
                {item.current} / {item.target}{item.unit}
              </span>
            </div>
            <div style={{ height:4, background:C.border, borderRadius:2, marginBottom:8 }}>
              <div style={{ height:"100%", borderRadius:2, transition:"width .8s cubic-bezier(.16,1,.3,1)",
                width:`${Math.min((item.current/item.target)*100,100)}%`,
                background:`linear-gradient(90deg, ${item.color}70, ${item.color})` }} />
            </div>
            <div style={{ fontSize:11, color:C.platinumMuted, lineHeight:1.6 }}>{item.science}</div>
          </div>
        ))}
      </div>

      {/* Supplement Stack */}
      <div className="fu2" style={{ background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:6, padding:28 }}>
        <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
          textTransform:"uppercase", color:C.platinumMuted, marginBottom:18 }}>
          Evidence-Based Supplement Protocol
        </div>
        {[
          { name:"Vitamin D3 + K2",          dose:"5,000 IU + 200mcg MK-7",  timing:"Morning with fat",    done:true,  why:"Immune function, hormonal baseline, and endothelial health. K2 directs calcium to bone, not arteries." },
          { name:"Creatine Monohydrate",      dose:"5g",                       timing:"Post-training",       done:true,  why:"Phosphocreatine resynthesis + neurological ATP support. Also increases BDNF. Non-cycling protocol." },
          { name:"Omega-3 EPA/DHA",           dose:"2g EPA, 1g DHA",           timing:"Largest meal",        done:false, why:"Resolves systemic inflammation via SPM synthesis. Target EPA:AA ratio >1.5 for meaningful effect." },
          { name:"Magnesium Glycinate",       dose:"400mg",                    timing:"Evening, 60 min pre-bed",done:false,why:"Upregulates GABA-A receptors. Improves slow-wave sleep depth and reduces nocturnal cortisol spikes." },
          { name:"L-Theanine",               dose:"200mg",                    timing:"14:00",               done:false, why:"Alpha wave induction without sedation. Attenuates afternoon cortisol decline-related cognitive dip." },
          { name:"Phosphatidylserine",        dose:"300mg",                    timing:"Pre-training",        done:false, why:"Blunts exercise-induced cortisol spike by ~30%. Preserves anabolic testosterone response post-session." },
          { name:"Zinc Bisglycinate",         dose:"25mg",                     timing:"Evening with food",   done:false, why:"Cofactor in 300+ enzymatic reactions. Critical for testosterone synthesis and immune cell proliferation." },
        ].map((item, i) => (
          <div key={i} style={{
            padding:"13px 14px", borderRadius:5, marginBottom:9,
            background: item.done ? `${C.gold}07` : C.lift,
            border:`1px solid ${item.done ? C.goldBorder : C.border}`,
          }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12.5, color:C.cream, fontWeight:400,
                  marginBottom:2 }}>{item.name}</div>
                <div style={{ fontFamily:F.mono, fontSize:9, color:item.done ? C.gold : C.platinumMuted }}>
                  {item.dose} | {item.timing}
                </div>
              </div>
              <div style={{ fontFamily:F.mono, fontSize:9,
                color: item.done ? C.emeraldLight : C.platinumMuted,
                marginLeft:10, flexShrink:0 }}>
                {item.done ? "DONE" : "PENDING"}
              </div>
            </div>
            <div style={{ fontSize:10.5, color:C.platinumMuted, lineHeight:1.55 }}>{item.why}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Meal Architecture */}
    <div className="fu3" style={{ background:C.surface, border:`1px solid ${C.border}`,
      borderRadius:6, padding:28 }}>
      <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
        textTransform:"uppercase", color:C.platinumMuted, marginBottom:18 }}>
        Meal Architecture - Today
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
        {[
          {
            time:"07:30",  label:"Metabolic Activation",
            foods:["4 eggs (2 whole, 2 whites) - 28g protein","100g smoked wild salmon - EPA/DHA load","1/2 avocado - monounsaturated fats","Black coffee (no additives) - dopamine precursors"],
            kcal:480, protein:46, note:"Protein-dominant. No glycaemic spike. Catecholamine-supportive foods align with cortisol peak window. Dopamine precursors (tyrosine in salmon/eggs) prime the prefrontal cortex.",
            c:C.gold,
          },
          {
            time:"13:00",  label:"Peak Fuel Window",
            foods:["200g grass-fed ribeye or wild salmon","Large sweet potato (200g) - complex carbs","Broccoli + kale - DIM, sulforaphane","Olive oil + lemon dressing - polyphenols"],
            kcal:720, protein:52, note:"Leucine threshold exceeded. Complex carbs refuel muscle glycogen post-morning session. Cruciferous vegetables support oestrogen metabolism and liver detoxification.",
            c:C.sapphireLight,
          },
          {
            time:"19:30",  label:"Recovery & Consolidation",
            foods:["Slow-braised protein (lamb or chicken thigh)","White rice or sourdough - glycaemic index moderate","Kefir or kimchi - microbiome support","Chamomile or ashwagandha tea - cortisol attenuation"],
            kcal:640, protein:44, note:"Tryptophan-rich foods raise serotonin, the precursor to melatonin. Fermented foods maintain gut-brain axis integrity. Ashwagandha reduces evening cortisol by up to 27%.",
            c:C.emeraldLight,
          },
        ].map((meal, i) => (
          <div key={i} style={{ background:C.lift, border:`1px solid ${C.border}`,
            borderRadius:5, padding:20, borderTop:`2px solid ${meal.c}40` }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:14 }}>
              <div style={{ fontFamily:F.mono, fontSize:9, color:meal.c,
                letterSpacing:"0.12em" }}>{meal.time}</div>
              <Tag>{meal.label}</Tag>
            </div>
            {meal.foods.map((f, j) => (
              <div key={j} style={{ fontSize:11.5, color:C.creamDim, marginBottom:6,
                paddingLeft:12, borderLeft:`2px solid ${meal.c}40`, lineHeight:1.5 }}>{f}</div>
            ))}
            <div style={{ display:"flex", gap:16, margin:"14px 0 10px",
              paddingTop:10, borderTop:`1px solid ${C.border}` }}>
              <div>
                <div style={{ fontFamily:F.mono, fontSize:9, color:C.platinumMuted }}>KCAL</div>
                <div style={{ fontFamily:F.display, fontSize:18, color:meal.c }}>{meal.kcal}</div>
              </div>
              <div>
                <div style={{ fontFamily:F.mono, fontSize:9, color:C.platinumMuted }}>PROTEIN</div>
                <div style={{ fontFamily:F.display, fontSize:18, color:C.cream }}>{meal.protein}g</div>
              </div>
            </div>
            <div style={{ fontSize:11, color:C.platinumMuted, lineHeight:1.65 }}>{meal.note}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// PAGE: ENTERPRISE
const Enterprise = ({
  platformSummary = null,
  platformBusy = false,
  platformError = "",
  onRefreshPlatform,
  evidenceConsole = null,
  evidenceBusy = false,
  evidenceError = "",
  onRefreshEvidence,
  onCreateClinicalStudy,
  onUpdateClinicalStudy,
  onCreateRegulatoryArtifact,
  onUpdateRegulatoryArtifact,
  billingOverview = null,
  billingBusy = false,
  billingError = "",
  onChangePlan,
  clinicianNotes = [],
  clinicianBusy = false,
  clinicianError = "",
  onQuickClinicianNote,
  onSignoffClinicianNote,
  complianceConsent = null,
  hipaaAttestation = null,
  baaRequests = [],
  deletionRequests = [],
  complianceBusy = false,
  complianceError = "",
  onRefreshCompliance,
  onToggleComplianceConsent,
  onApplyHipaaAttestation,
  onCreateBaaRequest,
  onUpdateBaaRequestStatus,
  onRequestDeletion,
  onDownloadAuditBundle,
  opsStatus = null,
  opsBusy = false,
  opsError = "",
  onRefreshOps,
  clinicalPlan = null,
  activePlan = "free",
}) => {
  const cohort = platformSummary?.cohort || {};
  const roi = platformSummary?.roi || {};
  const clinicianOps = platformSummary?.clinicianOps || {};
  const interventions = platformSummary?.interventions || {};
  const reliability = platformSummary?.reliability || {};
  const monetization = platformSummary?.monetization || {};
  const traction = platformSummary?.traction || {};
  const clinicalValidation = platformSummary?.clinicalValidation || {};
  const regulatory = platformSummary?.regulatory || {};
  const currentPlan = String(billingOverview?.plan || activePlan || "free").toUpperCase();
  const enterpriseErrors = useMemo(() => {
    const unique = new Map();
    [
      platformError,
      evidenceError,
      billingError,
      clinicianError,
      complianceError,
      opsError,
    ]
      .map((message) => toEnterpriseErrorMessage(message))
      .filter(Boolean)
      .forEach((message) => {
        const key = normalizeErrorText(message).toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, message);
        }
      });
    return Array.from(unique.values());
  }, [
    platformError,
    evidenceError,
    billingError,
    clinicianError,
    complianceError,
    opsError,
  ]);
  const consent = complianceConsent || {};
  const hipaa = hipaaAttestation || {};
  const deploymentStatus = String(opsStatus?.status || "unknown").toUpperCase();
  const [hipaaDraft, setHipaaDraft] = useState({
    organizationName: "",
    attestedBy: "",
    attestorRole: "",
    contactEmail: "",
    securityRuleAcknowledged: false,
    privacyRuleAcknowledged: false,
    breachRuleAcknowledged: false,
    minimumNecessaryAcknowledged: false,
    baaRequired: false,
  });
  const [baaDraft, setBaaDraft] = useState({
    organizationName: "",
    contactEmail: "",
    requestedBy: "",
    requestNote: "",
  });
  const [baaLegalNotes, setBaaLegalNotes] = useState({});
  const [studyDraft, setStudyDraft] = useState({
    studyCode: "",
    title: "",
    status: "planned",
    externalPartner: "",
    principalInvestigator: "",
    cohortSizeTarget: "",
    primaryEndpoint: "",
  });
  const [artifactDraft, setArtifactDraft] = useState({
    artifactKey: "",
    title: "",
    owner: "",
    status: "draft",
    version: "0.1.0",
    critical: false,
  });
  const [studyEdits, setStudyEdits] = useState({});
  const [artifactEdits, setArtifactEdits] = useState({});
  const evidenceStudies = useMemo(
    () => (Array.isArray(evidenceConsole?.clinicalStudies) ? evidenceConsole.clinicalStudies : []),
    [evidenceConsole?.clinicalStudies]
  );
  const evidenceArtifacts = useMemo(
    () => (Array.isArray(evidenceConsole?.regulatoryArtifacts) ? evidenceConsole.regulatoryArtifacts : []),
    [evidenceConsole?.regulatoryArtifacts]
  );
  const evidenceClinicalSummary = evidenceConsole?.summaries?.clinicalValidation || {};
  const evidenceRegulatorySummary = evidenceConsole?.summaries?.regulatory || {};

  useEffect(() => {
    const source = hipaaAttestation || {};

    setHipaaDraft((prev) => ({
      ...prev,
      organizationName: source.organizationName || "",
      attestedBy: source.attestedBy || "",
      attestorRole: source.attestorRole || "",
      contactEmail: source.contactEmail || "",
      securityRuleAcknowledged: Boolean(source.securityRuleAcknowledged),
      privacyRuleAcknowledged: Boolean(source.privacyRuleAcknowledged),
      breachRuleAcknowledged: Boolean(source.breachRuleAcknowledged),
      minimumNecessaryAcknowledged: Boolean(source.minimumNecessaryAcknowledged),
      baaRequired: Boolean(source.baaRequired),
    }));

    setBaaDraft((prev) => ({
      ...prev,
      organizationName: source.organizationName || prev.organizationName || "",
      contactEmail: source.contactEmail || prev.contactEmail || "",
      requestedBy: source.attestedBy || prev.requestedBy || "",
    }));
  }, [hipaaAttestation]);

  useEffect(() => {
    const nextStudyEdits = {};
    evidenceStudies.forEach((study) => {
      nextStudyEdits[study.id] = {
        status: study.status || "planned",
        cohortSizeEnrolled: String(study.cohortSizeEnrolled ?? ""),
        endpointAchieved: Boolean(study.endpointAchieved),
        notes: study.notes || "",
      };
    });
    setStudyEdits(nextStudyEdits);

    const nextArtifactEdits = {};
    evidenceArtifacts.forEach((artifact) => {
      nextArtifactEdits[artifact.id] = {
        status: artifact.status || "draft",
        owner: artifact.owner || "",
        version: artifact.version || "",
        critical: Boolean(artifact.critical),
      };
    });
    setArtifactEdits(nextArtifactEdits);
  }, [evidenceStudies, evidenceArtifacts]);

  const updateHipaaDraft = (field, value) => {
    setHipaaDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateBaaDraft = (field, value) => {
    setBaaDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateBaaLegalNote = (requestId, value) => {
    setBaaLegalNotes((prev) => ({
      ...prev,
      [requestId]: value,
    }));
  };

  const updateStudyDraft = (field, value) => {
    setStudyDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateArtifactDraft = (field, value) => {
    setArtifactDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateStudyEdit = (studyId, field, value) => {
    setStudyEdits((prev) => ({
      ...prev,
      [studyId]: {
        ...(prev[studyId] || {}),
        [field]: value,
      },
    }));
  };

  const updateArtifactEdit = (artifactId, field, value) => {
    setArtifactEdits((prev) => ({
      ...prev,
      [artifactId]: {
        ...(prev[artifactId] || {}),
        [field]: value,
      },
    }));
  };

  const submitHipaaAttestation = () => {
    onApplyHipaaAttestation?.({
      attestationVersion: "2026.1",
      organizationName: hipaaDraft.organizationName.trim(),
      attestedBy: hipaaDraft.attestedBy.trim(),
      attestorRole: hipaaDraft.attestorRole.trim(),
      contactEmail: hipaaDraft.contactEmail.trim(),
      securityRuleAcknowledged: Boolean(hipaaDraft.securityRuleAcknowledged),
      privacyRuleAcknowledged: Boolean(hipaaDraft.privacyRuleAcknowledged),
      breachRuleAcknowledged: Boolean(hipaaDraft.breachRuleAcknowledged),
      minimumNecessaryAcknowledged: Boolean(hipaaDraft.minimumNecessaryAcknowledged),
      baaRequired: Boolean(hipaaDraft.baaRequired),
    });
  };

  const submitBaaRequest = () => {
    onCreateBaaRequest?.({
      organizationName: (baaDraft.organizationName || hipaaDraft.organizationName).trim(),
      contactEmail: (baaDraft.contactEmail || hipaaDraft.contactEmail).trim(),
      requestedBy: (baaDraft.requestedBy || hipaaDraft.attestedBy).trim(),
      requestNote: baaDraft.requestNote.trim(),
    });
  };

  const submitClinicalStudy = () => {
    onCreateClinicalStudy?.({
      studyCode: studyDraft.studyCode.trim(),
      title: studyDraft.title.trim(),
      status: studyDraft.status,
      externalPartner: studyDraft.externalPartner.trim(),
      principalInvestigator: studyDraft.principalInvestigator.trim(),
      cohortSizeTarget: studyDraft.cohortSizeTarget === "" ? null : Number(studyDraft.cohortSizeTarget),
      primaryEndpoint: studyDraft.primaryEndpoint.trim(),
    });
    setStudyDraft({
      studyCode: "",
      title: "",
      status: "planned",
      externalPartner: "",
      principalInvestigator: "",
      cohortSizeTarget: "",
      primaryEndpoint: "",
    });
  };

  const saveClinicalStudy = (studyId) => {
    const edit = studyEdits?.[studyId] || {};
    onUpdateClinicalStudy?.({
      studyId,
      payload: {
        status: edit.status || "planned",
        cohortSizeEnrolled: edit.cohortSizeEnrolled === "" ? 0 : Number(edit.cohortSizeEnrolled),
        endpointAchieved: Boolean(edit.endpointAchieved),
        notes: String(edit.notes || "").trim(),
      },
    });
  };

  const submitRegulatoryArtifact = () => {
    onCreateRegulatoryArtifact?.({
      artifactKey: artifactDraft.artifactKey.trim(),
      title: artifactDraft.title.trim(),
      owner: artifactDraft.owner.trim(),
      status: artifactDraft.status,
      version: artifactDraft.version.trim(),
      critical: Boolean(artifactDraft.critical),
    });
    setArtifactDraft({
      artifactKey: "",
      title: "",
      owner: "",
      status: "draft",
      version: "0.1.0",
      critical: false,
    });
  };

  const saveRegulatoryArtifact = (artifactId) => {
    const edit = artifactEdits?.[artifactId] || {};
    onUpdateRegulatoryArtifact?.({
      artifactId,
      payload: {
        status: edit.status || "draft",
        owner: String(edit.owner || "").trim(),
        version: String(edit.version || "").trim(),
        critical: Boolean(edit.critical),
      },
    });
  };

  const submitBaaLegalReview = (requestId, status) => {
    onUpdateBaaRequestStatus?.({
      requestId,
      status,
      legalNote: String(baaLegalNotes?.[requestId] || "").trim(),
    });
  };

  const baaPending = (baaRequests || []).some((item) => (
    ["requested", "in_review"].includes(String(item?.status || "").toLowerCase())
  ));
  const hipaaComplete = Boolean(hipaa?.attestedAt);
  const baaStatusKey = String(hipaa?.baaStatus || "not_required").toLowerCase();
  const baaStatusColor = baaStatusKey === "executed"
    ? C.emeraldLight
    : baaStatusKey === "declined"
      ? C.roseLight
      : baaStatusKey === "in_review"
        ? C.sapphireLight
        : baaStatusKey === "requested"
          ? C.gold
          : C.platinumDim;
  const baaCanReview = (status) => (
    ["requested", "in_review"].includes(String(status || "").toLowerCase())
  );
  const refreshPremiumCommand = () => {
    onRefreshPlatform?.();
    onRefreshEvidence?.();
    onRefreshCompliance?.();
    onRefreshOps?.();
  };

  return (
    <div style={{ padding:"40px 36px", maxWidth:1140, margin:"0 auto" }}>
      <div className="fu" style={{ marginBottom:36 }}>
        <Tag>Enterprise Platform</Tag>
        <h2 style={{ fontFamily:F.display, fontSize:38, fontWeight:400,
          color:C.cream, marginTop:16, marginBottom:12 }}>
          Corporate Health Intelligence
        </h2>
        <p style={{ color:C.creamDim, fontSize:13.5, fontWeight:300,
          lineHeight:1.8, maxWidth:620 }}>
          Operational command center for cohort outcomes, ROI, clinician signoff, intervention effectiveness, reliability, and monetization.
        </p>
      </div>

      <Rule style={{ marginBottom:20 }} />

      <div className="fu1" style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:"18px 22px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", color:C.platinumMuted }}>
            Premium Layers Command
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <Tag variant="gold">Plan {currentPlan}</Tag>
            <button
              onClick={refreshPremiumCommand}
              disabled={platformBusy}
              style={{
                background: platformBusy ? C.lift : "transparent",
                border:`1px solid ${platformBusy ? C.border : C.goldBorder}`,
                borderRadius:4,
                color: platformBusy ? C.platinumMuted : C.gold,
                padding:"7px 10px",
                fontFamily:F.mono,
                fontSize:9,
                letterSpacing:"0.08em",
                textTransform:"uppercase",
                cursor: platformBusy ? "not-allowed" : "pointer",
              }}
            >
              {platformBusy ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {enterpriseErrors.map((message, index) => (
          <div key={`${message}-${index}`} style={{ fontSize:11, color:C.roseLight, marginBottom:8 }}>
            {message}
          </div>
        ))}

        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8 }}>
          {[
            { k:"Cohort", v:`${cohort.activeMembers || 0}`, s:`${cohort.engagementRate || 0}% engagement` },
            { k:"ROI", v:`${roi.projectedRoiX || 0}x`, s:`$${roi.costSavedPerMemberYear || 0}/member` },
            { k:"Clinician", v:`${clinicianOps.pendingSignoff || 0}`, s:"pending signoff" },
            { k:"Interventions", v:`${interventions.actionsAnalyzed || 0}`, s:"actions analyzed" },
            { k:"Reliability", v:`${reliability.dataQualityScore || 0}`, s:`${reliability.importFailureRatePct || 0}% fail` },
            { k:"Monetization", v:`$${monetization.mrrEstimate || 0}`, s:`${monetization.conversionRatePct || 0}% paid` },
          ].map((item, i) => (
            <div key={i} style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:5, padding:"10px 11px" }}>
              <div style={{ fontFamily:F.mono, fontSize:8.5, color:C.platinumMuted, letterSpacing:"0.1em", marginBottom:4 }}>{item.k}</div>
              <div style={{ fontFamily:F.display, fontSize:20, color:C.gold, lineHeight:1.1, marginBottom:3 }}>{item.v}</div>
              <div style={{ fontSize:10, color:C.platinumDim }}>{item.s}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:10 }}>
          <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:5, padding:"10px 11px" }}>
            <div style={{ fontFamily:F.mono, fontSize:8.5, color:C.platinumMuted, letterSpacing:"0.1em", marginBottom:4 }}>TRACTION</div>
            <div style={{ fontFamily:F.display, fontSize:18, color:C.gold, lineHeight:1.1, marginBottom:3 }}>
              {traction.paidMembers || 0} paid
            </div>
            <div style={{ fontSize:10, color:C.platinumDim }}>
              {traction.retention30Pct || 0}% retention | +${traction.expansionMrr90 || 0} / -${traction.contractionMrr90 || 0} (90d)
            </div>
          </div>
          <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:5, padding:"10px 11px" }}>
            <div style={{ fontFamily:F.mono, fontSize:8.5, color:C.platinumMuted, letterSpacing:"0.1em", marginBottom:4 }}>CLINICAL VALIDATION</div>
            <div style={{ fontFamily:F.display, fontSize:18, color:C.gold, lineHeight:1.1, marginBottom:3 }}>
              {clinicalValidation.active || 0} active | {clinicalValidation.completed || 0} complete
            </div>
            <div style={{ fontSize:10, color:C.platinumDim }}>
              {clinicalValidation.published || 0} published | {clinicalValidation.totalStudies || 0} tracked studies
            </div>
          </div>
          <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:5, padding:"10px 11px" }}>
            <div style={{ fontFamily:F.mono, fontSize:8.5, color:C.platinumMuted, letterSpacing:"0.1em", marginBottom:4 }}>REGULATORY PACKAGE</div>
            <div style={{ fontFamily:F.display, fontSize:18, color:C.gold, lineHeight:1.1, marginBottom:3 }}>
              {regulatory.readinessPct || 0}% ready
            </div>
            <div style={{ fontSize:10, color:C.platinumDim }}>
              {regulatory.approvedArtifacts || 0}/{regulatory.totalArtifacts || 0} approved | {regulatory.criticalOpen || 0} critical open
            </div>
          </div>
        </div>
      </div>

      {/* ROI Metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        {[
          { v:`${roi.riskReductionPct || 0}%`,    l:"Risk Reduction",          p:"last 60 days",     n:"Clinical risk trend movement from baseline to latest window." },
          { v:`+${roi.productivityGainPct || 0}%`, l:"Productivity Lift",       p:"projected",        n:"Derived from risk improvement + adherence engagement behavior." },
          { v:`$${roi.costSavedPerMemberYear || 0}`, l:"Cost Saved",             p:"per member/year",  n:"Composite healthcare + absenteeism avoidance model." },
          { v:`${roi.projectedRoiX || 0}x`,       l:"Projected ROI",            p:`confidence: ${roi.confidence || "n/a"}`, n:"Net return ratio against estimated platform operating cost." },
        ].map((item, i) => (
          <div key={i} className={`fu${i+1}`} style={{
            background:`linear-gradient(160deg, ${C.surface} 0%, ${C.lift} 100%)`,
            border:`1px solid ${C.goldBorder}`, borderRadius:6,
            padding:"24px", textAlign:"center",
          }}>
            <div style={{ fontFamily:F.display, fontSize:36,
              color:C.gold, lineHeight:1, marginBottom:8 }}>{item.v}</div>
            <div style={{ fontSize:12, color:C.cream, fontWeight:400, marginBottom:6 }}>{item.l}</div>
            <div style={{ fontSize:11, color:C.platinumDim, fontStyle:"italic", marginBottom:12 }}>{item.p}</div>
            <Rule style={{ marginBottom:12, opacity:.4 }} />
            <div style={{ fontSize:10.5, color:C.platinumMuted, lineHeight:1.6 }}>{item.n}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:16, marginBottom:16 }}>
        {/* Dashboard */}
        <div className="fu3" style={{ background:C.surface, border:`1px solid ${C.border}`,
          borderRadius:6, padding:28 }}>
          <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
            textTransform:"uppercase", color:C.platinumMuted, marginBottom:6 }}>
            Cohort Operations
          </div>
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", marginBottom:24 }}>
            <h3 style={{ fontFamily:F.display, fontSize:22, fontWeight:400, color:C.cream }}>
              Multi-Layer Execution Board
            </h3>
            <div style={{ fontFamily:F.mono, fontSize:9, color:C.emeraldLight,
              display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:5, height:5, borderRadius:"50%",
                background:C.emeraldLight, display:"inline-block", animation:"pulse 2s infinite" }} />
              LIVE
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
            gap:12, marginBottom:24 }}>
            {[
              { l:"Active Members", v:`${cohort.activeMembers || 0}`, c:C.cream },
              { l:"Avg Readiness", v:`${cohort.avgReadiness || 0}`, c:C.gold },
              { l:"High Risk", v:`${cohort.riskBands?.high || 0}`, c:C.roseLight },
              { l:"Engagement", v:`${cohort.engagementRate || 0}%`, c:C.emeraldLight },
            ].map((s, i) => (
              <div key={i} style={{ background:C.lift, borderRadius:5,
                border:`1px solid ${C.border}`, padding:"14px", textAlign:"center" }}>
                <div style={{ fontFamily:F.display, fontSize:24, color:s.c, marginBottom:4 }}>{s.v}</div>
                <div style={{ fontFamily:F.mono, fontSize:8.5, color:C.platinumMuted,
                  letterSpacing:"0.1em", textTransform:"uppercase" }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.12em",
            textTransform:"uppercase", color:C.platinumMuted, marginBottom:14 }}>
            Intervention Effectiveness (Top 5)
          </div>
          {(interventions.topActions || []).slice(0, 5).map((item, i) => (
            <div key={`${item.actionId}-${i}`} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <span style={{ fontSize:12.5, color:C.cream }}>{item.title}</span>
                <span style={{ fontFamily:F.mono, fontSize:10, color:C.gold }}>
                  {item.effectivenessScore} | {item.completionRate}% done
                </span>
              </div>
              <div style={{ height:3, background:C.border, borderRadius:2 }}>
                <div style={{ height:"100%", borderRadius:2, width:`${Math.min(100, item.effectivenessScore || 0)}%`, background:C.gold }} />
              </div>
            </div>
          ))}
          {(!interventions.topActions || interventions.topActions.length === 0) && (
            <div style={{ fontSize:11, color:C.platinumMuted }}>
              Intervention effectiveness will appear after more protocol completion events.
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="fu4" style={{ background:C.surface, border:`1px solid ${C.border}`,
          borderRadius:6, padding:28 }}>
          <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.16em",
            textTransform:"uppercase", color:C.platinumMuted, marginBottom:14 }}>
            Monetization Layer
          </div>
          <div style={{ fontSize:11, color:C.creamDim, marginBottom:12 }}>
            Paid users: {monetization.paidUsers || 0} | Conversion: {monetization.conversionRatePct || 0}%
          </div>
          {[
            { plan:"Free", target:"free", price:"$0", per:"starter", highlight:false },
            { plan:"Premium", target:"premium", price:"$29", per:"user / month", highlight:true },
            { plan:"Enterprise", target:"enterprise", price:"$99", per:"user / month", highlight:false },
          ].map((plan, i) => (
            <div key={i} style={{
              padding:"14px", borderRadius:5, marginBottom:10,
              background: plan.highlight ? `${C.gold}0C` : C.lift,
              border:`1px solid ${plan.highlight ? C.goldBorder : C.border}`,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:14, color:C.cream, fontWeight:500 }}>{plan.plan}</div>
                  <div style={{ fontFamily:F.mono, fontSize:9, color:C.platinumMuted }}>{plan.price} {plan.per}</div>
                </div>
                <button
                  onClick={() => onChangePlan?.(plan.target)}
                  disabled={billingBusy}
                  style={{
                    background:"transparent",
                    border:`1px solid ${C.goldBorder}`,
                    borderRadius:4,
                    color:C.gold,
                    padding:"6px 9px",
                    fontFamily:F.mono,
                    fontSize:9,
                    letterSpacing:"0.08em",
                    textTransform:"uppercase",
                    cursor: billingBusy ? "not-allowed" : "pointer",
                  }}
                >
                  {currentPlan === plan.target.toUpperCase() ? "Current" : "Switch"}
                </button>
              </div>
            </div>
          ))}
          <div style={{ fontSize:10.5, color:C.platinumMuted, lineHeight:1.6 }}>
            Wearable import remaining today: {billingOverview?.usage?.importsRemainingToday ?? "--"} / {billingOverview?.usage?.wearableImportsPerDay ?? "--"}
          </div>
        </div>
      </div>

      <div className="fu5" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:"18px 20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.14em", color:C.platinumMuted, textTransform:"uppercase" }}>
              Compliance Packaging
            </div>
            <button
              onClick={onRefreshCompliance}
              disabled={complianceBusy}
              style={{
                background:"transparent",
                border:`1px solid ${C.goldBorder}`,
                borderRadius:4,
                color:C.gold,
                padding:"6px 9px",
                fontFamily:F.mono,
                fontSize:8.5,
                letterSpacing:"0.08em",
                textTransform:"uppercase",
                cursor: complianceBusy ? "not-allowed" : "pointer",
              }}
            >
              {complianceBusy ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
            {[
              { key:"acceptedTerms", label:"Terms" },
              { key:"acceptedPrivacy", label:"Privacy" },
              { key:"acceptedClinicalDisclaimer", label:"Clinical Disclaimer" },
              { key:"acceptedMarketing", label:"Marketing" },
            ].map((item) => (
              <label key={item.key} style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:C.creamDim }}>
                <input
                  type="checkbox"
                  checked={Boolean(consent?.[item.key])}
                  onChange={(e) => onToggleComplianceConsent?.(item.key, e.target.checked)}
                  disabled={complianceBusy}
                />
                {item.label}
              </label>
            ))}
          </div>

          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <button
              onClick={onRequestDeletion}
              disabled={complianceBusy}
              style={{
                background:"transparent",
                border:`1px solid ${C.border}`,
                borderRadius:4,
                color:C.platinumDim,
                padding:"6px 8px",
                fontFamily:F.mono,
                fontSize:8.5,
                letterSpacing:"0.07em",
                textTransform:"uppercase",
                cursor: complianceBusy ? "not-allowed" : "pointer",
              }}
            >
              Request Deletion
            </button>
            <button
              onClick={onDownloadAuditBundle}
              disabled={complianceBusy}
              style={{
                background:`${C.gold}18`,
                border:`1px solid ${C.goldBorder}`,
                borderRadius:4,
                color:C.gold,
                padding:"6px 8px",
                fontFamily:F.mono,
                fontSize:8.5,
                letterSpacing:"0.07em",
                textTransform:"uppercase",
                cursor: complianceBusy ? "not-allowed" : "pointer",
              }}
            >
              Export Audit Bundle
            </button>
          </div>

          <div style={{ fontSize:10.5, color:C.platinumMuted, lineHeight:1.6 }}>
            Consent version {consent?.consentVersion || "1.0.0"} | Last consented {consent?.consentedAt ? formatRecordedStamp(consent.consentedAt) : "not completed"}
          </div>
          <div style={{ marginTop:8, fontSize:10.5, color:C.platinumMuted }}>
            Deletion requests: {(deletionRequests || []).length}
          </div>
          {(deletionRequests || []).slice(0, 2).map((item) => (
            <div key={item.id} style={{ fontSize:10, color:C.creamDim, marginTop:4 }}>
              {String(item.status || "").toUpperCase()} | {item.requestedAt ? formatRecordedStamp(item.requestedAt) : "N/A"}
            </div>
          ))}

          <Rule style={{ marginTop:14, marginBottom:12, opacity:.35 }} />

          <div style={{ fontFamily:F.mono, fontSize:8.5, color:C.platinumMuted, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>
            HIPAA Attestation + BAA
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <input
              value={hipaaDraft.organizationName}
              onChange={(e) => updateHipaaDraft("organizationName", e.target.value)}
              placeholder="Organization name"
              disabled={complianceBusy}
              style={{
                background:C.lift,
                border:`1px solid ${C.border}`,
                borderRadius:4,
                color:C.cream,
                padding:"7px 9px",
                fontSize:10.5,
              }}
            />
            <input
              value={hipaaDraft.contactEmail}
              onChange={(e) => updateHipaaDraft("contactEmail", e.target.value)}
              placeholder="Compliance email"
              disabled={complianceBusy}
              style={{
                background:C.lift,
                border:`1px solid ${C.border}`,
                borderRadius:4,
                color:C.cream,
                padding:"7px 9px",
                fontSize:10.5,
              }}
            />
            <input
              value={hipaaDraft.attestedBy}
              onChange={(e) => updateHipaaDraft("attestedBy", e.target.value)}
              placeholder="Attested by"
              disabled={complianceBusy}
              style={{
                background:C.lift,
                border:`1px solid ${C.border}`,
                borderRadius:4,
                color:C.cream,
                padding:"7px 9px",
                fontSize:10.5,
              }}
            />
            <input
              value={hipaaDraft.attestorRole}
              onChange={(e) => updateHipaaDraft("attestorRole", e.target.value)}
              placeholder="Attestor role"
              disabled={complianceBusy}
              style={{
                background:C.lift,
                border:`1px solid ${C.border}`,
                borderRadius:4,
                color:C.cream,
                padding:"7px 9px",
                fontSize:10.5,
              }}
            />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8 }}>
            {[
              { key:"securityRuleAcknowledged", label:"Security Rule" },
              { key:"privacyRuleAcknowledged", label:"Privacy Rule" },
              { key:"breachRuleAcknowledged", label:"Breach Notification Rule" },
              { key:"minimumNecessaryAcknowledged", label:"Minimum Necessary Standard" },
            ].map((item) => (
              <label key={item.key} style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:C.creamDim }}>
                <input
                  type="checkbox"
                  checked={Boolean(hipaaDraft?.[item.key])}
                  onChange={(e) => updateHipaaDraft(item.key, e.target.checked)}
                  disabled={complianceBusy}
                />
                {item.label}
              </label>
            ))}
          </div>

          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, color:C.creamDim, marginBottom:8 }}>
            <input
              type="checkbox"
              checked={Boolean(hipaaDraft?.baaRequired)}
              onChange={(e) => updateHipaaDraft("baaRequired", e.target.checked)}
              disabled={complianceBusy}
            />
            BAA required for this workspace
          </label>

          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            <button
              onClick={submitHipaaAttestation}
              disabled={complianceBusy}
              style={{
                background:`${C.gold}18`,
                border:`1px solid ${C.goldBorder}`,
                borderRadius:4,
                color:C.gold,
                padding:"6px 8px",
                fontFamily:F.mono,
                fontSize:8.5,
                letterSpacing:"0.07em",
                textTransform:"uppercase",
                cursor: complianceBusy ? "not-allowed" : "pointer",
              }}
            >
              Apply HIPAA Attestation
            </button>
            <button
              onClick={submitBaaRequest}
              disabled={complianceBusy || baaPending}
              style={{
                background:"transparent",
                border:`1px solid ${C.border}`,
                borderRadius:4,
                color:baaPending ? C.platinumMuted : C.creamDim,
                padding:"6px 8px",
                fontFamily:F.mono,
                fontSize:8.5,
                letterSpacing:"0.07em",
                textTransform:"uppercase",
                cursor: (complianceBusy || baaPending) ? "not-allowed" : "pointer",
              }}
            >
              {baaPending ? "BAA Pending Review" : "Request BAA"}
            </button>
          </div>

          <textarea
            value={baaDraft.requestNote}
            onChange={(e) => updateBaaDraft("requestNote", e.target.value)}
            placeholder="BAA request note (scope, data classes, expected signature timeline)"
            disabled={complianceBusy || baaPending}
            style={{
              width:"100%",
              minHeight:58,
              resize:"vertical",
              background:C.lift,
              border:`1px solid ${C.border}`,
              borderRadius:4,
              color:C.creamDim,
              padding:"8px 9px",
              fontSize:10.5,
              marginBottom:8,
            }}
          />

          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:2 }}>
            <div style={{ fontSize:10.5, color:hipaaComplete ? C.emeraldLight : C.amber, lineHeight:1.6 }}>
              HIPAA status: {hipaaComplete ? "ATTESTED" : "PENDING"}
            </div>
            <span style={{
              display:"inline-block",
              border:`1px solid ${baaStatusColor}66`,
              background:`${baaStatusColor}18`,
              color:baaStatusColor,
              borderRadius:4,
              padding:"2px 8px",
              fontFamily:F.mono,
              fontSize:8.5,
              letterSpacing:"0.1em",
              textTransform:"uppercase",
            }}>
              BAA {baaStatusKey.replace(/_/g, " ")}
            </span>
          </div>
          <div style={{ fontSize:10, color:C.platinumMuted, marginTop:4 }}>
            Last attested: {hipaa?.attestedAt ? formatRecordedStamp(hipaa.attestedAt) : "not attested"}
          </div>
          <div style={{ marginTop:6, fontSize:10.5, color:C.platinumMuted }}>
            BAA requests: {(baaRequests || []).length}
          </div>
          {(baaRequests || []).slice(0, 2).map((item) => (
            <div key={item.id} style={{ marginTop:8, padding:"8px 9px", background:C.lift, border:`1px solid ${C.border}`, borderRadius:4 }}>
              <div style={{ fontSize:10, color:C.creamDim, marginBottom:6 }}>
                {String(item.status || "").toUpperCase()} | {item.organizationName || "Org"} | {item.requestedAt ? formatRecordedStamp(item.requestedAt) : "N/A"}
              </div>
              {baaCanReview(item.status) ? (
                <>
                  <textarea
                    value={baaLegalNotes?.[item.id] || ""}
                    onChange={(e) => updateBaaLegalNote(item.id, e.target.value)}
                    placeholder="Legal note (required for decline, optional for review/executed)"
                    disabled={complianceBusy}
                    style={{
                      width:"100%",
                      minHeight:52,
                      resize:"vertical",
                      background:C.surface,
                      border:`1px solid ${C.border}`,
                      borderRadius:4,
                      color:C.creamDim,
                      padding:"7px 8px",
                      fontSize:10,
                      marginBottom:6,
                    }}
                  />
                  <div style={{ display:"flex", gap:6 }}>
                    <button
                      onClick={() => submitBaaLegalReview(item.id, "in_review")}
                      disabled={complianceBusy}
                      style={{
                        background:"transparent",
                        border:`1px solid ${C.sapphire}88`,
                        borderRadius:4,
                        color:C.sapphireLight,
                        padding:"5px 7px",
                        fontFamily:F.mono,
                        fontSize:8,
                        letterSpacing:"0.08em",
                        textTransform:"uppercase",
                        cursor: complianceBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      Mark In Review
                    </button>
                    <button
                      onClick={() => submitBaaLegalReview(item.id, "executed")}
                      disabled={complianceBusy}
                      style={{
                        background:`${C.emerald}1A`,
                        border:`1px solid ${C.emerald}88`,
                        borderRadius:4,
                        color:C.emeraldLight,
                        padding:"5px 7px",
                        fontFamily:F.mono,
                        fontSize:8,
                        letterSpacing:"0.08em",
                        textTransform:"uppercase",
                        cursor: complianceBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      Mark Executed
                    </button>
                    <button
                      onClick={() => submitBaaLegalReview(item.id, "declined")}
                      disabled={complianceBusy}
                      style={{
                        background:`${C.rose}1A`,
                        border:`1px solid ${C.rose}88`,
                        borderRadius:4,
                        color:C.roseLight,
                        padding:"5px 7px",
                        fontFamily:F.mono,
                        fontSize:8,
                        letterSpacing:"0.08em",
                        textTransform:"uppercase",
                        cursor: complianceBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize:10, color:C.platinumMuted, lineHeight:1.5 }}>
                  Finalized at {item.executedAt ? formatRecordedStamp(item.executedAt) : item.reviewedAt ? formatRecordedStamp(item.reviewedAt) : "N/A"}
                  {item.legalNote ? ` | Note: ${item.legalNote}` : ""}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:"18px 20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.14em", color:C.platinumMuted, textTransform:"uppercase" }}>
              Deployment & Observability
            </div>
            <button
              onClick={onRefreshOps}
              disabled={opsBusy}
              style={{
                background:"transparent",
                border:`1px solid ${C.goldBorder}`,
                borderRadius:4,
                color:C.gold,
                padding:"6px 9px",
                fontFamily:F.mono,
                fontSize:8.5,
                letterSpacing:"0.08em",
                textTransform:"uppercase",
                cursor: opsBusy ? "not-allowed" : "pointer",
              }}
            >
              {opsBusy ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div style={{ fontSize:12.5, color:deploymentStatus === "OPERATIONAL" ? C.emeraldLight : deploymentStatus === "WARNING" ? C.gold : C.roseLight, marginBottom:8 }}>
            {deploymentStatus}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
            <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:4, padding:"8px 9px" }}>
              <div style={{ fontFamily:F.mono, fontSize:8, color:C.platinumMuted, letterSpacing:"0.08em" }}>DB LATENCY</div>
              <div style={{ fontSize:12, color:C.cream }}>{opsStatus?.dependencies?.database?.latencyMs ?? "--"} ms</div>
            </div>
            <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:4, padding:"8px 9px" }}>
              <div style={{ fontFamily:F.mono, fontSize:8, color:C.platinumMuted, letterSpacing:"0.08em" }}>IMPORT FAIL 7D</div>
              <div style={{ fontSize:12, color:C.cream }}>{opsStatus?.telemetry?.wearableImportFailureRate7d ?? "--"}%</div>
            </div>
            <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:4, padding:"8px 9px" }}>
              <div style={{ fontFamily:F.mono, fontSize:8, color:C.platinumMuted, letterSpacing:"0.08em" }}>PENDING DELETIONS</div>
              <div style={{ fontSize:12, color:C.cream }}>{opsStatus?.telemetry?.pendingDeletionRequests ?? "--"}</div>
            </div>
            <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:4, padding:"8px 9px" }}>
              <div style={{ fontFamily:F.mono, fontSize:8, color:C.platinumMuted, letterSpacing:"0.08em" }}>UPTIME</div>
              <div style={{ fontSize:12, color:C.cream }}>{opsStatus?.runtime?.uptimeSeconds ?? "--"}s</div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Signals */}
      <div className="fu5" style={{ background:C.surface, border:`1px solid ${C.border}`,
        borderRadius:6, padding:"22px 28px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:20 }}>
          <div style={{ borderLeft:`2px solid ${C.goldBorder}`, paddingLeft:16 }}>
            <div style={{ fontSize:12.5, color:C.cream, fontWeight:400, marginBottom:6 }}>Reliability Layer</div>
            <div style={{ fontSize:11, color:C.platinumMuted, lineHeight:1.6 }}>
              Data quality {reliability.dataQualityScore || 0}, sync coverage {reliability.syncCoveragePct || 0}%, non-manual ingestion {reliability.nonManualIngestionPct || 0}%.
            </div>
          </div>
          <div style={{ borderLeft:`2px solid ${C.goldBorder}`, paddingLeft:16 }}>
            <div style={{ fontSize:12.5, color:C.cream, fontWeight:400, marginBottom:6 }}>Clinician Ops</div>
            <div style={{ fontSize:11, color:C.platinumMuted, lineHeight:1.6, marginBottom:8 }}>
              {clinicianOps.noteCount || 0} notes, {clinicianOps.pendingSignoff || 0} pending signoff.
            </div>
            <button
              onClick={() => onQuickClinicianNote?.(clinicalPlan)}
              disabled={clinicianBusy}
              style={{
                background:"transparent",
                border:`1px solid ${C.goldBorder}`,
                borderRadius:4,
                color:C.gold,
                padding:"6px 8px",
                fontFamily:F.mono,
                fontSize:8.5,
                letterSpacing:"0.08em",
                textTransform:"uppercase",
                cursor: clinicianBusy ? "not-allowed" : "pointer",
              }}
            >
              {clinicianBusy ? "Saving..." : "Quick Note"}
            </button>
          </div>
          <div style={{ borderLeft:`2px solid ${C.goldBorder}`, paddingLeft:16 }}>
            <div style={{ fontSize:12.5, color:C.cream, fontWeight:400, marginBottom:6 }}>Latest Notes</div>
            {(clinicianNotes || []).slice(0, 2).map((note) => (
              <div key={note.id} style={{ marginBottom:8 }}>
                <div style={{ fontSize:10.5, color:C.creamDim, lineHeight:1.5 }}>{note.note}</div>
                <div style={{ fontFamily:F.mono, fontSize:8.5, color:note.signedOff ? C.emeraldLight : C.amber }}>
                  {note.signedOff ? "SIGNED OFF" : "PENDING"}
                </div>
                {!note.signedOff && (
                  <button
                    onClick={() => onSignoffClinicianNote?.(note.id)}
                    style={{
                      marginTop:4,
                      background:"transparent",
                      border:`1px solid ${C.border}`,
                      borderRadius:4,
                      color:C.platinumDim,
                      padding:"5px 7px",
                      fontFamily:F.mono,
                      fontSize:8,
                      letterSpacing:"0.06em",
                      textTransform:"uppercase",
                      cursor:"pointer",
                    }}
                  >
                    Signoff
                  </button>
                )}
              </div>
            ))}
            {(!clinicianNotes || clinicianNotes.length === 0) && (
              <div style={{ fontSize:10.5, color:C.platinumMuted }}>No clinician notes yet.</div>
            )}
          </div>
          <div style={{ borderLeft:`2px solid ${C.goldBorder}`, paddingLeft:16 }}>
            <div style={{ fontSize:12.5, color:C.cream, fontWeight:400, marginBottom:6 }}>Monetization Health</div>
            <div style={{ fontSize:11, color:C.platinumMuted, lineHeight:1.6 }}>
              MRR estimate ${monetization.mrrEstimate || 0} with {monetization.premiumUsers || 0} premium and {monetization.enterpriseUsers || 0} enterprise users.
            </div>
          </div>
        </div>
      </div>

      <div className="fu5" style={{ marginTop:16, background:C.surface, border:`1px solid ${C.border}`, borderRadius:6, padding:"20px 22px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div>
            <div style={{ fontFamily:F.mono, fontSize:9, letterSpacing:"0.14em", color:C.platinumMuted, textTransform:"uppercase" }}>
              Admin Evidence Console
            </div>
            <div style={{ fontSize:12, color:C.creamDim, marginTop:4 }}>
              Manage clinical validation studies and regulatory artifacts directly in-app.
            </div>
          </div>
          <button
            onClick={onRefreshEvidence}
            disabled={evidenceBusy}
            style={{
              background:"transparent",
              border:`1px solid ${C.goldBorder}`,
              borderRadius:4,
              color:C.gold,
              padding:"7px 10px",
              fontFamily:F.mono,
              fontSize:9,
              letterSpacing:"0.08em",
              textTransform:"uppercase",
              cursor: evidenceBusy ? "not-allowed" : "pointer",
            }}
          >
            {evidenceBusy ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:12 }}>
          <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:5, padding:"10px 11px" }}>
            <div style={{ fontFamily:F.mono, fontSize:8.5, color:C.platinumMuted, letterSpacing:"0.1em", marginBottom:4 }}>CLINICAL VALIDATION</div>
            <div style={{ fontSize:10.5, color:C.creamDim, lineHeight:1.6 }}>
              {evidenceClinicalSummary.totalStudies || 0} total | {evidenceClinicalSummary.active || 0} active | {evidenceClinicalSummary.completed || 0} completed | {evidenceClinicalSummary.published || 0} published
            </div>
          </div>
          <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:5, padding:"10px 11px" }}>
            <div style={{ fontFamily:F.mono, fontSize:8.5, color:C.platinumMuted, letterSpacing:"0.1em", marginBottom:4 }}>REGULATORY READINESS</div>
            <div style={{ fontSize:10.5, color:C.creamDim, lineHeight:1.6 }}>
              {evidenceRegulatorySummary.readinessPct || 0}% ready | {evidenceRegulatorySummary.approvedArtifacts || 0}/{evidenceRegulatorySummary.totalArtifacts || 0} approved | {evidenceRegulatorySummary.criticalOpen || 0} critical open
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:6, padding:"12px 12px" }}>
            <div style={{ fontFamily:F.mono, fontSize:8.5, color:C.platinumMuted, letterSpacing:"0.1em", marginBottom:8 }}>Clinical Studies</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8 }}>
              <input value={studyDraft.studyCode} onChange={(e) => updateStudyDraft("studyCode", e.target.value)} placeholder="Study code" disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }} />
              <input value={studyDraft.title} onChange={(e) => updateStudyDraft("title", e.target.value)} placeholder="Study title" disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }} />
              <select value={studyDraft.status} onChange={(e) => updateStudyDraft("status", e.target.value)} disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }}>
                {["planned","recruiting","active","completed","published"].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <input value={studyDraft.cohortSizeTarget} onChange={(e) => updateStudyDraft("cohortSizeTarget", e.target.value)} placeholder="Cohort target" disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }} />
              <input value={studyDraft.externalPartner} onChange={(e) => updateStudyDraft("externalPartner", e.target.value)} placeholder="External partner" disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }} />
              <input value={studyDraft.principalInvestigator} onChange={(e) => updateStudyDraft("principalInvestigator", e.target.value)} placeholder="Principal investigator" disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }} />
              <input value={studyDraft.primaryEndpoint} onChange={(e) => updateStudyDraft("primaryEndpoint", e.target.value)} placeholder="Primary endpoint" disabled={evidenceBusy || complianceBusy} style={{ gridColumn:"1 / span 2", background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }} />
            </div>
            <button
              onClick={submitClinicalStudy}
              disabled={evidenceBusy || complianceBusy}
              style={{ background:`${C.gold}18`, border:`1px solid ${C.goldBorder}`, borderRadius:4, color:C.gold, padding:"6px 8px", fontFamily:F.mono, fontSize:8.5, letterSpacing:"0.07em", textTransform:"uppercase", cursor:(evidenceBusy || complianceBusy) ? "not-allowed" : "pointer" }}
            >
              Add Study
            </button>
            <div style={{ marginTop:10, maxHeight:240, overflowY:"auto", paddingRight:4 }}>
              {evidenceStudies.slice(0, 8).map((study) => (
                <div key={study.id} style={{ border:`1px solid ${C.border}`, borderRadius:4, padding:"8px", marginBottom:8, background:C.surface }}>
                  <div style={{ fontSize:10.5, color:C.cream, marginBottom:4 }}>{study.studyCode} | {study.title}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:6 }}>
                    <select value={studyEdits?.[study.id]?.status || study.status || "planned"} onChange={(e) => updateStudyEdit(study.id, "status", e.target.value)} disabled={evidenceBusy || complianceBusy} style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"6px 7px", fontSize:9.5 }}>
                      {["planned","recruiting","active","completed","published"].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                    <input value={studyEdits?.[study.id]?.cohortSizeEnrolled ?? String(study.cohortSizeEnrolled ?? "")} onChange={(e) => updateStudyEdit(study.id, "cohortSizeEnrolled", e.target.value)} placeholder="Enrolled" disabled={evidenceBusy || complianceBusy} style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"6px 7px", fontSize:9.5 }} />
                  </div>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:9.5, color:C.creamDim, marginBottom:6 }}>
                    <input type="checkbox" checked={Boolean(studyEdits?.[study.id]?.endpointAchieved ?? study.endpointAchieved)} onChange={(e) => updateStudyEdit(study.id, "endpointAchieved", e.target.checked)} disabled={evidenceBusy || complianceBusy} />
                    Endpoint achieved
                  </label>
                  <textarea value={studyEdits?.[study.id]?.notes ?? study.notes ?? ""} onChange={(e) => updateStudyEdit(study.id, "notes", e.target.value)} placeholder="Study notes" disabled={evidenceBusy || complianceBusy} style={{ width:"100%", minHeight:44, resize:"vertical", background:C.lift, border:`1px solid ${C.border}`, borderRadius:4, color:C.creamDim, padding:"6px 7px", fontSize:9.5, marginBottom:6 }} />
                  <button onClick={() => saveClinicalStudy(study.id)} disabled={evidenceBusy || complianceBusy} style={{ background:"transparent", border:`1px solid ${C.goldBorder}`, borderRadius:4, color:C.gold, padding:"5px 7px", fontFamily:F.mono, fontSize:8, letterSpacing:"0.06em", textTransform:"uppercase", cursor:(evidenceBusy || complianceBusy) ? "not-allowed" : "pointer" }}>
                    Save Study
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:6, padding:"12px 12px" }}>
            <div style={{ fontFamily:F.mono, fontSize:8.5, color:C.platinumMuted, letterSpacing:"0.1em", marginBottom:8 }}>Regulatory Artifacts</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8 }}>
              <input value={artifactDraft.artifactKey} onChange={(e) => updateArtifactDraft("artifactKey", e.target.value)} placeholder="Artifact key" disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }} />
              <input value={artifactDraft.title} onChange={(e) => updateArtifactDraft("title", e.target.value)} placeholder="Title" disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }} />
              <input value={artifactDraft.owner} onChange={(e) => updateArtifactDraft("owner", e.target.value)} placeholder="Owner" disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }} />
              <input value={artifactDraft.version} onChange={(e) => updateArtifactDraft("version", e.target.value)} placeholder="Version" disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }} />
              <select value={artifactDraft.status} onChange={(e) => updateArtifactDraft("status", e.target.value)} disabled={evidenceBusy || complianceBusy} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"7px 8px", fontSize:10 }}>
                {["draft","review","approved"].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, color:C.creamDim }}>
                <input type="checkbox" checked={Boolean(artifactDraft.critical)} onChange={(e) => updateArtifactDraft("critical", e.target.checked)} disabled={evidenceBusy || complianceBusy} />
                Critical
              </label>
            </div>
            <button
              onClick={submitRegulatoryArtifact}
              disabled={evidenceBusy || complianceBusy}
              style={{ background:`${C.gold}18`, border:`1px solid ${C.goldBorder}`, borderRadius:4, color:C.gold, padding:"6px 8px", fontFamily:F.mono, fontSize:8.5, letterSpacing:"0.07em", textTransform:"uppercase", cursor:(evidenceBusy || complianceBusy) ? "not-allowed" : "pointer" }}
            >
              Add Artifact
            </button>
            <div style={{ marginTop:10, maxHeight:240, overflowY:"auto", paddingRight:4 }}>
              {evidenceArtifacts.slice(0, 10).map((artifact) => (
                <div key={artifact.id} style={{ border:`1px solid ${C.border}`, borderRadius:4, padding:"8px", marginBottom:8, background:C.surface }}>
                  <div style={{ fontSize:10.5, color:C.cream, marginBottom:4 }}>{artifact.title}</div>
                  <div style={{ fontSize:9.5, color:C.platinumMuted, marginBottom:6 }}>{artifact.artifactKey}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:6 }}>
                    <select value={artifactEdits?.[artifact.id]?.status || artifact.status || "draft"} onChange={(e) => updateArtifactEdit(artifact.id, "status", e.target.value)} disabled={evidenceBusy || complianceBusy} style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"6px 7px", fontSize:9.5 }}>
                      {["draft","review","approved"].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                    <input value={artifactEdits?.[artifact.id]?.version ?? artifact.version ?? ""} onChange={(e) => updateArtifactEdit(artifact.id, "version", e.target.value)} placeholder="Version" disabled={evidenceBusy || complianceBusy} style={{ background:C.lift, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"6px 7px", fontSize:9.5 }} />
                    <input value={artifactEdits?.[artifact.id]?.owner ?? artifact.owner ?? ""} onChange={(e) => updateArtifactEdit(artifact.id, "owner", e.target.value)} placeholder="Owner" disabled={evidenceBusy || complianceBusy} style={{ gridColumn:"1 / span 2", background:C.lift, border:`1px solid ${C.border}`, borderRadius:4, color:C.cream, padding:"6px 7px", fontSize:9.5 }} />
                  </div>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:9.5, color:C.creamDim, marginBottom:6 }}>
                    <input type="checkbox" checked={Boolean(artifactEdits?.[artifact.id]?.critical ?? artifact.critical)} onChange={(e) => updateArtifactEdit(artifact.id, "critical", e.target.checked)} disabled={evidenceBusy || complianceBusy} />
                    Critical
                  </label>
                  <button onClick={() => saveRegulatoryArtifact(artifact.id)} disabled={evidenceBusy || complianceBusy} style={{ background:"transparent", border:`1px solid ${C.goldBorder}`, borderRadius:4, color:C.gold, padding:"5px 7px", fontFamily:F.mono, fontSize:8, letterSpacing:"0.06em", textTransform:"uppercase", cursor:(evidenceBusy || complianceBusy) ? "not-allowed" : "pointer" }}>
                    Save Artifact
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ROOT APP
const PAGES = { overview:Overview, coach:AICoach, insights:Insights, nutrition:Nutrition, enterprise:Enterprise };
const NAV   = [
  { id:"overview",   label:"Overview"   },
  { id:"coach",      label:"AI Coach"   },
  { id:"insights",   label:"Insights"   },
  { id:"nutrition",  label:"Nutrition"  },
  { id:"enterprise", label:"Enterprise" },
];

export default function Aevum() {
  const [page, setPage] = useState("overview");
  const [stamp, setStamp] = useState(0);
  const [authTokenState, setAuthTokenState] = useState(() => getAuthToken());
  const [authUser, setAuthUser] = useState(null);
  const [authHydrating, setAuthHydrating] = useState(() => Boolean(getAuthToken()));
  const [authError, setAuthError] = useState("");
  const [biometricLatest, setBiometricLatest] = useState(null);
  const [biometricsRecent, setBiometricsRecent] = useState([]);
  const [biometricsBusy, setBiometricsBusy] = useState(false);
  const [biometricsError, setBiometricsError] = useState("");
  const [clinicalPlan, setClinicalPlan] = useState(null);
  const [clinicalPlanBusy, setClinicalPlanBusy] = useState(false);
  const [clinicalPlanError, setClinicalPlanError] = useState("");
  const [clinicalActionBusy, setClinicalActionBusy] = useState(false);
  const [contraindications, setContraindications] = useState(DEFAULT_CONTRAINDICATIONS);
  const [contraindicationBusy, setContraindicationBusy] = useState(false);
  const [contraindicationError, setContraindicationError] = useState("");
  const [wearableConnections, setWearableConnections] = useState([]);
  const [wearablesBusy, setWearablesBusy] = useState(false);
  const [wearablesError, setWearablesError] = useState("");
  const [outcomesSummary, setOutcomesSummary] = useState(null);
  const [outcomesBusy, setOutcomesBusy] = useState(false);
  const [outcomesError, setOutcomesError] = useState("");
  const [platformSummary, setPlatformSummary] = useState(null);
  const [platformBusy, setPlatformBusy] = useState(false);
  const [platformError, setPlatformError] = useState("");
  const [evidenceConsole, setEvidenceConsole] = useState(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [billingOverview, setBillingOverview] = useState(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [clinicianNotes, setClinicianNotes] = useState([]);
  const [clinicianBusy, setClinicianBusy] = useState(false);
  const [clinicianError, setClinicianError] = useState("");
  const [complianceConsent, setComplianceConsent] = useState(null);
  const [hipaaAttestation, setHipaaAttestation] = useState(null);
  const [baaRequests, setBaaRequests] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [complianceBusy, setComplianceBusy] = useState(false);
  const [complianceError, setComplianceError] = useState("");
  const [opsStatus, setOpsStatus] = useState(null);
  const [opsBusy, setOpsBusy] = useState(false);
  const [opsError, setOpsError] = useState("");
  const [trendWindowDays, setTrendWindowDays] = useState(30);
  const trendIntelligence = useMemo(
    () => buildTrendIntelligence(biometricsRecent, trendWindowDays),
    [biometricsRecent, trendWindowDays]
  );
  const coachTrendBrief = trendIntelligence?.coachBrief || "";
  const coachContext = [coachTrendBrief, clinicalPlan?.coachContext].filter(Boolean).join(" ");
  const Active = PAGES[page];
  const currentPlanKey = normalizePlan(billingOverview?.plan || authUser?.plan || "free");

  const expireSession = (message = "Your session has expired. Sign in again to continue.") => {
    clearAuthToken();
    setAuthTokenState("");
    setAuthUser(null);
    setAuthError(message);
    setBiometricLatest(null);
    setBiometricsRecent([]);
    setBiometricsError("");
    setClinicalPlan(null);
    setClinicalPlanError("");
    setClinicalPlanBusy(false);
    setClinicalActionBusy(false);
    setContraindications(DEFAULT_CONTRAINDICATIONS);
    setContraindicationBusy(false);
    setContraindicationError("");
    setWearableConnections([]);
    setWearablesBusy(false);
    setWearablesError("");
    setOutcomesSummary(null);
    setOutcomesBusy(false);
    setOutcomesError("");
    setPlatformSummary(null);
    setPlatformBusy(false);
    setPlatformError("");
    setEvidenceConsole(null);
    setEvidenceBusy(false);
    setEvidenceError("");
    setBillingOverview(null);
    setBillingBusy(false);
    setBillingError("");
    setClinicianNotes([]);
    setClinicianBusy(false);
    setClinicianError("");
    setComplianceConsent(null);
    setHipaaAttestation(null);
    setBaaRequests([]);
    setDeletionRequests([]);
    setComplianceBusy(false);
    setComplianceError("");
    setOpsStatus(null);
    setOpsBusy(false);
    setOpsError("");
  };

  useEffect(() => {
    let mounted = true;

    const hydrateSession = async () => {
      if (!authTokenState) {
        if (mounted) {
          setAuthUser(null);
          setAuthHydrating(false);
          setBiometricLatest(null);
          setBiometricsRecent([]);
        }
        return;
      }

      try {
        const user = await authApi.me(authTokenState);
        if (!mounted) return;
        setAuthUser(user);
      } catch (err) {
        if (!mounted) return;
        expireSession(err.message || "Session expired. Please sign in again.");
      } finally {
        if (mounted) {
          setAuthHydrating(false);
        }
      }
    };

    hydrateSession();
    return () => {
      mounted = false;
    };
  }, [authTokenState]);

  useEffect(() => {
    let mounted = true;

    const hydrateBiometrics = async () => {
      if (!authTokenState || !authUser) {
        if (mounted) {
          setBiometricLatest(null);
          setBiometricsRecent([]);
          setBiometricsError("");
          setBiometricsBusy(false);
        }
        return;
      }

      setBiometricsBusy(true);
      setBiometricsError("");

      try {
        const [latest, recent] = await Promise.all([
          biometricsApi.latest(authTokenState),
          biometricsApi.recent(authTokenState, 60),
        ]);

        if (!mounted) return;
        setBiometricLatest(latest || null);
        setBiometricsRecent(Array.isArray(recent) ? recent : []);
      } catch (err) {
        if (!mounted) return;
        if (err.status === 401) {
          expireSession();
          return;
        }
        setBiometricsError(err.message || "Unable to load biometric data.");
      } finally {
        if (mounted) {
          setBiometricsBusy(false);
        }
      }
    };

    hydrateBiometrics();
    return () => {
      mounted = false;
    };
  }, [authTokenState, authUser]);

  const refreshPlatformSummary = async () => {
    if (!authTokenState || !authUser) {
      setPlatformSummary(null);
      setPlatformError("");
      return null;
    }
    if (!isPlanAtLeast(currentPlanKey, "premium")) {
      setPlatformSummary(null);
      setPlatformError("");
      return null;
    }

    setPlatformBusy(true);
    setPlatformError("");
    try {
      const data = await platformApi.summary(authTokenState);
      setPlatformSummary(data || null);
      return data;
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return null;
      }
      setPlatformError(toEnterpriseErrorMessage(err.message, "Unable to load platform summary."));
      return null;
    } finally {
      setPlatformBusy(false);
    }
  };

  const refreshEvidenceConsole = async () => {
    if (!authTokenState || !authUser) {
      setEvidenceConsole(null);
      setEvidenceError("");
      return null;
    }
    if (!isPlanAtLeast(currentPlanKey, "enterprise")) {
      setEvidenceConsole(null);
      setEvidenceError("");
      return null;
    }

    setEvidenceBusy(true);
    setEvidenceError("");
    try {
      const data = await platformApi.evidence(authTokenState, 100);
      setEvidenceConsole(data || null);
      return data;
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return null;
      }
      if (err.status === 403) {
        setEvidenceConsole(null);
        setEvidenceError("Admin Evidence Console requires enterprise plan.");
        return null;
      }
      setEvidenceError(toEnterpriseErrorMessage(err.message, "Unable to load admin evidence console."));
      return null;
    } finally {
      setEvidenceBusy(false);
    }
  };

  const refreshClinicianNotes = async () => {
    if (!authTokenState || !authUser) {
      setClinicianNotes([]);
      setClinicianError("");
      return [];
    }
    if (!isPlanAtLeast(currentPlanKey, "premium")) {
      setClinicianNotes([]);
      setClinicianError("");
      return [];
    }

    setClinicianBusy(true);
    setClinicianError("");
    try {
      const notes = await clinicianApi.notes(authTokenState, 20);
      const normalized = Array.isArray(notes) ? notes : [];
      setClinicianNotes(normalized);
      return normalized;
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return [];
      }
      setClinicianError(toEnterpriseErrorMessage(err.message, "Unable to load clinician notes."));
      return [];
    } finally {
      setClinicianBusy(false);
    }
  };

  const refreshCompliance = async () => {
    if (!authTokenState || !authUser) {
      setComplianceConsent(null);
      setHipaaAttestation(null);
      setBaaRequests([]);
      setDeletionRequests([]);
      setComplianceError("");
      return null;
    }
    if (!isPlanAtLeast(currentPlanKey, "premium")) {
      setComplianceConsent(null);
      setHipaaAttestation(null);
      setBaaRequests([]);
      setDeletionRequests([]);
      setComplianceError("");
      return null;
    }

    setComplianceBusy(true);
    setComplianceError("");
    try {
      const [consent, hipaa, baa, deletions] = await Promise.all([
        complianceApi.getConsent(authTokenState),
        complianceApi.getHipaaAttestation(authTokenState),
        complianceApi.listBaaRequests(authTokenState, 10),
        complianceApi.listDeletionRequests(authTokenState, 10),
      ]);
      setComplianceConsent(consent || null);
      setHipaaAttestation(hipaa || null);
      setBaaRequests(Array.isArray(baa) ? baa : []);
      setDeletionRequests(Array.isArray(deletions) ? deletions : []);
      return { consent, hipaa, baa, deletions };
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return null;
      }
      setComplianceError(toEnterpriseErrorMessage(err.message, "Unable to load compliance profile."));
      return null;
    } finally {
      setComplianceBusy(false);
    }
  };

  const refreshOps = async () => {
    if (!authTokenState || !authUser) {
      setOpsStatus(null);
      setOpsError("");
      return null;
    }
    if (!isPlanAtLeast(currentPlanKey, "premium")) {
      setOpsStatus(null);
      setOpsError("");
      return null;
    }

    setOpsBusy(true);
    setOpsError("");
    try {
      const data = await opsApi.status(authTokenState);
      setOpsStatus(data || null);
      return data;
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return null;
      }
      setOpsError(toEnterpriseErrorMessage(err.message, "Unable to load observability status."));
      return null;
    } finally {
      setOpsBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const hydrateEnterprise = async () => {
      if (!authTokenState || !authUser) {
        if (mounted) {
          setPlatformSummary(null);
          setPlatformError("");
          setPlatformBusy(false);
          setEvidenceConsole(null);
          setEvidenceError("");
          setEvidenceBusy(false);
          setBillingOverview(null);
          setBillingError("");
          setBillingBusy(false);
          setClinicianNotes([]);
          setClinicianError("");
          setClinicianBusy(false);
          setComplianceConsent(null);
          setHipaaAttestation(null);
          setBaaRequests([]);
          setDeletionRequests([]);
          setComplianceError("");
          setComplianceBusy(false);
          setOpsStatus(null);
          setOpsError("");
          setOpsBusy(false);
        }
        return;
      }

      setPlatformBusy(true);
      setEvidenceBusy(true);
      setBillingBusy(true);
      setClinicianBusy(true);
      setComplianceBusy(true);
      setOpsBusy(true);
      setPlatformError("");
      setEvidenceError("");
      setBillingError("");
      setClinicianError("");
      setComplianceError("");
      setOpsError("");

      try {
        const billingData = await billingApi.entitlements(authTokenState);
        const sessionPlan = normalizePlan(billingData?.plan || authUser?.plan || "free");
        if (!mounted) return;

        setBillingOverview(billingData || null);

        if (!isPlanAtLeast(sessionPlan, "premium")) {
          setPlatformSummary(null);
          setEvidenceConsole(null);
          setClinicianNotes([]);
          setComplianceConsent(null);
          setHipaaAttestation(null);
          setBaaRequests([]);
          setDeletionRequests([]);
          setOpsStatus(null);
          setPlatformError("");
          setEvidenceError("");
          setClinicianError("");
          setComplianceError("");
          setOpsError("");
          return;
        }

        const [platformData, evidenceData, notes, consent, hipaa, baa, deletions, ops] = await Promise.all([
          platformApi.summary(authTokenState),
          isPlanAtLeast(sessionPlan, "enterprise")
            ? platformApi.evidence(authTokenState, 100).catch((evidenceErr) => {
              if (evidenceErr?.status === 403) {
                return { __forbidden: true };
              }
              throw evidenceErr;
            })
            : Promise.resolve({ __forbidden: true }),
          clinicianApi.notes(authTokenState, 20),
          complianceApi.getConsent(authTokenState),
          complianceApi.getHipaaAttestation(authTokenState),
          complianceApi.listBaaRequests(authTokenState, 10),
          complianceApi.listDeletionRequests(authTokenState, 10),
          opsApi.status(authTokenState),
        ]);
        if (!mounted) return;
        setPlatformSummary(platformData || null);
        if (evidenceData?.__forbidden) {
          setEvidenceConsole(null);
          setEvidenceError("");
        } else {
          setEvidenceConsole(evidenceData || null);
          setEvidenceError("");
        }
        setClinicianNotes(Array.isArray(notes) ? notes : []);
        setComplianceConsent(consent || null);
        setHipaaAttestation(hipaa || null);
        setBaaRequests(Array.isArray(baa) ? baa : []);
        setDeletionRequests(Array.isArray(deletions) ? deletions : []);
        setOpsStatus(ops || null);
      } catch (err) {
        if (!mounted) return;
        if (err.status === 401) {
          expireSession();
          return;
        }
        const unifiedError = toEnterpriseErrorMessage(
          err.message,
          "Unable to load enterprise intelligence."
        );
        setPlatformError(unifiedError);
        setEvidenceError("");
        setComplianceError("");
        setOpsError("");
      } finally {
        if (mounted) {
          setPlatformBusy(false);
          setEvidenceBusy(false);
          setBillingBusy(false);
          setClinicianBusy(false);
          setComplianceBusy(false);
          setOpsBusy(false);
        }
      }
    };

    hydrateEnterprise();
    return () => {
      mounted = false;
    };
  }, [authTokenState, authUser, biometricsRecent.length, clinicalPlan?.id]);

  const refreshOutcomes = async () => {
    if (!authTokenState || !authUser) {
      setOutcomesSummary(null);
      setOutcomesError("");
      return null;
    }

    setOutcomesBusy(true);
    setOutcomesError("");
    try {
      const data = await outcomesApi.summary(authTokenState);
      setOutcomesSummary(data || null);
      return data;
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return null;
      }
      setOutcomesError(err.message || "Unable to load outcomes summary.");
      return null;
    } finally {
      setOutcomesBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const hydrateOutcomes = async () => {
      if (!authTokenState || !authUser) {
        if (mounted) {
          setOutcomesSummary(null);
          setOutcomesError("");
          setOutcomesBusy(false);
        }
        return;
      }

      setOutcomesBusy(true);
      setOutcomesError("");
      try {
        const data = await outcomesApi.summary(authTokenState);
        if (!mounted) return;
        setOutcomesSummary(data || null);
      } catch (err) {
        if (!mounted) return;
        if (err.status === 401) {
          expireSession();
          return;
        }
        setOutcomesError(err.message || "Unable to load outcomes summary.");
      } finally {
        if (mounted) {
          setOutcomesBusy(false);
        }
      }
    };

    hydrateOutcomes();
    return () => {
      mounted = false;
    };
  }, [authTokenState, authUser, biometricsRecent.length]);

  useEffect(() => {
    let mounted = true;

    const hydrateWearables = async () => {
      if (!authTokenState || !authUser) {
        if (mounted) {
          setWearableConnections([]);
          setWearablesBusy(false);
          setWearablesError("");
        }
        return;
      }

      setWearablesBusy(true);
      setWearablesError("");
      try {
        const payload = await wearablesApi.connections(authTokenState);
        if (!mounted) return;
        setWearableConnections(Array.isArray(payload?.connections) ? payload.connections : []);
      } catch (err) {
        if (!mounted) return;
        if (err.status === 401) {
          expireSession();
          return;
        }
        setWearablesError(err.message || "Unable to load wearable connections.");
      } finally {
        if (mounted) {
          setWearablesBusy(false);
        }
      }
    };

    hydrateWearables();
    return () => {
      mounted = false;
    };
  }, [authTokenState, authUser]);

  useEffect(() => {
    let mounted = true;

    const hydrateClinicalPlan = async () => {
      if (!authTokenState || !authUser) {
        if (mounted) {
          setClinicalPlan(null);
          setClinicalPlanBusy(false);
          setClinicalPlanError("");
        }
        return;
      }

      setClinicalPlanBusy(true);
      setClinicalPlanError("");

      try {
        const plan = await protocolsApi.today(authTokenState);
        if (!mounted) return;
        setClinicalPlan(plan || null);
      } catch (err) {
        if (!mounted) return;
        if (err.status === 401) {
          expireSession();
          return;
        }
        setClinicalPlanError(err.message || "Unable to load clinical plan.");
      } finally {
        if (mounted) {
          setClinicalPlanBusy(false);
        }
      }
    };

    hydrateClinicalPlan();
    return () => {
      mounted = false;
    };
  }, [authTokenState, authUser]);

  useEffect(() => {
    let mounted = true;

    const hydrateContraindications = async () => {
      if (!authTokenState || !authUser) {
        if (mounted) {
          setContraindications(DEFAULT_CONTRAINDICATIONS);
          setContraindicationBusy(false);
          setContraindicationError("");
        }
        return;
      }

      setContraindicationBusy(true);
      setContraindicationError("");
      try {
        const profile = await contraindicationsApi.get(authTokenState);
        if (!mounted) return;
        setContraindications({
          ...DEFAULT_CONTRAINDICATIONS,
          ...(profile || {}),
        });
      } catch (err) {
        if (!mounted) return;
        if (err.status === 401) {
          expireSession();
          return;
        }
        setContraindicationError(err.message || "Unable to load contraindication profile.");
      } finally {
        if (mounted) {
          setContraindicationBusy(false);
        }
      }
    };

    hydrateContraindications();
    return () => {
      mounted = false;
    };
  }, [authTokenState, authUser]);

  const go = useCallback((id) => {
    setPage(id);
    setStamp((s) => s + 1);
  }, []);
  const displayName = authUser?.firstName || "Member";
  const avatarInitial = displayName.slice(0, 1).toUpperCase() || "A";

  const handleAuthenticated = (session) => {
    setAuthToken(session.token);
    setAuthTokenState(session.token);
    setAuthUser(session.user);
    setAuthError("");
    setBiometricsError("");
    setClinicalPlan(null);
    setClinicalPlanError("");
    setContraindications(DEFAULT_CONTRAINDICATIONS);
    setContraindicationError("");
    setPlatformSummary(null);
    setPlatformError("");
    setEvidenceConsole(null);
    setEvidenceError("");
    setBillingOverview(null);
    setBillingError("");
    setClinicianNotes([]);
    setClinicianError("");
    setComplianceConsent(null);
    setHipaaAttestation(null);
    setBaaRequests([]);
    setDeletionRequests([]);
    setComplianceError("");
    setOpsStatus(null);
    setOpsError("");
    setPage("overview");
    setStamp((s) => s + 1);
  };

  const handleSessionExpired = () => {
    expireSession("Your session has expired. Sign in again to continue.");
  };

  const handleLogout = () => {
    expireSession("");
  };

  const handleChangePlan = async (targetPlan) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setBillingBusy(true);
    setBillingError("");
    try {
      const data = await billingApi.updatePlan({
        token: authTokenState,
        targetPlan,
      });
      const nextToken = data?.token || authTokenState;

      if (data?.token) {
        setAuthToken(data.token);
        setAuthTokenState(data.token);
      }

      if (data?.user) {
        setAuthUser(data.user);
      }

      setBillingOverview(data || null);
      const nextPlan = normalizePlan(data?.plan || data?.user?.plan || authUser?.plan || "free");
      try {
        if (!isPlanAtLeast(nextPlan, "premium")) {
          setPlatformSummary(null);
          setPlatformError("");
          setEvidenceConsole(null);
          setEvidenceError("");
          setComplianceConsent(null);
          setHipaaAttestation(null);
          setBaaRequests([]);
          setDeletionRequests([]);
          setComplianceError("");
          setOpsStatus(null);
          setOpsError("");
          return;
        }

        const [platformData, evidenceData, consentData, hipaaData, baaData, deletionsData, opsData] = await Promise.all([
          platformApi.summary(nextToken),
          isPlanAtLeast(nextPlan, "enterprise")
            ? platformApi.evidence(nextToken, 100).catch((evidenceErr) => {
              if (evidenceErr?.status === 403) {
                return { __forbidden: true };
              }
              throw evidenceErr;
            })
            : Promise.resolve({ __forbidden: true }),
          complianceApi.getConsent(nextToken),
          complianceApi.getHipaaAttestation(nextToken),
          complianceApi.listBaaRequests(nextToken, 10),
          complianceApi.listDeletionRequests(nextToken, 10),
          opsApi.status(nextToken),
        ]);
        setPlatformSummary(platformData || null);
        setPlatformError("");
        if (evidenceData?.__forbidden) {
          setEvidenceConsole(null);
          setEvidenceError("");
        } else {
          setEvidenceConsole(evidenceData || null);
          setEvidenceError("");
        }
        setComplianceConsent(consentData || null);
        setHipaaAttestation(hipaaData || null);
        setBaaRequests(Array.isArray(baaData) ? baaData : []);
        setDeletionRequests(Array.isArray(deletionsData) ? deletionsData : []);
        setComplianceError("");
        setOpsStatus(opsData || null);
        setOpsError("");
      } catch (platformErr) {
        setPlatformError(toEnterpriseErrorMessage(platformErr.message, "Unable to load platform summary."));
      }
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setBillingError(toEnterpriseErrorMessage(err.message, "Unable to change plan."));
    } finally {
      setBillingBusy(false);
    }
  };

  const handleQuickClinicianNote = async (plan) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setClinicianBusy(true);
    setClinicianError("");
    try {
      const payload = {
        clinicianName: "AEVUM Clinical Lead",
        note: plan?.summary
          ? `Daily clinical review: ${plan.summary}`
          : "Clinical review recorded for ongoing protocol supervision.",
        protocolId: plan?.id || null,
      };
      await clinicianApi.createNote({ token: authTokenState, payload });
      await Promise.all([refreshClinicianNotes(), refreshPlatformSummary()]);
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setClinicianError(err.message || "Unable to create clinician note.");
    } finally {
      setClinicianBusy(false);
    }
  };

  const handleSignoffClinicianNote = async (noteId) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setClinicianBusy(true);
    setClinicianError("");
    try {
      await clinicianApi.signoffNote({ token: authTokenState, noteId });
      await Promise.all([refreshClinicianNotes(), refreshPlatformSummary()]);
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setClinicianError(err.message || "Unable to sign off clinician note.");
    } finally {
      setClinicianBusy(false);
    }
  };

  const handleToggleComplianceConsent = async (field, value) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    const nextConsent = {
      ...(complianceConsent || {}),
      [field]: value,
    };

    setComplianceBusy(true);
    setComplianceError("");
    try {
      const updated = await complianceApi.updateConsent({
        token: authTokenState,
        payload: {
          consentVersion: nextConsent.consentVersion || "1.0.0",
          acceptedTerms: Boolean(nextConsent.acceptedTerms),
          acceptedPrivacy: Boolean(nextConsent.acceptedPrivacy),
          acceptedClinicalDisclaimer: Boolean(nextConsent.acceptedClinicalDisclaimer),
          acceptedMarketing: Boolean(nextConsent.acceptedMarketing),
        },
      });
      setComplianceConsent(updated || null);
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setComplianceError(err.message || "Unable to update consent profile.");
    } finally {
      setComplianceBusy(false);
    }
  };

  const handleApplyHipaaAttestation = async (payload) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setComplianceBusy(true);
    setComplianceError("");
    try {
      const updated = await complianceApi.updateHipaaAttestation({
        token: authTokenState,
        payload,
      });
      setHipaaAttestation(updated || null);
      const refreshedBaaRequests = await complianceApi.listBaaRequests(authTokenState, 10);
      setBaaRequests(Array.isArray(refreshedBaaRequests) ? refreshedBaaRequests : []);
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setComplianceError(err.message || "Unable to apply HIPAA attestation.");
    } finally {
      setComplianceBusy(false);
    }
  };

  const handleCreateBaaRequest = async (payload) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setComplianceBusy(true);
    setComplianceError("");
    try {
      await complianceApi.createBaaRequest({
        token: authTokenState,
        payload,
      });
      await refreshCompliance();
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setComplianceError(err.message || "Unable to submit BAA request.");
    } finally {
      setComplianceBusy(false);
    }
  };

  const handleUpdateBaaRequestStatus = async ({ requestId, status, legalNote }) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setComplianceBusy(true);
    setComplianceError("");
    try {
      await complianceApi.updateBaaRequestStatus({
        token: authTokenState,
        requestId,
        payload: {
          status,
          legalNote,
        },
      });
      await refreshCompliance();
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setComplianceError(err.message || "Unable to update BAA legal review status.");
    } finally {
      setComplianceBusy(false);
    }
  };

  const handleCreateClinicalStudy = async (payload) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setEvidenceBusy(true);
    setEvidenceError("");
    try {
      await platformApi.createClinicalStudy({
        token: authTokenState,
        payload,
      });
      await Promise.all([refreshEvidenceConsole(), refreshPlatformSummary()]);
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setEvidenceError(err.message || "Unable to create clinical study.");
    } finally {
      setEvidenceBusy(false);
    }
  };

  const handleUpdateClinicalStudy = async ({ studyId, payload }) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setEvidenceBusy(true);
    setEvidenceError("");
    try {
      await platformApi.updateClinicalStudy({
        token: authTokenState,
        studyId,
        payload,
      });
      await Promise.all([refreshEvidenceConsole(), refreshPlatformSummary()]);
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setEvidenceError(err.message || "Unable to update clinical study.");
    } finally {
      setEvidenceBusy(false);
    }
  };

  const handleCreateRegulatoryArtifact = async (payload) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setEvidenceBusy(true);
    setEvidenceError("");
    try {
      await platformApi.createRegulatoryArtifact({
        token: authTokenState,
        payload,
      });
      await Promise.all([refreshEvidenceConsole(), refreshPlatformSummary()]);
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setEvidenceError(err.message || "Unable to create regulatory artifact.");
    } finally {
      setEvidenceBusy(false);
    }
  };

  const handleUpdateRegulatoryArtifact = async ({ artifactId, payload }) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setEvidenceBusy(true);
    setEvidenceError("");
    try {
      await platformApi.updateRegulatoryArtifact({
        token: authTokenState,
        artifactId,
        payload,
      });
      await Promise.all([refreshEvidenceConsole(), refreshPlatformSummary()]);
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setEvidenceError(err.message || "Unable to update regulatory artifact.");
    } finally {
      setEvidenceBusy(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setComplianceBusy(true);
    setComplianceError("");
    try {
      await complianceApi.requestDeletion({
        token: authTokenState,
        payload: {
          reason: "User-initiated deletion request from enterprise compliance panel.",
        },
      });
      await refreshCompliance();
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setComplianceError(err.message || "Unable to create deletion request.");
    } finally {
      setComplianceBusy(false);
    }
  };

  const handleDownloadAuditBundle = async () => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setComplianceBusy(true);
    setComplianceError("");
    try {
      const bundle = await complianceApi.getAuditBundle(authTokenState);
      const dateTag = new Date().toISOString().slice(0, 10);
      downloadJson(`aevum-compliance-bundle-${dateTag}.json`, bundle);
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setComplianceError(err.message || "Unable to export audit bundle.");
    } finally {
      setComplianceBusy(false);
    }
  };

  const createBiometricEntry = async (payload) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    try {
      const entry = await biometricsApi.createEntry({
        token: authTokenState,
        payload,
      });

      setBiometricLatest(entry);
      setBiometricsRecent((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, 60));
      setBiometricsError("");

      try {
        const refreshedPlan = await protocolsApi.today(authTokenState, true);
        setClinicalPlan(refreshedPlan || null);
        setClinicalPlanError("");
      } catch (planErr) {
        if (planErr.status === 401) {
          expireSession();
          throw planErr;
        }
        setClinicalPlanError(planErr.message || "Biometric saved, but protocol refresh failed.");
      }

      return entry;
    } catch (err) {
      if (err.status === 401) {
        expireSession();
      }
      throw err;
    }
  };

  const connectWearableProvider = async (provider) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    try {
      await wearablesApi.connect({
        token: authTokenState,
        payload: {
          provider,
          isActive: true,
        },
      });

      const refreshed = await wearablesApi.connections(authTokenState);
      setWearableConnections(Array.isArray(refreshed?.connections) ? refreshed.connections : []);
      setWearablesError("");
    } catch (err) {
      if (err.status === 401) {
        expireSession();
      }
      throw err;
    }
  };

  const handleToggleClinicalAction = async (protocolId, actionIndex, completed) => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setClinicalActionBusy(true);
    try {
      const updatedPlan = await protocolsApi.completeAction({
        token: authTokenState,
        protocolId,
        actionIndex,
        completed,
      });
      setClinicalPlan(updatedPlan || null);
      setClinicalPlanError("");
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setClinicalPlanError(err.message || "Unable to update protocol completion.");
    } finally {
      setClinicalActionBusy(false);
    }
  };

  const handleContraindicationChange = (field, value) => {
    setContraindications((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveContraindications = async () => {
    if (!authTokenState) {
      throw new Error("Session not found. Please sign in again.");
    }

    setContraindicationBusy(true);
    setContraindicationError("");
    try {
      const savedProfile = await contraindicationsApi.update({
        token: authTokenState,
        payload: contraindications,
      });

      setContraindications({
        ...DEFAULT_CONTRAINDICATIONS,
        ...(savedProfile || {}),
      });

      const refreshedPlan = await protocolsApi.today(authTokenState, true);
      setClinicalPlan(refreshedPlan || null);
      setClinicalPlanError("");
    } catch (err) {
      if (err.status === 401) {
        expireSession();
        return;
      }
      setContraindicationError(err.message || "Unable to save contraindication profile.");
    } finally {
      setContraindicationBusy(false);
    }
  };

  const exportDailyPlan = async () => {
    if (!clinicalPlan) {
      return;
    }

    let planForExport = clinicalPlan;
    const hasHistory = Array.isArray(clinicalPlan.versionHistory) && clinicalPlan.versionHistory.length > 0;

    if (!hasHistory && authTokenState && clinicalPlan.id) {
      try {
        const versions = await protocolsApi.versions({
          token: authTokenState,
          protocolId: clinicalPlan.id,
          limit: 8,
        });
        planForExport = {
          ...clinicalPlan,
          versionHistory: Array.isArray(versions) ? versions : [],
        };
      } catch (err) {
        // Keep export available even when version endpoint is unavailable.
      }
    }

    downloadClinicalDailyPlan(planForExport);
  };

  const exportInvestorEvidencePack = async () => {
    if (!clinicalPlan) {
      return;
    }

    let planForExport = clinicalPlan;
    const hasHistory = Array.isArray(clinicalPlan.versionHistory) && clinicalPlan.versionHistory.length > 0;

    if (!hasHistory && authTokenState && clinicalPlan.id) {
      try {
        const versions = await protocolsApi.versions({
          token: authTokenState,
          protocolId: clinicalPlan.id,
          limit: 8,
        });
        planForExport = {
          ...clinicalPlan,
          versionHistory: Array.isArray(versions) ? versions : [],
        };
      } catch (err) {
        // Keep export available even when version endpoint is unavailable.
      }
    }

    downloadInvestorPack({
      plan: planForExport,
      biometricsRecent,
      user: authUser,
    });
  };

  if (authHydrating) {
    return <BootScreen />;
  }

  if (!authUser) {
    return <AuthGate onAuthenticated={handleAuthenticated} initialError={authError} />;
  }

  const connectedWearables = (Array.isArray(wearableConnections) ? wearableConnections : [])
    .filter((item) => item?.connected);
  const latestWearableSync = connectedWearables
    .map((item) => item?.lastSyncedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;
  const footerSignals = [
    ...(connectedWearables.length > 0
      ? connectedWearables.slice(0, 2).map((item) => ({
        d: toWearableLabel(item.provider),
        s: item.lastSyncedAt ? `Synced ${formatRecordedStamp(item.lastSyncedAt)}` : "Connected",
        live: true,
      }))
      : [{
        d: "Wearable Layer",
        s: "No provider connected",
        live: false,
      }]),
    {
      d: "Last Full Sync",
      s: latestWearableSync ? formatRecordedStamp(latestWearableSync) : "Awaiting sync",
      live: Boolean(latestWearableSync),
    },
  ];
  const onBaaReviewStatusUpdate = handleUpdateBaaRequestStatus;

  return (
    <div style={{ minHeight:"100vh", background:C.void }}>
      <style>{STYLES}</style>

      {/* Navbar */}
      <header style={{
        position:"sticky", top:0, zIndex:200,
        background:`${C.void}F0`, backdropFilter:"blur(20px)",
        borderBottom:`1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth:1140, margin:"0 auto", padding:"0 36px",
          height:62, display:"flex", alignItems:"center",
          justifyContent:"space-between" }}>

          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ position:"relative" }}>
              <svg width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="none"
                  stroke={C.gold} strokeWidth="1" opacity=".4" />
                <circle cx="16" cy="16" r="9" fill="none"
                  stroke={C.gold} strokeWidth="1.5" />
                <circle cx="16" cy="16" r="3" fill={C.gold} />
                <line x1="16" y1="2" x2="16" y2="8" stroke={C.gold} strokeWidth="1.5" />
                <line x1="16" y1="24" x2="16" y2="30" stroke={C.gold} strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily:F.display, fontSize:20, fontWeight:500,
                letterSpacing:"0.12em", color:C.cream, lineHeight:1 }}>AEVUM</div>
              <div style={{ fontFamily:F.mono, fontSize:8, letterSpacing:"0.22em",
                textTransform:"uppercase", color:C.platinumMuted, marginTop:2 }}>
                Health Intelligence
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display:"flex", gap:0 }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => go(n.id)} style={{
                background:"transparent", border:"none",
                padding:"8px 18px", cursor:"pointer",
                fontFamily:F.mono, fontSize:10, letterSpacing:"0.12em",
                textTransform:"uppercase",
                color: page===n.id ? C.gold : C.platinumMuted,
                borderBottom:`2px solid ${page===n.id ? C.gold : "transparent"}`,
                transition:"all .2s",
              }}
                onMouseEnter={e => { if(page!==n.id) e.currentTarget.style.color=C.cream; }}
                onMouseLeave={e => { if(page!==n.id) e.currentTarget.style.color=C.platinumMuted; }}
              >{n.label}</button>
            ))}
          </nav>

          {/* User */}
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:12, color:C.cream, fontWeight:400 }}>{displayName}</div>
              <div style={{ fontFamily:F.mono, fontSize:9, color:C.gold,
                letterSpacing:"0.08em" }}>Vital Index | 82</div>
              <button onClick={handleLogout} style={{
                marginTop:6, background:"transparent", border:"none", padding:0,
                color:C.platinumMuted, fontFamily:F.mono, fontSize:9, letterSpacing:"0.08em",
                cursor:"pointer", textTransform:"uppercase",
              }}>Sign Out</button>
            </div>
            <div style={{
              width:36, height:36, borderRadius:"50%",
              background:`linear-gradient(135deg, ${C.raise}, ${C.border})`,
              border:`1.5px solid ${C.goldBorder}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:F.display, fontSize:16, color:C.gold,
            }}>{avatarInitial}</div>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <Ticker />

      {/* Page */}
      <main key={stamp} style={{ animation:"fadeIn .28s ease both" }}>
        <Profiler id={`aevum:${page}`} onRender={onAppRenderProfile}>
          <Active
            authToken={authTokenState}
            authUser={authUser}
            onUnauthorized={handleSessionExpired}
            biometricLatest={biometricLatest}
            biometricsRecent={biometricsRecent}
            biometricsBusy={biometricsBusy}
            biometricsError={biometricsError}
            onCreateBiometric={createBiometricEntry}
            wearableConnections={wearableConnections}
            wearablesBusy={wearablesBusy}
            wearablesError={wearablesError}
            onQuickConnectWearable={connectWearableProvider}
            outcomesSummary={outcomesSummary}
            outcomesBusy={outcomesBusy}
            outcomesError={outcomesError}
            onRefreshOutcomes={refreshOutcomes}
            platformSummary={platformSummary}
            platformBusy={platformBusy}
            platformError={platformError}
            onRefreshPlatform={refreshPlatformSummary}
            evidenceConsole={evidenceConsole}
            evidenceBusy={evidenceBusy}
            evidenceError={evidenceError}
            onRefreshEvidence={refreshEvidenceConsole}
            onCreateClinicalStudy={handleCreateClinicalStudy}
            onUpdateClinicalStudy={handleUpdateClinicalStudy}
            onCreateRegulatoryArtifact={handleCreateRegulatoryArtifact}
            onUpdateRegulatoryArtifact={handleUpdateRegulatoryArtifact}
            billingOverview={billingOverview}
            billingBusy={billingBusy}
            billingError={billingError}
            onChangePlan={handleChangePlan}
            clinicianNotes={clinicianNotes}
            clinicianBusy={clinicianBusy}
            clinicianError={clinicianError}
            onQuickClinicianNote={handleQuickClinicianNote}
            onSignoffClinicianNote={handleSignoffClinicianNote}
            complianceConsent={complianceConsent}
            hipaaAttestation={hipaaAttestation}
            baaRequests={baaRequests}
            deletionRequests={deletionRequests}
            complianceBusy={complianceBusy}
            complianceError={complianceError}
            onRefreshCompliance={refreshCompliance}
            onToggleComplianceConsent={handleToggleComplianceConsent}
            onApplyHipaaAttestation={handleApplyHipaaAttestation}
            onCreateBaaRequest={handleCreateBaaRequest}
            onUpdateBaaRequestStatus={onBaaReviewStatusUpdate}
            onRequestDeletion={handleRequestDeletion}
            onDownloadAuditBundle={handleDownloadAuditBundle}
            opsStatus={opsStatus}
            opsBusy={opsBusy}
            opsError={opsError}
            onRefreshOps={refreshOps}
            activePlan={currentPlanKey}
            trendWindowDays={trendWindowDays}
            onTrendWindowChange={setTrendWindowDays}
            coachContext={coachContext}
            clinicalPlan={clinicalPlan}
            clinicalPlanBusy={clinicalPlanBusy}
            clinicalPlanError={clinicalPlanError}
            onToggleClinicalAction={handleToggleClinicalAction}
            clinicalActionBusy={clinicalActionBusy}
            contraindications={contraindications}
            contraindicationBusy={contraindicationBusy}
            contraindicationError={contraindicationError}
            onContraindicationChange={handleContraindicationChange}
            onSaveContraindications={saveContraindications}
            onExportDailyPlan={exportDailyPlan}
            onExportInvestorPack={exportInvestorEvidencePack}
          />
        </Profiler>
      </main>

      {/* Footer */}
      <footer style={{ borderTop:`1px solid ${C.border}`, background:C.depth,
        padding:"10px 36px", display:"flex", justifyContent:"space-between",
        alignItems:"center" }}>
        <div style={{ display:"flex", gap:24 }}>
          {footerSignals.map((d, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:7 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", flexShrink:0,
                background: d.live ? C.emeraldLight : C.amber,
                animation: d.live ? "none" : "pulse 1.5s infinite" }} />
              <span style={{ fontFamily:F.mono, fontSize:9, color:C.platinumMuted,
                letterSpacing:"0.08em" }}>{d.d} | {d.s}</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily:F.mono, fontSize:9, color:C.platinumMuted,
          letterSpacing:"0.12em" }}>
          AEVUM v1.0 | HIPAA | SOC 2 | E2E ENCRYPTED
        </div>
      </footer>
    </div>
  );
}
