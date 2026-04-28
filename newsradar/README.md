# NewsRadar

A full-stack news monitoring platform that automatically searches and aggregates news articles based on user-defined projects, keywords, and sources.

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Scheduler**: node-cron
- **Frontend**: React + Vite
- **Web Search**: Anthropic API (Claude claude-sonnet-4-20250514) with web_search tool

## Quick Start

### 1. Install dependencies

```bash
cd newsradar
npm install
cd client && npm install && cd ..
```

### 2. Configure environment

Create a `.env` file in the `newsradar/` root:

```
ANTHROPIC_API_KEY=your_api_key_here
PORT=3001
```

### 3. Run in development mode

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend dev server (port 5173) concurrently.

### 4. Production build

```bash
npm run build   # builds the React frontend
npm start       # serves everything from Express
```

## Features

- **Project-based monitoring**: Create projects with custom keywords, base sources, and schedules
- **Automated scheduling**: Configure daily, every-2-day, or weekly search runs at specific hours
- **Manual runs**: Trigger searches on demand from the UI
- **Deduplication**: Duplicate articles (same URL) within a time window are automatically skipped
- **Base source prioritization**: Mark specific domains as priority sources for each project
- **Run history**: Full audit trail of every search execution with status and article counts
- **Real-time status**: Live polling shows when a search is in progress
- **Filtering**: Filter results by keyword, source, base-source-only, or specific run

## Project Structure

```
newsradar/
├── server/
│   ├── index.js         # Express app entry
│   ├── db.js            # SQLite setup and migrations
│   ├── scheduler.js     # cron job manager
│   ├── searcher.js      # Anthropic API search logic
│   └── routes/
│       ├── projects.js  # Project CRUD + sources/keywords
│       ├── results.js   # News results with filtering
│       └── runs.js      # Run history and detail
├── client/              # React + Vite frontend
│   └── src/
│       ├── App.jsx
│       ├── api.js       # API client
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   └── ProjectView.jsx
│       └── components/
│           ├── Toast.jsx
│           └── CreateProjectModal.jsx
├── .env
├── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/sources` | List sources |
| POST | `/api/projects/:id/sources` | Add source |
| DELETE | `/api/sources/:id` | Remove source |
| GET | `/api/projects/:id/keywords` | List keywords |
| POST | `/api/projects/:id/keywords` | Add keyword |
| DELETE | `/api/keywords/:id` | Remove keyword |
| POST | `/api/projects/:id/run` | Trigger manual run |
| GET | `/api/projects/:id/results` | Get results (filterable) |
| GET | `/api/projects/:id/runs` | Run history |
| GET | `/api/runs/:id` | Single run detail |
