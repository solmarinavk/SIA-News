import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../components/Toast';

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
  return d.toLocaleString();
}

function duration(start, end) {
  if (!start || !end) return '—';
  const s = new Date(start.endsWith('Z') ? start : start + 'Z');
  const e = new Date(end.endsWith('Z') ? end : end + 'Z');
  const diff = Math.round((e - s) / 1000);
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}m ${diff % 60}s`;
}

// ── Results Tab ──────────────────────────────────────────────
function ResultsTab({ projectId, selectedRunId }) {
  const toast = useToast();
  const [results, setResults] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ run_id: selectedRunId || '', keyword: '', source: '', base_only: false });

  useEffect(() => {
    if (selectedRunId) setFilters(f => ({ ...f, run_id: selectedRunId }));
  }, [selectedRunId]);

  useEffect(() => {
    api.getRuns(projectId).then(setRuns).catch(() => {});
  }, [projectId]);

  const loadResults = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getResults(projectId, {
        run_id: filters.run_id || undefined,
        keyword: filters.keyword || undefined,
        source: filters.source || undefined,
        base_only: filters.base_only || undefined,
      });
      setResults(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, filters]);

  useEffect(() => { loadResults(); }, [loadResults]);

  return (
    <div>
      <div className="filters-bar">
        <select value={filters.run_id} onChange={e => setFilters({ ...filters, run_id: e.target.value })}>
          <option value="">Latest Run</option>
          {runs.filter(r => r.status === 'done').map(r => (
            <option key={r.id} value={r.id}>{formatTime(r.finished_at)} ({r.articles_found} articles)</option>
          ))}
        </select>
        <input placeholder="Filter by keyword..." value={filters.keyword} onChange={e => setFilters({ ...filters, keyword: e.target.value })} />
        <input placeholder="Filter by source..." value={filters.source} onChange={e => setFilters({ ...filters, source: e.target.value })} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={filters.base_only} onChange={e => setFilters({ ...filters, base_only: e.target.checked })} />
          Base sources only
        </label>
      </div>

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading results...</p> : results.length === 0 ? (
        <div className="empty-state">
          <h3>No results yet</h3>
          <p>Run a search to see news articles here.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Source</th>
                <th>Keywords</th>
                <th style={{ minWidth: 200 }}>Summary</th>
                <th>Published</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id}>
                  <td>
                    <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
                    {r.is_from_base_source && <span className="badge badge-base" style={{ marginLeft: 6 }}>Base</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.source_domain}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(r.keywords_found || []).map((kw, i) => (
                        <span key={i} className="pill" style={{ fontSize: 11 }}>{kw}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 300 }}>{r.summary}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{formatTime(r.published_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Config Tab ───────────────────────────────────────────────
function ConfigTab({ project, onUpdate }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: project.name,
    description: project.description || '',
    time_window: project.time_window,
    schedule_frequency: project.schedule_frequency,
    schedule_hour: project.schedule_hour,
    schedule_enabled: !!project.schedule_enabled,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProject(project.id, form);
      toast('Project updated', 'success');
      onUpdate(updated);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 600 }}>
      <div className="form-group">
        <label>Project Name</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="form-group">
        <label>Time Window</label>
        <select value={form.time_window} onChange={e => setForm({ ...form, time_window: e.target.value })}>
          <option value="24h">Last 24 hours</option>
          <option value="48h">Last 48 hours</option>
          <option value="7d">Last 7 days</option>
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Frequency</label>
          <select value={form.schedule_frequency} onChange={e => setForm({ ...form, schedule_frequency: e.target.value })}>
            <option value="daily">Daily</option>
            <option value="every_2_days">Every 2 days</option>
            <option value="weekly">Weekly (Monday)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Run Hour (UTC)</label>
          <select value={form.schedule_hour} onChange={e => setForm({ ...form, schedule_hour: parseInt(e.target.value) })}>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Schedule</label>
        <div className="toggle-wrap">
          <label className="toggle">
            <input type="checkbox" checked={form.schedule_enabled} onChange={e => setForm({ ...form, schedule_enabled: e.target.checked })} />
            <span className="toggle-slider" />
          </label>
          <span style={{ fontSize: 14 }}>{form.schedule_enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      </div>
      <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
    </div>
  );
}

// ── Sources Tab ──────────────────────────────────────────────
function SourcesTab({ projectId }) {
  const toast = useToast();
  const [sources, setSources] = useState([]);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');

  const load = async () => {
    try { setSources(await api.getSources(projectId)); } catch {}
  };

  useEffect(() => { load(); }, [projectId]);

  const addSource = async () => {
    if (!url.trim()) return;
    try {
      await api.addSource(projectId, { url: url.trim(), label: label.trim() });
      setUrl(''); setLabel('');
      load();
      toast('Source added', 'success');
    } catch (err) { toast(err.message, 'error'); }
  };

  const removeSource = async (id) => {
    try {
      await api.deleteSource(id);
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" style={{ flex: 2 }}
          onKeyDown={e => { if (e.key === 'Enter') addSource(); }} />
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (optional)" style={{ flex: 1 }} />
        <button className="btn-primary" onClick={addSource}>Add Source</button>
      </div>

      {sources.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No base sources configured.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Label</th><th>URL</th><th style={{ width: 60 }}></th></tr>
            </thead>
            <tbody>
              {sources.map(s => (
                <tr key={s.id}>
                  <td>{s.label || '—'}</td>
                  <td><a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a></td>
                  <td><button className="btn-danger btn-sm" onClick={() => removeSource(s.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Keywords Tab ─────────────────────────────────────────────
function KeywordsTab({ projectId }) {
  const toast = useToast();
  const [keywords, setKeywords] = useState([]);
  const [input, setInput] = useState('');

  const load = async () => {
    try { setKeywords(await api.getKeywords(projectId)); } catch {}
  };

  useEffect(() => { load(); }, [projectId]);

  const addKeyword = async () => {
    if (!input.trim()) return;
    try {
      await api.addKeyword(projectId, input.trim());
      setInput('');
      load();
      toast('Keyword added', 'success');
    } catch (err) { toast(err.message, 'error'); }
  };

  const removeKeyword = async (id) => {
    try {
      await api.deleteKeyword(id);
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, maxWidth: 500 }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Add keyword..."
          onKeyDown={e => { if (e.key === 'Enter') addKeyword(); }} />
        <button className="btn-primary" onClick={addKeyword}>Add</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {keywords.map(kw => (
          <span key={kw.id} className="pill" style={{ fontSize: 14, padding: '6px 14px' }}>
            {kw.keyword}
            <span className="pill-remove" onClick={() => removeKeyword(kw.id)}>&times;</span>
          </span>
        ))}
        {keywords.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No keywords configured.</p>}
      </div>
    </div>
  );
}

// ── Runs Tab ─────────────────────────────────────────────────
function RunsTab({ projectId, onSelectRun }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getRuns(projectId).then(setRuns).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading...</p>;

  return runs.length === 0 ? (
    <div className="empty-state"><h3>No runs yet</h3><p>Trigger a manual run or wait for the schedule.</p></div>
  ) : (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Date</th><th>Status</th><th>Articles</th><th>Duration</th><th></th></tr>
        </thead>
        <tbody>
          {runs.map(r => (
            <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => onSelectRun(r.id)}>
              <td>{formatTime(r.started_at)}</td>
              <td>
                <span className={`badge ${r.status === 'done' ? 'badge-active' : r.status === 'running' ? 'badge-running' : 'badge-error'}`}>
                  {r.status}
                </span>
              </td>
              <td>{r.articles_found ?? '—'}</td>
              <td>{duration(r.started_at, r.finished_at)}</td>
              <td>{r.error_message && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{r.error_message}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Project View ────────────────────────────────────────
export default function ProjectView() {
  const { id } = useParams();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('results');
  const [runStatus, setRunStatus] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const pollRef = useRef(null);

  const loadProject = async () => {
    try {
      const projects = await api.getProjects();
      const p = projects.find(p => p.id === id);
      if (p) setProject(p);
    } catch {}
  };

  useEffect(() => { loadProject(); }, [id]);

  // Poll for running status
  useEffect(() => {
    if (!runStatus || runStatus !== 'running') return;

    pollRef.current = setInterval(async () => {
      try {
        const runs = await api.getRuns(id);
        const running = runs.find(r => r.status === 'running');
        if (!running) {
          setRunStatus(null);
          clearInterval(pollRef.current);
          const latest = runs[0];
          if (latest && latest.status === 'done') {
            toast(`Search complete: ${latest.articles_found} articles found`, 'success');
          } else if (latest && latest.status === 'error') {
            toast(`Search failed: ${latest.error_message || 'Unknown error'}`, 'error');
          }
          loadProject();
        }
      } catch {}
    }, 5000);

    return () => clearInterval(pollRef.current);
  }, [runStatus, id]);

  const handleRunNow = async () => {
    try {
      await api.triggerRun(id);
      setRunStatus('running');
      toast('Search started...', 'info');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (!project) return <div className="container" style={{ marginTop: 40 }}><p>Loading project...</p></div>;

  const tabs = [
    { key: 'results', label: 'Results' },
    { key: 'config', label: 'Configuration' },
    { key: 'sources', label: 'Sources' },
    { key: 'keywords', label: 'Keywords' },
    { key: 'runs', label: 'Run History' },
  ];

  return (
    <div>
      <Link to="/" className="back-link">&larr; Back to Projects</Link>

      <div className="page-header">
        <div>
          <h2>{project.name}</h2>
          {project.description && <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>{project.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {runStatus === 'running' && (
            <span className="badge badge-running">Searching...</span>
          )}
          <button className="btn-primary" onClick={handleRunNow} disabled={runStatus === 'running'}>
            Run Now
          </button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'results' && <ResultsTab projectId={id} selectedRunId={selectedRunId} />}
      {tab === 'config' && <ConfigTab project={project} onUpdate={setProject} />}
      {tab === 'sources' && <SourcesTab projectId={id} />}
      {tab === 'keywords' && <KeywordsTab projectId={id} />}
      {tab === 'runs' && <RunsTab projectId={id} onSelectRun={(runId) => { setSelectedRunId(runId); setTab('results'); }} />}
    </div>
  );
}
