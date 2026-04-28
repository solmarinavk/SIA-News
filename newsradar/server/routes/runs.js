const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/projects/:id/runs — run history
router.get('/:id/runs', (req, res) => {
  const db = getDb();
  const runs = db.prepare('SELECT * FROM runs WHERE project_id = ? ORDER BY started_at DESC').all(req.params.id);
  res.json(runs);
});

// GET /api/runs/:id — single run detail
router.get('/:id', (req, res) => {
  const db = getDb();
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
});

module.exports = router;
