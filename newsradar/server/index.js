require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');
const { initScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
getDb();

// API Routes
app.use('/api/projects', require('./routes/projects'));
app.use('/api/projects', require('./routes/results'));
app.use('/api/projects', require('./routes/runs'));
// Also mount runs at /api/runs for the GET /api/runs/:id endpoint
app.use('/api/runs', require('./routes/runs'));
// Mount source/keyword delete routes at /api level
app.delete('/api/sources/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM project_sources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Source not found' });
  db.prepare('DELETE FROM project_sources WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
app.delete('/api/keywords/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM project_keywords WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Keyword not found' });
  db.prepare('DELETE FROM project_keywords WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Serve static frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[NewsRadar] Server running on http://localhost:${PORT}`);
  // Initialize scheduler after server is ready
  initScheduler();
});
