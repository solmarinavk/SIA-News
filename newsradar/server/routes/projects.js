const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { scheduleProject, cancelProject, getNextRun } = require('../scheduler');
const { executeSearch } = require('../searcher');

const router = express.Router();

// GET /api/projects — list all projects
router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM project_keywords WHERE project_id = p.id) as keywords_count,
      (SELECT COUNT(*) FROM project_sources WHERE project_id = p.id) as sources_count,
      (SELECT articles_found FROM runs WHERE project_id = p.id AND status = 'done' ORDER BY finished_at DESC LIMIT 1) as last_run_articles
    FROM projects p
    ORDER BY p.created_at DESC
  `).all();

  const result = projects.map(p => ({
    ...p,
    schedule_enabled: !!p.schedule_enabled,
    next_run: p.schedule_enabled ? getNextRun(p.schedule_frequency, p.schedule_hour) : null,
  }));

  res.json(result);
});

// POST /api/projects — create project
router.post('/', (req, res) => {
  const db = getDb();
  const {
    name,
    description = '',
    time_window = '24h',
    schedule_frequency = 'daily',
    schedule_hour = 9,
    schedule_enabled = true,
    keywords = [],
    sources = [],
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const id = uuidv4();

  const insertProject = db.prepare(`
    INSERT INTO projects (id, name, description, time_window, schedule_frequency, schedule_hour, schedule_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertKeyword = db.prepare('INSERT INTO project_keywords (id, project_id, keyword) VALUES (?, ?, ?)');
  const insertSource = db.prepare('INSERT INTO project_sources (id, project_id, url, label) VALUES (?, ?, ?, ?)');

  const createAll = db.transaction(() => {
    insertProject.run(id, name.trim(), description, time_window, schedule_frequency, schedule_hour, schedule_enabled ? 1 : 0);

    for (const kw of keywords) {
      if (kw && kw.trim()) {
        insertKeyword.run(uuidv4(), id, kw.trim());
      }
    }

    for (const src of sources) {
      if (src && src.url && src.url.trim()) {
        insertSource.run(uuidv4(), id, src.url.trim(), src.label || '');
      }
    }
  });

  createAll();

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  project.schedule_enabled = !!project.schedule_enabled;

  // Register cron
  scheduleProject(project);

  res.status(201).json(project);
});

// PUT /api/projects/:id — update project
router.put('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const {
    name = existing.name,
    description = existing.description,
    time_window = existing.time_window,
    schedule_frequency = existing.schedule_frequency,
    schedule_hour = existing.schedule_hour,
    schedule_enabled = !!existing.schedule_enabled,
  } = req.body;

  db.prepare(`
    UPDATE projects SET name = ?, description = ?, time_window = ?, schedule_frequency = ?, schedule_hour = ?, schedule_enabled = ?
    WHERE id = ?
  `).run(name, description, time_window, schedule_frequency, schedule_hour, schedule_enabled ? 1 : 0, id);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  updated.schedule_enabled = !!updated.schedule_enabled;

  // Re-register cron
  scheduleProject(updated);

  res.json(updated);
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  cancelProject(id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  res.json({ success: true });
});

// GET /api/projects/:id/sources
router.get('/:id/sources', (req, res) => {
  const db = getDb();
  const sources = db.prepare('SELECT * FROM project_sources WHERE project_id = ?').all(req.params.id);
  res.json(sources);
});

// POST /api/projects/:id/sources
router.post('/:id/sources', (req, res) => {
  const db = getDb();
  const { url, label = '' } = req.body;
  if (!url || !url.trim()) return res.status(400).json({ error: 'URL is required' });

  const id = uuidv4();
  db.prepare('INSERT INTO project_sources (id, project_id, url, label) VALUES (?, ?, ?, ?)').run(id, req.params.id, url.trim(), label);
  const source = db.prepare('SELECT * FROM project_sources WHERE id = ?').get(id);
  res.status(201).json(source);
});

// DELETE /api/sources/:id
router.delete('/sources/:sourceId', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM project_sources WHERE id = ?').get(req.params.sourceId);
  if (!existing) return res.status(404).json({ error: 'Source not found' });

  db.prepare('DELETE FROM project_sources WHERE id = ?').run(req.params.sourceId);
  res.json({ success: true });
});

// GET /api/projects/:id/keywords
router.get('/:id/keywords', (req, res) => {
  const db = getDb();
  const keywords = db.prepare('SELECT * FROM project_keywords WHERE project_id = ?').all(req.params.id);
  res.json(keywords);
});

// POST /api/projects/:id/keywords
router.post('/:id/keywords', (req, res) => {
  const db = getDb();
  const { keyword } = req.body;
  if (!keyword || !keyword.trim()) return res.status(400).json({ error: 'Keyword is required' });

  const id = uuidv4();
  db.prepare('INSERT INTO project_keywords (id, project_id, keyword) VALUES (?, ?, ?)').run(id, req.params.id, keyword.trim());
  const kw = db.prepare('SELECT * FROM project_keywords WHERE id = ?').get(id);
  res.status(201).json(kw);
});

// DELETE /api/keywords/:id
router.delete('/keywords/:keywordId', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM project_keywords WHERE id = ?').get(req.params.keywordId);
  if (!existing) return res.status(404).json({ error: 'Keyword not found' });

  db.prepare('DELETE FROM project_keywords WHERE id = ?').run(req.params.keywordId);
  res.json({ success: true });
});

// POST /api/projects/:id/run — trigger manual run
router.post('/:id/run', async (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Check if there's already a running search
  const running = db.prepare("SELECT * FROM runs WHERE project_id = ? AND status = 'running'").get(req.params.id);
  if (running) return res.status(409).json({ error: 'A search is already running for this project', run_id: running.id });

  // Return immediately, then run in background
  res.status(202).json({ status: 'running', message: 'Search started' });

  setImmediate(async () => {
    try {
      const result = await executeSearch(req.params.id);
      console.log(`Manual run complete for project ${req.params.id}: ${result.articlesFound} articles`);
    } catch (err) {
      console.error(`Manual run error for project ${req.params.id}:`, err.message);
    }
  });
});

module.exports = router;
