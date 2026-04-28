const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/projects/:id/results
router.get('/:id/results', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { run_id, keyword, source, base_only } = req.query;

  let query = 'SELECT * FROM news_results WHERE project_id = ?';
  const params = [id];

  if (run_id) {
    query += ' AND run_id = ?';
    params.push(run_id);
  } else {
    // Default: results from the most recent completed run
    const latestRun = db.prepare(
      "SELECT id FROM runs WHERE project_id = ? AND status = 'done' ORDER BY finished_at DESC LIMIT 1"
    ).get(id);
    if (latestRun) {
      query += ' AND run_id = ?';
      params.push(latestRun.id);
    }
  }

  if (keyword) {
    query += ' AND keywords_found LIKE ?';
    params.push(`%${keyword}%`);
  }

  if (source) {
    query += ' AND source_domain LIKE ?';
    params.push(`%${source}%`);
  }

  if (base_only === 'true') {
    query += ' AND is_from_base_source = 1';
  }

  query += ' ORDER BY published_at DESC';

  const results = db.prepare(query).all(...params);

  // Parse keywords_found JSON
  const parsed = results.map(r => ({
    ...r,
    keywords_found: JSON.parse(r.keywords_found || '[]'),
    is_from_base_source: !!r.is_from_base_source,
  }));

  res.json(parsed);
});

module.exports = router;
