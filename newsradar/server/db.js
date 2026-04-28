const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'newsradar.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      time_window TEXT NOT NULL DEFAULT '24h' CHECK(time_window IN ('24h','48h','7d')),
      schedule_frequency TEXT NOT NULL DEFAULT 'daily' CHECK(schedule_frequency IN ('daily','every_2_days','weekly')),
      schedule_hour INTEGER NOT NULL DEFAULT 9 CHECK(schedule_hour >= 0 AND schedule_hour <= 23),
      schedule_enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      url TEXT NOT NULL,
      label TEXT DEFAULT '',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_keywords (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','done','error')),
      articles_found INTEGER DEFAULT 0,
      error_message TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS news_results (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      source_domain TEXT DEFAULT '',
      keywords_found TEXT DEFAULT '[]',
      summary TEXT DEFAULT '',
      published_at TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_from_base_source INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_news_results_project ON news_results(project_id);
    CREATE INDEX IF NOT EXISTS idx_news_results_run ON news_results(run_id);
    CREATE INDEX IF NOT EXISTS idx_news_results_url ON news_results(project_id, url);
    CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_sources_project ON project_sources(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_keywords_project ON project_keywords(project_id);
  `);
}

module.exports = { getDb };
