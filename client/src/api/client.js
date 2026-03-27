const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL
  || process.env.REACT_APP_API_URL
  || 'http://localhost:4000'
).replace(/\/+$/, '');
const AUTH_TOKEN_KEY = 'aevum_auth_token';
const MAX_GET_RETRY_ATTEMPTS = 2;

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePath = (path) => (
  String(path || '').startsWith('/')
    ? String(path || '')
    : `/${String(path || '')}`
);

const buildApiUrl = (path, baseUrl = API_BASE_URL) => {
  const normalizedBase = String(baseUrl || '').replace(/\/+$/, '');
  const normalizedPath = String(path || '').startsWith('/')
    ? String(path || '')
    : `/${String(path || '')}`;

  const baseEndsWithApi = /\/api$/i.test(normalizedBase);
  const pathStartsWithApi = /^\/api(\/|$)/i.test(normalizedPath);

  if (baseEndsWithApi && pathStartsWithApi) {
    return `${normalizedBase}${normalizedPath.replace(/^\/api/i, '')}`;
  }

  return `${normalizedBase}${normalizedPath}`;
};

const getCandidateApiUrls = (path) => {
  const normalizedPath = normalizePath(path);
  const candidatePaths = [normalizedPath];
  if (/^\/api\//i.test(normalizedPath)) {
    candidatePaths.push(normalizedPath.replace(/^\/api/i, ''));
  }

  const candidates = [];
  const pushCandidate = (baseUrl, pathVariant) => {
    candidates.push(buildApiUrl(pathVariant, baseUrl));
  };

  candidatePaths.forEach((pathVariant) => {
    pushCandidate(API_BASE_URL, pathVariant);
  });

  try {
    const parsed = new URL(API_BASE_URL);
    const originBase = `${parsed.protocol}//${parsed.host}`;
    candidatePaths.forEach((pathVariant) => {
      pushCandidate(originBase, pathVariant);
      pushCandidate(`${originBase}/api`, pathVariant);
    });
  } catch {
    // Ignore invalid custom API base and keep default fallback candidates.
  }

  if (process.env.NODE_ENV !== 'production') {
    candidatePaths.forEach((pathVariant) => {
      pushCandidate('http://localhost:4000', pathVariant);
      pushCandidate('http://localhost:4000/api', pathVariant);
    });
  }

  return Array.from(new Set(candidates));
};

const isNotFoundError = (error) => (
  error instanceof ApiClientError
  && error.status === 404
  && error.code === 'NOT_FOUND'
);

const toPlanStats = (billing) => {
  const plan = String(billing?.plan || 'free').toLowerCase();
  const premiumUsers = plan === 'premium' ? 1 : 0;
  const enterpriseUsers = plan === 'enterprise' ? 1 : 0;
  const paidUsers = premiumUsers + enterpriseUsers;
  const mrrEstimate = (premiumUsers * 29) + (enterpriseUsers * 99);
  return {
    premiumUsers,
    enterpriseUsers,
    paidUsers,
    mrrEstimate,
    conversionRatePct: paidUsers > 0 ? 100 : 0,
  };
};

const buildFallbackPlatformSummary = ({ outcomes, billing }) => {
  const aggregateScore = Number(outcomes?.aggregateScore);
  const horizons = Array.isArray(outcomes?.horizons) ? outcomes.horizons : [];
  const actionableHorizon = horizons.find((h) => Number.isFinite(Number(h?.score)));
  const fallbackScore = Number.isFinite(aggregateScore)
    ? aggregateScore
    : Number.isFinite(Number(actionableHorizon?.score))
      ? Number(actionableHorizon?.score)
      : 0;
  const planStats = toPlanStats(billing);

  return {
    generatedAt: new Date().toISOString(),
    cohort: {
      activeMembers: 1,
      avgReadiness: Number(fallbackScore.toFixed(1)),
      avgRisk: fallbackScore > 0 ? Number((100 - fallbackScore).toFixed(1)) : 0,
      engagementRate: 0,
      riskBands: { low: 0, moderate: 1, high: 0 },
      planMix: {
        free: planStats.paidUsers > 0 ? 0 : 1,
        premium: planStats.premiumUsers,
        enterprise: planStats.enterpriseUsers,
      },
    },
    roi: {
      riskReductionPct: 0,
      productivityGainPct: 0,
      costSavedPerMemberYear: 0,
      projectedRoiX: 0,
      confidence: 'calibrating',
    },
    clinicianOps: {
      noteCount: 0,
      signedOffCount: 0,
      pendingSignoff: 0,
      signoffRate: 0,
    },
    interventions: {
      actionsAnalyzed: 0,
      topActions: [],
    },
    reliability: {
      dataQualityScore: 0,
      syncCoveragePct: 0,
      nonManualIngestionPct: 0,
      importFailureRatePct: 0,
      staleUserCount: 0,
    },
    monetization: {
      paidUsers: planStats.paidUsers,
      premiumUsers: planStats.premiumUsers,
      enterpriseUsers: planStats.enterpriseUsers,
      mrrEstimate: planStats.mrrEstimate,
      conversionRatePct: planStats.conversionRatePct,
    },
    traction: {
      paidMembers: planStats.paidUsers,
      retention30Pct: 0,
      expansionMrr90: 0,
      contractionMrr90: 0,
    },
    clinicalValidation: {
      active: 0,
      completed: 0,
      published: 0,
      totalStudies: 0,
    },
    regulatory: {
      readinessPct: 0,
      approvedArtifacts: 0,
      totalArtifacts: 0,
      criticalOpen: 0,
    },
  };
};

class ApiClientError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED', details = null) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const parseResponse = async (response) => {
  const raw = await response.text();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const request = async (path, { method = 'GET', token, body } = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'x-request-id': createRequestId(),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const candidates = getCandidateApiUrls(path);
  let lastError = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index];
    const maxAttempts = method.toUpperCase() === 'GET' ? MAX_GET_RETRY_ATTEMPTS : 1;
    let moveToNextCandidate = false;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        const payload = await parseResponse(response);
        if (response.ok) {
          return payload?.data;
        }

        let message = payload?.error?.message
          || (typeof payload?.error === 'string' ? payload.error : 'Request failed.');
        const code = payload?.error?.code || (typeof payload?.error === 'string' ? 'REQUEST_FAILED' : 'REQUEST_FAILED');
        const details = payload?.error?.details || null;

        const isEnterpriseRoute = /^\/api\/(platform|ops|clinician|compliance)\b/i.test(String(path || ''));
        const canRetryNextCandidate = (
          index < candidates.length - 1
          && response.status === 404
          && code === 'NOT_FOUND'
        );
        const canRetryCurrentCandidate = (
          method.toUpperCase() === 'GET'
          && attempt < (maxAttempts - 1)
          && response.status >= 500
        );

        if (isEnterpriseRoute && response.status === 404 && code === 'NOT_FOUND' && !canRetryNextCandidate) {
          message = 'Enterprise endpoint unavailable on current backend.';
        }

        lastError = new ApiClientError(
          message,
          response.status,
          code,
          details
        );

        if (canRetryCurrentCandidate) {
          await wait(120 * (attempt + 1));
          continue;
        }

        if (canRetryNextCandidate) {
          moveToNextCandidate = true;
          break;
        }

        throw lastError;
      } catch (error) {
        if (error instanceof ApiClientError) {
          throw error;
        }

        lastError = new ApiClientError(
          error?.message || 'Request failed.',
          0,
          'REQUEST_FAILED',
          null
        );

        const canRetryNetwork = method.toUpperCase() === 'GET' && attempt < (maxAttempts - 1);
        if (canRetryNetwork) {
          await wait(120 * (attempt + 1));
          continue;
        }
      }
    }

    if (moveToNextCandidate) {
      continue;
    }
  }

  throw lastError || new ApiClientError('Request failed.', 0, 'REQUEST_FAILED', null);
};

const authApi = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/api/auth/me', { token }),
};

const coachApi = {
  sendMessage: ({ token, message, sessionId, context }) => request('/api/coach/message', {
    method: 'POST',
    token,
    body: {
      message,
      ...(sessionId ? { sessionId } : {}),
      ...(context ? { context } : {}),
    },
  }),
};

const biometricsApi = {
  latest: (token) => request('/api/biometrics/latest', { token }),
  recent: (token, limit = 30) => request(`/api/biometrics/recent?limit=${encodeURIComponent(limit)}`, { token }),
  createEntry: ({ token, payload }) => request('/api/biometrics', {
    method: 'POST',
    token,
    body: payload,
  }),
};

const protocolsApi = {
  today: (token, refresh = false) => request(
    `/api/protocols/today${refresh ? '?refresh=1' : ''}`,
    { token }
  ),
  versions: ({ token, protocolId, limit = 8 }) => request(
    `/api/protocols/${encodeURIComponent(protocolId)}/versions?limit=${encodeURIComponent(limit)}`,
    { token }
  ),
  completeAction: ({ token, protocolId, actionIndex, completed = true }) => request(
    `/api/protocols/${encodeURIComponent(protocolId)}/complete`,
    {
      method: 'POST',
      token,
      body: {
        actionIndex,
        completed,
      },
    }
  ),
};

const contraindicationsApi = {
  get: (token) => request('/api/contraindications', { token }),
  update: ({ token, payload }) => request('/api/contraindications', {
    method: 'PUT',
    token,
    body: payload,
  }),
};

const wearablesApi = {
  connections: (token) => request('/api/wearables/connections', { token }),
  connect: ({ token, payload }) => request('/api/wearables/connect', {
    method: 'POST',
    token,
    body: payload,
  }),
  importReadings: ({ token, payload }) => request('/api/wearables/import', {
    method: 'POST',
    token,
    body: payload,
  }),
};

const outcomesApi = {
  summary: (token) => request('/api/outcomes/summary', { token }),
};

const platformApi = {
  summary: async (token) => {
    try {
      return await request('/api/platform/summary', { token });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }

      const [outcomes, billing] = await Promise.all([
        outcomesApi.summary(token).catch(() => null),
        billingApi.entitlements(token).catch(() => null),
      ]);

      return buildFallbackPlatformSummary({ outcomes, billing });
    }
  },
  evidence: async (token, limit = 100) => {
    try {
      return await request(`/api/platform/evidence?limit=${encodeURIComponent(limit)}`, { token });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      return {
        clinicalStudies: [],
        regulatoryArtifacts: [],
        summaries: {
          clinicalValidation: { active: 0, completed: 0, published: 0, totalStudies: 0 },
          regulatory: { readinessPct: 0, approvedArtifacts: 0, totalArtifacts: 0, criticalOpen: 0 },
        },
      };
    }
  },
  createClinicalStudy: ({ token, payload }) => request('/api/platform/clinical-studies', {
    method: 'POST',
    token,
    body: payload,
  }),
  updateClinicalStudy: ({ token, studyId, payload }) => request(
    `/api/platform/clinical-studies/${encodeURIComponent(studyId)}`,
    {
      method: 'PATCH',
      token,
      body: payload,
    }
  ),
  createRegulatoryArtifact: ({ token, payload }) => request('/api/platform/regulatory-artifacts', {
    method: 'POST',
    token,
    body: payload,
  }),
  updateRegulatoryArtifact: ({ token, artifactId, payload }) => request(
    `/api/platform/regulatory-artifacts/${encodeURIComponent(artifactId)}`,
    {
      method: 'PATCH',
      token,
      body: payload,
    }
  ),
};

const clinicianApi = {
  notes: async (token, limit = 20) => {
    try {
      return await request(`/api/clinician/notes?limit=${encodeURIComponent(limit)}`, { token });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      return [];
    }
  },
  createNote: ({ token, payload }) => request('/api/clinician/notes', {
    method: 'POST',
    token,
    body: payload,
  }),
  signoffNote: ({ token, noteId }) => request(`/api/clinician/notes/${encodeURIComponent(noteId)}/signoff`, {
    method: 'POST',
    token,
  }),
};

const billingApi = {
  entitlements: (token) => request('/api/billing/entitlements', { token }),
  updatePlan: ({ token, targetPlan }) => request('/api/billing/plan', {
    method: 'POST',
    token,
    body: { targetPlan },
  }),
};

const complianceApi = {
  getConsent: async (token) => {
    try {
      return await request('/api/compliance/consent', { token });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      return null;
    }
  },
  updateConsent: ({ token, payload }) => request('/api/compliance/consent', {
    method: 'PUT',
    token,
    body: payload,
  }),
  getHipaaAttestation: async (token) => {
    try {
      return await request('/api/compliance/hipaa-attestation', { token });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      return null;
    }
  },
  updateHipaaAttestation: ({ token, payload }) => request('/api/compliance/hipaa-attestation', {
    method: 'PUT',
    token,
    body: payload,
  }),
  listBaaRequests: async (token, limit = 10) => {
    try {
      return await request(
        `/api/compliance/baa-requests?limit=${encodeURIComponent(limit)}`,
        { token }
      );
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      return [];
    }
  },
  createBaaRequest: ({ token, payload }) => request('/api/compliance/baa-requests', {
    method: 'POST',
    token,
    body: payload,
  }),
  updateBaaRequestStatus: ({ token, requestId, payload }) => request(
    `/api/compliance/baa-requests/${encodeURIComponent(requestId)}/status`,
    {
      method: 'PATCH',
      token,
      body: payload,
    }
  ),
  listDeletionRequests: async (token, limit = 10) => {
    try {
      return await request(
        `/api/compliance/deletion-requests?limit=${encodeURIComponent(limit)}`,
        { token }
      );
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      return [];
    }
  },
  requestDeletion: ({ token, payload }) => request('/api/compliance/deletion-requests', {
    method: 'POST',
    token,
    body: payload,
  }),
  getAuditBundle: (token) => request('/api/compliance/audit-bundle', { token }),
};

const opsApi = {
  status: async (token) => {
    try {
      return await request('/api/ops/status', { token });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      return {
        generatedAt: new Date().toISOString(),
        status: 'warning',
        runtime: { uptimeSeconds: 0 },
        dependencies: { database: { latencyMs: null } },
        telemetry: { wearableImportFailureRate7d: 0, pendingDeletionRequests: 0 },
      };
    }
  },
};

const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY) || '';
const setAuthToken = (token) => localStorage.setItem(AUTH_TOKEN_KEY, token);
const clearAuthToken = () => localStorage.removeItem(AUTH_TOKEN_KEY);

export {
  ApiClientError,
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
};
