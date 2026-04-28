import React, { useState } from 'react';
import { api } from '../api';
import { useToast } from './Toast';

export default function CreateProjectModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    description: '',
    time_window: '24h',
    schedule_frequency: 'daily',
    schedule_hour: 9,
    schedule_enabled: true,
  });
  const [keywords, setKeywords] = useState([]);
  const [kwInput, setKwInput] = useState('');
  const [sources, setSources] = useState([]);
  const [srcUrl, setSrcUrl] = useState('');
  const [srcLabel, setSrcLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKwInput('');
    }
  };

  const addSource = () => {
    const url = srcUrl.trim();
    if (url) {
      setSources([...sources, { url, label: srcLabel.trim() }]);
      setSrcUrl('');
      setSrcLabel('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast('Project name is required', 'error');
    setSaving(true);
    try {
      const project = await api.createProject({
        ...form,
        keywords,
        sources,
      });
      toast('Project created', 'success');
      onCreated(project);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Create New Project</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Project Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Tech Industry News" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Time Window</label>
              <select value={form.time_window} onChange={e => setForm({ ...form, time_window: e.target.value })}>
                <option value="24h">Last 24 hours</option>
                <option value="48h">Last 48 hours</option>
                <option value="7d">Last 7 days</option>
              </select>
            </div>
            <div className="form-group">
              <label>Frequency</label>
              <select value={form.schedule_frequency} onChange={e => setForm({ ...form, schedule_frequency: e.target.value })}>
                <option value="daily">Daily</option>
                <option value="every_2_days">Every 2 days</option>
                <option value="weekly">Weekly (Monday)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Run Hour (UTC)</label>
              <select value={form.schedule_hour} onChange={e => setForm({ ...form, schedule_hour: parseInt(e.target.value) })}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Schedule</label>
              <div className="toggle-wrap" style={{ marginTop: 8 }}>
                <label className="toggle">
                  <input type="checkbox" checked={form.schedule_enabled} onChange={e => setForm({ ...form, schedule_enabled: e.target.checked })} />
                  <span className="toggle-slider" />
                </label>
                <span style={{ fontSize: 14 }}>{form.schedule_enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Keywords</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={kwInput} onChange={e => setKwInput(e.target.value)} placeholder="Add keyword..."
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }} />
              <button type="button" className="btn-secondary" onClick={addKeyword}>Add</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {keywords.map((kw, i) => (
                <span key={i} className="pill">
                  {kw}
                  <span className="pill-remove" onClick={() => setKeywords(keywords.filter((_, j) => j !== i))}>&times;</span>
                </span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Base Sources</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={srcUrl} onChange={e => setSrcUrl(e.target.value)} placeholder="https://example.com" style={{ flex: 2 }} />
              <input value={srcLabel} onChange={e => setSrcLabel(e.target.value)} placeholder="Label" style={{ flex: 1 }} />
              <button type="button" className="btn-secondary" onClick={addSource}>Add</button>
            </div>
            <div style={{ marginTop: 8 }}>
              {sources.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{s.label || s.url}</span>
                  <span style={{ color: 'var(--primary)', fontSize: 12 }}>{s.url}</span>
                  <span className="pill-remove" onClick={() => setSources(sources.filter((_, j) => j !== i))}>&times;</span>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Project'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
