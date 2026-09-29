export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function getAuthHeader() {
 const token = localStorage.getItem('sih_auth_token');
 return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
 const url = `${API_BASE}${endpoint}`;
 const headers = {
  'Content-Type': 'application/json',
  ...getAuthHeader(),
  ...(options.headers || {})
 };

 try {
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
   let errorMsg = `Server error (${res.status})`;
   try {
    const errJson = await res.json();
    errorMsg = errJson.detail || errJson.message || errorMsg;
   } catch (_) {}
   throw new Error(errorMsg);
  }
  return await res.json();
 } catch (err) {
  console.error(`API Error [${endpoint}]:`, err.message);
  throw err;
 }
}

// ── Auth API ──
export const authApi = {
 login: async (username, password) => {
  const res = await request('/auth/login', {
   method: 'POST',
   body: JSON.stringify({ username, password })
  });
  if (res.access_token) {
   localStorage.setItem('sih_auth_token', res.access_token);
   localStorage.setItem('sih_user', JSON.stringify(res.user));
  }
  return res;
 },
 getMe: () => request('/auth/me'),
 logout: async () => {
  try {
   await request('/auth/logout', { method: 'POST' });
  } catch (_) {}
  localStorage.removeItem('sih_auth_token');
  localStorage.removeItem('sih_user');
 }
};

// ── Trace API ──
export const traceApi = {
 startTrace: (params) => request('/trace', {
  method: 'POST',
  body: JSON.stringify(params)
 }),
 getStatus: (caseId) => request(`/trace/${caseId}/status`),
 getResult: (caseId) => request(`/trace/${caseId}/result`),
 cancelTrace: (caseId) => request(`/trace/${caseId}/cancel`, { method: 'POST' }),

 subscribeTraceSSE: (caseId, onEvent, onError) => {
  const url = `${API_BASE}/trace/${caseId}/stream`;
  const eventSource = new EventSource(url);

  eventSource.addEventListener('progress', (e) => {
   try {
    onEvent('progress', JSON.parse(e.data));
   } catch (_) {}
  });

  eventSource.addEventListener('hop_found', (e) => {
   try {
    onEvent('hop_found', JSON.parse(e.data));
   } catch (_) {}
  });

  eventSource.addEventListener('vasp_detected', (e) => {
   try {
    onEvent('vasp_detected', JSON.parse(e.data));
   } catch (_) {}
  });

  eventSource.addEventListener('complete', (e) => {
   try {
    onEvent('complete', JSON.parse(e.data));
   } catch (_) {}
   eventSource.close();
  });

  eventSource.addEventListener('error', (e) => {
   if (onError) onError(e);
   eventSource.close();
  });

  return () => eventSource.close();
 }
};

// ── Reports API ──
export const reportsApi = {
 getReports: (limit = 50, offset = 0) => request(`/reports?limit=${limit}&offset=${offset}`),
 getReport: (caseId) => request(`/reports/${caseId}`),
 deleteReport: (caseId) => request(`/reports/${caseId}`, { method: 'DELETE' }),
 uploadReport: async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const headers = { ...getAuthHeader() };
  const res = await fetch(`${API_BASE}/reports/upload`, {
   method: 'POST',
   headers,
   body: formData
  });
  if (!res.ok) {
   const err = await res.json();
   throw new Error(err.detail || 'Upload failed');
  }
  return await res.json();
 },
 getDownloadUrl: (caseId) => `${API_BASE}/reports/${caseId}/json`
};

// ── VASP Registry API ──
export const vaspApi = {
 getRegistry: (params = {}) => {
  const q = new URLSearchParams();
  if (params.search) q.append('search', params.search);
  if (params.chain) q.append('chain', params.chain);
  if (params.vasp_type) q.append('vasp_type', params.vasp_type);
  if (params.country) q.append('country', params.country);
  if (params.limit) q.append('limit', params.limit);
  if (params.offset) q.append('offset', params.offset);
  return request(`/vasp/registry?${q.toString()}`);
 },
 lookup: (address) => request(`/vasp/lookup/${encodeURIComponent(address)}`),
 addVasp: (data) => request('/vasp/add', {
  method: 'POST',
  body: JSON.stringify(data)
 }),
 getStats: () => request('/vasp/stats')
};

// ── Alerts API ──
export const alertsApi = {
 getAlerts: (severity) => request(severity ? `/alerts?severity=${severity}` : '/alerts'),
 markRead: (alertId) => request(`/alerts/${alertId}/read`, { method: 'POST' }),
 getUnreadCount: () => request('/alerts/unread-count')
};

// ── Batch Tracing API ──
export const batchApi = {
 submitBatch: (addresses, blockchain = 'Auto', maxHops = 10) => request('/batch', {
  method: 'POST',
  body: JSON.stringify({ addresses, blockchain, max_hops: maxHops })
 }),
 getBatches: () => request('/batch'),
 getBatchStatus: (batchId) => request(`/batch/${batchId}`)
};

// ── SAHYOG Notice API ──
export const sahyogApi = {
 createNotice: (payload) => request('/sahyog/notice', {
  method: 'POST',
  body: JSON.stringify(payload)
 })
};

// ── Admin & Audit API ──
export const adminApi = {
 getStats: () => request('/admin/stats'),
 getAuditLog: (limit = 100) => request(`/admin/audit?limit=${limit}`),
 getUsers: () => request('/admin/users')
};
