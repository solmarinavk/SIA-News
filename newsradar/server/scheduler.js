const cron = require('node-cron');
const { getDb } = require('./db');
const { executeSearch } = require('./searcher');

// Map of projectId -> cron task
const scheduledJobs = new Map();

function getCronExpression(frequency, hour) {
  switch (frequency) {
    case 'daily':
      return `0 ${hour} * * *`;
    case 'every_2_days':
      return `0 ${hour} */2 * *`;
    case 'weekly':
      return `0 ${hour} * * 1`; // Monday
    default:
      return `0 ${hour} * * *`;
  }
}

function scheduleProject(project) {
  // Cancel existing job
  cancelProject(project.id);

  if (!project.schedule_enabled) return;

  const cronExpr = getCronExpression(project.schedule_frequency, project.schedule_hour);

  const task = cron.schedule(cronExpr, async () => {
    console.log(`[Scheduler] Running search for project "${project.name}" (${project.id})`);
    try {
      const result = await executeSearch(project.id);
      console.log(`[Scheduler] Completed: ${result.articlesFound} articles found for "${project.name}"`);
    } catch (err) {
      console.error(`[Scheduler] Error for project "${project.name}":`, err.message);
    }
  }, {
    timezone: 'UTC',
  });

  scheduledJobs.set(project.id, task);
  console.log(`[Scheduler] Registered cron "${cronExpr}" for project "${project.name}" (${project.id})`);
}

function cancelProject(projectId) {
  const existing = scheduledJobs.get(projectId);
  if (existing) {
    existing.stop();
    scheduledJobs.delete(projectId);
  }
}

function initScheduler() {
  const db = getDb();
  const projects = db.prepare('SELECT * FROM projects WHERE schedule_enabled = 1').all();
  console.log(`[Scheduler] Initializing ${projects.length} scheduled project(s)`);
  for (const project of projects) {
    scheduleProject(project);
  }
}

function getNextRun(frequency, hour) {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hour);

  switch (frequency) {
    case 'daily':
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'every_2_days':
      if (next <= now) next.setUTCDate(next.getUTCDate() + 2);
      break;
    case 'weekly':
      // Next Monday
      const dayOfWeek = next.getUTCDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? (next <= now ? 7 : 0) : 8 - dayOfWeek;
      next.setUTCDate(next.getUTCDate() + daysUntilMonday);
      break;
  }
  return next.toISOString();
}

module.exports = { initScheduler, scheduleProject, cancelProject, getNextRun };
