const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Projects
  getProjects: () => request('/projects'),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  // Sources
  getSources: (projectId) => request(`/projects/${projectId}/sources`),
  addSource: (projectId, data) => request(`/projects/${projectId}/sources`, { method: 'POST', body: JSON.stringify(data) }),
  deleteSource: (id) => request(`/sources/${id}`, { method: 'DELETE' }),

  // Keywords
  getKeywords: (projectId) => request(`/projects/${projectId}/keywords`),
  addKeyword: (projectId, keyword) => request(`/projects/${projectId}/keywords`, { method: 'POST', body: JSON.stringify({ keyword }) }),
  deleteKeyword: (id) => request(`/keywords/${id}`, { method: 'DELETE' }),

  // Runs
  triggerRun: (projectId) => request(`/projects/${projectId}/run`, { method: 'POST' }),
  getRuns: (projectId) => request(`/projects/${projectId}/runs`),
  getRun: (runId) => request(`/runs/${runId}`),

  // Results
  getResults: (projectId, params = {}) => {
    const qs = new URLSearchParams();
    if (params.run_id) qs.set('run_id', params.run_id);
    if (params.keyword) qs.set('keyword', params.keyword);
    if (params.source) qs.set('source', params.source);
    if (params.base_only) qs.set('base_only', 'true');
    const query = qs.toString();
    return request(`/projects/${projectId}/results${query ? `?${query}` : ''}`);
  },
};
