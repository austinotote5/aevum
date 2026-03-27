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
  html, body, #root { width: 100%; overflow-x: hidden; }
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

  textarea, input, button, select { font-family: ${F.body}; }
  textarea:focus, input:focus { outline: none; }
  button, input, select, textarea { touch-action: manipulation; }
  button { min-height: 42px; }
  a, button, [role="button"], input, select, textarea {
    -webkit-tap-highlight-color: transparent;
  }
  :focus-visible {
    outline: 2px solid ${C.gold};
    outline-offset: 2px;
  }

  .context-rail-wrap {
    max-width: 1140px;
    margin: 0 auto;
    padding: 16px 36px 10px;
  }
  .context-rail {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid ${C.border};
    border-radius: 12px;
    background: linear-gradient(145deg, ${C.surface} 0%, ${C.lift} 100%);
  }
  .context-rail-title {
    color: ${C.cream};
    font-family: ${F.display};
    font-size: 22px;
    line-height: 1.1;
    margin-bottom: 5px;
  }
  .context-rail-subtitle {
    color: ${C.creamDim};
    font-size: 12px;
    line-height: 1.6;
    max-width: 700px;
  }
  .context-rail-action {
    border: 1px solid ${C.goldBorder};
    border-radius: 10px;
    background: ${C.gold}18;
    color: ${C.gold};
    min-height: 46px;
    padding: 0 16px;
    font-size: 10px;
    letter-spacing: .12em;
    text-transform: uppercase;
    font-family: ${F.mono};
    cursor: pointer;
    white-space: nowrap;
  }
  .context-rail-action:disabled {
    opacity: .6;
    cursor: not-allowed;
  }
  .trust-chip-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-top: 10px;
  }
  .trust-chip {
    border: 1px solid ${C.border};
    border-radius: 10px;
    background: ${C.depth};
    padding: 9px 10px;
  }
  .trust-chip-label {
    display: block;
    color: ${C.platinumMuted};
    font-family: ${F.mono};
    font-size: 8px;
    letter-spacing: .12em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .trust-chip-value {
    color: ${C.cream};
    font-size: 12px;
    line-height: 1.4;
    font-weight: 400;
  }

  .mobile-drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.58);
    opacity: 0;
    pointer-events: none;
    transition: opacity .25s ease;
    z-index: 320;
  }

  .mobile-drawer-overlay.open {
    opacity: 1;
    pointer-events: auto;
  }

  .mobile-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: min(86vw, 360px);
    height: 100dvh;
    background: linear-gradient(180deg, ${C.surface} 0%, ${C.depth} 100%);
    border-left: 1px solid ${C.border};
    box-shadow: -16px 0 40px rgba(0, 0, 0, 0.45);
    transform: translateX(102%);
    transition: transform .28s cubic-bezier(.16,1,.3,1);
    z-index: 340;
    padding: 18px 14px calc(20px + env(safe-area-inset-bottom, 0px));
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .mobile-drawer.open { transform: translateX(0); }
  .mobile-drawer-head { display: flex; align-items: center; justify-content: space-between; }
  .mobile-drawer-user {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid ${C.border};
    background: ${C.lift};
  }

  .mobile-drawer-nav { display: grid; gap: 10px; margin-top: 2px; }
  .mobile-drawer-nav-item {
    min-height: 48px;
    border-radius: 12px;
    border: 1px solid ${C.border};
    padding: 0 14px;
    text-align: left;
    font-family: ${F.mono};
    font-size: 10px;
    letter-spacing: .12em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .mobile-drawer-signout {
    margin-top: auto;
    min-height: 48px;
    border-radius: 12px;
    border: 1px solid ${C.goldBorder};
    background: ${C.gold}14;
    color: ${C.gold};
    font-family: ${F.mono};
    font-size: 10px;
    letter-spacing: .12em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .mobile-tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 280;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
    padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(180deg, rgba(10,10,14,0.92) 0%, rgba(6,6,8,0.97) 100%);
    border-top: 1px solid ${C.border};
    backdrop-filter: blur(16px);
  }

  .mobile-tabbar-item {
    min-height: 46px;
    border-radius: 12px;
    border: 1px solid ${C.border};
    background: ${C.surface};
    color: ${C.platinumMuted};
    font-family: ${F.mono};
    font-size: 8px;
    letter-spacing: .1em;
    text-transform: uppercase;
    padding: 0 6px;
    cursor: pointer;
  }

  .mobile-tabbar-item.active {
    color: ${C.gold};
    border-color: ${C.goldBorder};
    background: ${C.gold}12;
  }

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
      justify-content: space-between !important;
    }

    .topbar-user { display: none !important; }
    .mobile-menu-toggle { display: inline-flex !important; }

    .context-rail-wrap { padding: 12px 12px 8px !important; }
    .context-rail {
      flex-direction: column !important;
      align-items: flex-start !important;
      padding: 12px !important;
    }
    .context-rail-title { font-size: 20px !important; }
    .context-rail-subtitle { font-size: 11.5px !important; }
    .context-rail-action { width: 100%; min-height: 48px; }
    .trust-chip-row {
      grid-template-columns: 1fr 1fr !important;
      gap: 8px !important;
    }

    .page-shell { padding: 20px 12px 104px !important; }
    .ticker-shell { display: none; }
    .app-main { padding-bottom: 92px; }
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
    .mobile-tabbar {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      row-gap: 8px;
    }
    .overview-metrics { grid-template-columns: 1fr !important; }
    .trust-chip-row { grid-template-columns: 1fr !important; }
  }
`;
