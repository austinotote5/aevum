const isDevelopment = process.env.NODE_ENV !== "production";

export const onAppRenderProfile = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  if (!isDevelopment || typeof window === "undefined") {
    return;
  }

  const payload = {
    id,
    phase,
    actualDuration: Number(actualDuration.toFixed(2)),
    baseDuration: Number(baseDuration.toFixed(2)),
    startTime: Number(startTime.toFixed(2)),
    commitTime: Number(commitTime.toFixed(2)),
    at: new Date().toISOString(),
  };

  window.__AEVUM_RENDER_PROFILE__ = payload;

  if (payload.actualDuration >= 16) {
    console.debug("[aevum-render-profile]", payload);
  }
};
