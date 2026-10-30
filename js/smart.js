// iLogia Planner — rule-based smart distribution engine.
// Transparent heuristics (NOT AI): priority weighting, deadline urgency, daily capacity caps, conflict checks.
import { todayISO, addDays, daysBetween, parseTime } from './utils.js';

const PRIORITY_W = { high: 3, med: 2, low: 1 };

/**
 * Suggest distributing open tasks across available study days.
 * @returns {{slots: Array<{date, taskId, minutes, subjectId}>, warnings: string[]}}
 */
export function suggestDistribution(state) {
  const { studyDays, dayStart, dayEnd } = state.settings;
  const today = todayISO();
  const open = state.tasks
    .filter(t => t.status !== 'done')
    .map(t => ({
      ...t,
      mins: Math.max(30, Math.round((t.estHours || 1) * 60)),
      // urgency: fewer days left + higher priority = earlier scheduling
      score: PRIORITY_W[t.priority] * 10 - Math.max(0, daysBetween(today, t.dueDate || addDays(today, 14))),
    }))
    .sort((a, b) => b.score - a.score);

  // Build day buckets for the next 14 days that are study days
  const horizon = 14;
  const buckets = [];
  const capPerDay = Math.max(60, (parseTime(dayEnd) - parseTime(dayStart))); // max schedulable minutes/day
  for (let i = 0; i < horizon; i++) {
    const date = addDays(today, i);
    const jsDay = new Date(date + 'T00:00:00').getDay();
    const plannerDay = [6, 0, 1, 2, 3, 4, 5].indexOf(jsDay); // 0=Sat
    if (!studyDays.includes(plannerDay)) continue;
    const already = state.logs.filter(l => l.date === date).reduce((a, l) => a + l.minutes, 0);
    buckets.push({ date, left: capPerDay - already });
  }

  const slots = [];
  const warnings = [];
  for (const task of open) {
    let remaining = task.mins;
    const due = task.dueDate || addDays(today, horizon - 1);
    // prefer finishing 1 day before deadline
    const usable = buckets.filter(b => b.date <= due && b.date < due || (!task.dueDate && b.date <= due));
    for (const b of usable) {
      if (remaining <= 0) break;
      const chunk = Math.min(remaining, b.left, 90); // max 90min block per task per day
      if (chunk < 30) continue;
      slots.push({ date: b.date, taskId: task.id, subjectId: task.subjectId, minutes: chunk, title: task.title });
      b.left -= chunk;
      remaining -= chunk;
    }
    if (remaining > 0) warnings.push(task.id);
  }
  return { slots, warnings };
}

/** Detect overlapping sessions on the same day. Returns Set of conflicting session ids. */
export function findConflicts(sessions) {
  const bad = new Set();
  const byDay = {};
  for (const s of sessions) (byDay[s.day] ||= []).push(s);
  for (const day of Object.values(byDay)) {
    day.sort((a, b) => a.startMin - b.startMin);
    for (let i = 1; i < day.length; i++) {
      if (day[i].startMin < day[i - 1].endMin) { bad.add(day[i].id); bad.add(day[i - 1].id); }
    }
  }
  return bad;
}

/** Overdue open tasks — candidates for re-planning. */
export function overdueTasks(state) {
  const today = todayISO();
  return state.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < today);
}
