// Thin client for the ResumeIQ API.
const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'skillmatch_token';

export const ROLE_TO_API = { Student: 'student', 'Placement officer': 'tpo' };
export const ROLE_FROM_API = { student: 'Student', tpo: 'Placement officer' };

export const tokenStore = {
  get: () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch { /* storage unavailable */ }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* storage unavailable */ }
  },
};

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // No error text from our API means the request never reached it (e.g. the dev proxy got no answer)
    const fallback = res.status >= 500 ? "Couldn't reach the ResumeIQ server. Check that it is running, then try again." : `Request failed (${res.status})`;
    const err = new Error(data.error || fallback);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),

  getProfile: () => request('/profile/me'),
  updateProfile: (payload) => request('/profile/me', { method: 'PUT', body: payload }),
  uploadResume: (file) => {
    const form = new FormData();
    form.append('resume', file);
    return request('/profile/me/resume', { method: 'POST', form });
  },

  // Interview preparation: AI-written questions, then feedback on each answer
  latestInterview: () => request('/interview/latest'),
  startInterview: (setup) => request('/interview/sessions', { method: 'POST', body: setup }),
  answerQuestion: (sessionId, questionId, answer) => request(`/interview/sessions/${sessionId}/questions/${questionId}/answer`, { method: 'POST', body: { answer } }),
  addFollowUp: (sessionId, questionId) => request(`/interview/sessions/${sessionId}/questions/${questionId}/follow-up`, { method: 'POST' }),

  // Placement officer: students ranked by evidence for the skills searched
  studentDepartments: () => request('/students/departments'),
  searchStudents: (filters) => request('/students/search', { method: 'POST', body: filters }),
  // A student's resume file as a Blob
  studentResume: async (userId) => {
    const token = tokenStore.get();
    const res = await fetch(`${BASE}/profile/${userId}/resume`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Could not open the resume (${res.status})`);
    }
    return res.blob();
  },

  // Resume analysis: general (Mode A) and role-specific (Mode B)
  analysisRoles: () => request('/analysis/roles'),
  latestAnalyses: () => request('/analysis/latest'),
  analyseGeneral: () => request('/analysis/general', { method: 'POST' }),
  analyseRole: (role, jd) => request('/analysis/role', { method: 'POST', body: { role, jd } }),

};
