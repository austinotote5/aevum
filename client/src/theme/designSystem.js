export const C = {
  void: "#060608",
  depth: "#0A0A0E",
  surface: "#0E0E13",
  lift: "#131318",
  raise: "#18181F",
  border: "#1F1F28",
  borderSoft: "#2A2A36",
  platinum: "#C8C8D4",
  platinumDim: "#8A8A9A",
  platinumMuted: "#4A4A58",
  gold: "#C4973A",
  goldLight: "#DDB96A",
  goldDim: "#7A5C1E",
  goldBorder: "#6A4E18",
  cream: "#EDE8DF",
  creamDim: "#9A9286",
  emerald: "#1A6B4A",
  emeraldLight: "#2ECC71",
  rose: "#8B2635",
  roseLight: "#E74C3C",
  sapphire: "#1A3A6B",
  sapphireLight: "#3498DB",
  amber: "#B7770D",
  white: "#F8F8F6",
};

export const F = {
  display: "'Playfair Display', serif",
  body: "'Jost', sans-serif",
  mono: "'Space Mono', monospace",
};

export const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@200;300;400;500&family=Space+Mono:wght@400;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    background: ${C.void};
    color: ${C.cream};
    font-family: ${F.body};
    font-weight: 300;
    -webkit-font-smoothing: antialiased;
    letter-spacing: 0.01em;
  }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: ${C.void}; }
  ::-webkit-scrollbar-thumb { background: ${C.goldBorder}; border-radius: 2px; }

  textarea, input, button { font-family: ${F.body}; }
  textarea:focus, input:focus { outline: none; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes pulse    { 0%,100%{opacity:1;} 50%{opacity:.35;} }
  @keyframes glow     { 0%,100%{box-shadow:0 0 8px ${C.gold}40;} 50%{box-shadow:0 0 20px ${C.gold}80;} }
  @keyframes scanline { 0%{transform:translateY(-100%);} 100%{transform:translateY(100vh);} }
  @keyframes ringDraw { from{stroke-dashoffset:440;} }
  @keyframes breathe  { 0%,100%{transform:scale(1);} 50%{transform:scale(1.04);} }
  @keyframes slideRight { from{opacity:0;transform:translateX(-12px);} to{opacity:1;transform:translateX(0);} }
  @keyframes ticker   { 0%{transform:translateX(0);} 100%{transform:translateX(-50%);} }
  @keyframes spin     { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }

  .fu  { animation: fadeUp .6s cubic-bezier(.16,1,.3,1) both; }
  .fu1 { animation: fadeUp .6s .07s cubic-bezier(.16,1,.3,1) both; }
  .fu2 { animation: fadeUp .6s .14s cubic-bezier(.16,1,.3,1) both; }
  .fu3 { animation: fadeUp .6s .21s cubic-bezier(.16,1,.3,1) both; }
  .fu4 { animation: fadeUp .6s .28s cubic-bezier(.16,1,.3,1) both; }
  .fu5 { animation: fadeUp .6s .35s cubic-bezier(.16,1,.3,1) both; }

  @media (max-width: 980px) {
    .auth-shell { padding: 16px !important; }
    .auth-card { padding: 22px 18px !important; border-radius: 12px !important; }
    .auth-mode-row { flex-wrap: wrap; }
    .auth-register-grid { grid-template-columns: 1fr !important; }

    .topbar-inner {
      padding: 10px 14px !important;
      height: auto !important;
      min-height: 64px;
      align-items: center !important;
      gap: 10px;
      flex-wrap: wrap;
    }

    .topbar-nav {
      order: 3;
      width: 100%;
      overflow-x: auto;
      padding-bottom: 6px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }

    .topbar-nav::-webkit-scrollbar { display: none; }
    .topbar-user { margin-left: auto; }

    .page-shell { padding: 24px 14px !important; }
    .overview-hero { flex-direction: column !important; gap: 18px; align-items: flex-start !important; }
    .overview-tags { flex-wrap: wrap; }
    .overview-alert {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 12px !important;
      padding: 14px !important;
    }

    .overview-metrics { grid-template-columns: 1fr 1fr !important; }

    /* Mobile fail-safe: stack all fixed inline grids to prevent crushed cards/text. */
    [style*="grid-template-columns"] {
      grid-template-columns: 1fr !important;
    }

    .app-footer {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 8px;
      padding: 12px 14px !important;
    }
  }

  @media (max-width: 640px) {
    .topbar-nav button { padding: 10px 12px !important; }
    .overview-metrics { grid-template-columns: 1fr !important; }
  }
`;
