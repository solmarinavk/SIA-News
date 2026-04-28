import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../components/Toast';
import CreateProjectModal from '../components/CreateProjectModal';

function formatTime(ts) {
  if (!ts) return 'Never';
  const d = new Date(ts + 'Z');
  return d.toLocaleString();
}

function timeAgo(ts) {
  if (!ts) return 'Never';
  const d = new Date(ts + 'Z');
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, []);

  const handleRunNow = async (e, projectId) => {
    e.stopPropagation();
    try {
      await api.triggerRun(projectId);
      toast('Search started', 'info');
      loadProjects();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDelete = async (e, projectId) => {
    e.stopPropagation();
    if (!confirm('Delete this project and all its data?')) return;
    try {
      await api.deleteProject(projectId);
      toast('Project deleted', 'success');
      loadProjects();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Project</button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <h3>No projects yet</h3>
          <p>Create your first news monitoring project to get started.</p>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>+ New Project</button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(p => (
            <div key={p.id} className="card project-card" onClick={() => navigate(`/project/${p.id}`)}>
              <div className="project-card-header">
                <h3>{p.name}</h3>
                <span className={`badge ${p.schedule_enabled ? 'badge-active' : 'badge-paused'}`}>
                  {p.schedule_enabled ? 'Active' : 'Paused'}
                </span>
              </div>
              {p.description && <p className="project-card-desc">{p.description}</p>}
              <div className="project-card-stats">
                <span><span className="stat-value">{p.keywords_count}</span> keywords</span>
                <span><span className="stat-value">{p.sources_count}</span> sources</span>
                <span><span className="stat-value">{p.last_run_articles ?? '—'}</span> articles</span>
              </div>
              <div className="project-card-footer">
                <span>Last run: {timeAgo(p.last_run_at)}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-secondary btn-sm" onClick={e => handleRunNow(e, p.id)}>Run Now</button>
                  <button className="btn-danger btn-sm" onClick={e => handleDelete(e, p.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadProjects(); }}
        />
      )}
    </div>
  );
}
