const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('./db');
const { v4: uuidv4 } = require('uuid');

function getTimeWindowLabel(timeWindow) {
  switch (timeWindow) {
    case '24h': return '24 hours';
    case '48h': return '48 hours';
    case '7d': return '7 days';
    default: return '24 hours';
  }
}

function getTimeWindowMs(timeWindow) {
  switch (timeWindow) {
    case '24h': return 24 * 60 * 60 * 1000;
    case '48h': return 48 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

function buildPrompt(project, sources, keywords) {
  const timeLabel = getTimeWindowLabel(project.time_window);
  const sourceList = sources.length > 0
    ? sources.map(s => `- ${s.url} (${s.label || s.url})`).join('\n')
    : '- No priority sources specified';
  const keywordList = keywords.map(k => k.keyword).join(', ');

  return `You are a news research assistant. Search for recent news articles matching the following criteria.

TIME WINDOW: Only include articles published in the last ${timeLabel}. Discard anything older.

PRIORITY SOURCES (always search these domains first, include any relevant article from them):
${sourceList}

KEYWORDS TO MATCH: ${keywordList}

Instructions:
- Search the web for recent news related to these keywords
- Prioritize articles from the priority sources above
- Also include relevant articles from other reputable sources
- Only include articles within the time window
- For each article found, respond ONLY with a valid JSON array (no markdown, no backticks):

[
  {
    "title": "article title",
    "url": "direct article URL",
    "source": "domain name",
    "summary": "2-3 sentence summary of the article",
    "keywords_matched": ["keyword1", "keyword2"],
    "published_at": "ISO date string or best estimate",
    "is_from_base_source": true or false
  }
]

Return only the JSON array. No preamble, no explanation.`;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

async function executeSearch(projectId) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const sources = db.prepare('SELECT * FROM project_sources WHERE project_id = ?').all(projectId);
  const keywords = db.prepare('SELECT * FROM project_keywords WHERE project_id = ?').all(projectId);

  if (keywords.length === 0) {
    throw new Error('Project has no keywords configured');
  }

  const runId = uuidv4();
  db.prepare('INSERT INTO runs (id, project_id, status) VALUES (?, ?, ?)').run(runId, projectId, 'running');

  try {
    const client = new Anthropic();
    const prompt = buildPrompt(project, sources, keywords);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text from response
    let textContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      }
    }

    // Parse JSON from response - handle markdown code blocks
    let articles = [];
    try {
      // Strip markdown code fences if present
      let cleaned = textContent.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      cleaned = cleaned.trim();
      articles = JSON.parse(cleaned);
    } catch (parseErr) {
      // Try to find JSON array in the text
      const match = textContent.match(/\[[\s\S]*\]/);
      if (match) {
        articles = JSON.parse(match[0]);
      } else {
        throw new Error(`Failed to parse response as JSON: ${parseErr.message}`);
      }
    }

    if (!Array.isArray(articles)) {
      articles = [];
    }

    // Source domains for base source matching
    const baseDomains = sources.map(s => extractDomain(s.url));
    const keywordSet = keywords.map(k => k.keyword.toLowerCase());
    const timeWindowMs = getTimeWindowMs(project.time_window);
    const cutoffDate = new Date(Date.now() - timeWindowMs);

    const insertStmt = db.prepare(`
      INSERT INTO news_results (id, project_id, run_id, title, url, source_domain, keywords_found, summary, published_at, is_from_base_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Deduplication: get existing URLs for this project within the time window
    const existingUrls = new Set(
      db.prepare(`
        SELECT DISTINCT url FROM news_results
        WHERE project_id = ? AND fetched_at >= datetime('now', ?)
      `).all(projectId, `-${Math.ceil(timeWindowMs / (1000 * 60 * 60))} hours`).map(r => r.url)
    );

    let inserted = 0;
    const insertMany = db.transaction((articles) => {
      for (const article of articles) {
        if (!article.url || !article.title) continue;

        // Deduplication
        if (existingUrls.has(article.url)) continue;

        const domain = article.source || extractDomain(article.url);
        const isBase = baseDomains.some(bd => domain.toLowerCase().includes(bd.toLowerCase()) || bd.toLowerCase().includes(domain.toLowerCase()));

        // Match keywords
        const titleAndSummary = `${article.title} ${article.summary || ''}`.toLowerCase();
        const matchedKeywords = article.keywords_matched ||
          keywordSet.filter(k => titleAndSummary.includes(k));

        insertStmt.run(
          uuidv4(),
          projectId,
          runId,
          article.title,
          article.url,
          domain,
          JSON.stringify(matchedKeywords),
          article.summary || '',
          article.published_at || new Date().toISOString(),
          isBase ? 1 : 0
        );
        existingUrls.add(article.url);
        inserted++;
      }
    });

    insertMany(articles);

    // Update run
    db.prepare(`
      UPDATE runs SET status = 'done', finished_at = datetime('now'), articles_found = ?
      WHERE id = ?
    `).run(inserted, runId);

    // Update project last_run_at
    db.prepare('UPDATE projects SET last_run_at = datetime(\'now\') WHERE id = ?').run(projectId);

    return { runId, articlesFound: inserted };
  } catch (err) {
    db.prepare(`
      UPDATE runs SET status = 'error', finished_at = datetime('now'), error_message = ?
      WHERE id = ?
    `).run(err.message, runId);
    throw err;
  }
}

module.exports = { executeSearch };
