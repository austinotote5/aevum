import { memo } from "react";
import { C, F } from "../../theme/designSystem";

const RuleComponent = ({ style }) => (
  <div
    style={{
      height: 1,
      background: `linear-gradient(90deg, transparent 0%, ${C.goldBorder} 30%, ${C.gold}60 50%, ${C.goldBorder} 70%, transparent 100%)`,
      ...style,
    }}
  />
);

const TagComponent = ({ children, variant = "gold" }) => {
  const colors = {
    gold: { c: C.gold, bg: `${C.gold}10`, b: `${C.gold}30` },
    emerald: { c: C.emeraldLight, bg: `${C.emerald}20`, b: `${C.emerald}50` },
    rose: { c: C.roseLight, bg: `${C.rose}20`, b: `${C.rose}50` },
    platinum: { c: C.platinum, bg: `${C.platinum}08`, b: `${C.borderSoft}` },
  };
  const s = colors[variant];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 9,
        fontFamily: F.mono,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: s.c,
        background: s.bg,
        border: `1px solid ${s.b}`,
        borderRadius: 2,
        padding: "3px 9px",
      }}
    >
      {children}
    </span>
  );
};

const VitalRingComponent = ({ score, size = 200 }) => {
  const r = 82;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  const tier = score >= 85 ? C.gold : score >= 65 ? C.amber : C.roseLight;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="vr1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C.goldLight} stopOpacity="0.9" />
            <stop offset="100%" stopColor={C.gold} stopOpacity="1" />
          </linearGradient>
          <filter id="vglow">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`${tier}14`} strokeWidth="10" />
        <circle cx={cx} cy={cy} r={r - 14} fill="none" stroke={`${C.border}`} strokeWidth="1" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#vr1)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={fill}
          filter="url(#vglow)"
          style={{ animation: "ringDraw 1.6s cubic-bezier(.16,1,.3,1) both" }}
        />
        <circle
          cx={cx}
          cy={cy + r}
          r={5}
          fill={C.gold}
          style={{ transform: `rotate(${(score / 100) * 360}deg)`, transformOrigin: `${cx}px ${cy}px` }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: F.display, fontSize: 46, fontWeight: 500, color: C.cream, lineHeight: 1 }}>
          {score}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.2em", color: C.gold, textTransform: "uppercase", marginTop: 6 }}>
          Vital Index
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: "0.1em", color: C.platinumMuted, textTransform: "uppercase", marginTop: 3 }}>
          {score >= 85 ? "Peak" : score >= 65 ? "Elevated" : "Recovery"}
        </div>
      </div>
    </div>
  );
};

const StatCardComponent = ({ label, value, unit, trend, trendDir, note, cls }) => (
  <div
    className={cls}
    style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: "24px 22px",
      position: "relative",
      overflow: "hidden",
      transition: "border-color .25s, transform .2s",
      cursor: "default",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = C.goldBorder;
      e.currentTarget.style.transform = "translateY(-2px)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = C.border;
      e.currentTarget.style.transform = "translateY(0)";
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${C.gold}40, transparent)`,
        opacity: 0,
        transition: "opacity .25s",
      }}
      className="card-top-line"
    />
    <div
      style={{
        position: "absolute",
        top: -30,
        right: -30,
        width: 90,
        height: 90,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${C.gold}06 0%, transparent 70%)`,
      }}
    />
    <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.platinumMuted, marginBottom: 16 }}>
      {label}
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
      <span style={{ fontFamily: F.display, fontSize: 34, fontWeight: 500, color: C.cream, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: C.platinumDim, fontWeight: 300 }}>{unit}</span>
    </div>
    {trend && (
      <div style={{ fontFamily: F.mono, fontSize: 10, color: trendDir === "up" ? C.emeraldLight : C.roseLight, marginBottom: 8 }}>
        {trendDir === "up" ? "+" : "-"} {trend}
      </div>
    )}
    {note && (
      <div style={{ fontSize: 11.5, color: C.creamDim, lineHeight: 1.65, borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4, fontStyle: "italic" }}>
        {note}
      </div>
    )}
  </div>
);

const tickerItems = [
  "HRV | 67ms | Up 8.2%",
  "RHR | 54 bpm | Optimal",
  "Sleep | 7.4h | 83% Efficiency",
  "Readiness | 91/100 | Peak",
  "VO2 Max | 52 | Athletic",
  "Body Temp | 36.7 C | Normal",
  "SpO2 | 98% | Excellent",
  "Stress Score | 22/100 | Low",
];
const tickerText = tickerItems.join("   |   ");

const TickerComponent = () => (
  <div
    style={{
      overflow: "hidden",
      borderTop: `1px solid ${C.border}`,
      borderBottom: `1px solid ${C.border}`,
      background: C.depth,
      padding: "8px 0",
    }}
  >
    <div style={{ display: "flex", whiteSpace: "nowrap", animation: "ticker 30s linear infinite" }}>
      {[tickerText, tickerText].map((text, index) => (
        <span
          key={index}
          style={{
            fontFamily: F.mono,
            fontSize: 9.5,
            color: C.platinumMuted,
            letterSpacing: "0.1em",
            paddingRight: 80,
          }}
        >
          {text}
        </span>
      ))}
    </div>
  </div>
);

export const Rule = memo(RuleComponent);
export const Tag = memo(TagComponent);
export const VitalRing = memo(VitalRingComponent);
export const StatCard = memo(StatCardComponent);
export const Ticker = memo(TickerComponent);
