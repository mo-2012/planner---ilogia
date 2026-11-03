// iLogia Planner — مزامنة مع Supabase (local-first).
// - البيانات تفضل تتحفظ محليًا دايمًا (localStorage) والتطبيق بيشتغل بدون إنترنت.
// - لو المستخدم مسجّل دخول وجداول planner_* موجودة (migrations/001_planner_schema.sql)، البيانات بتتزامن مع حسابه.
// - لو الجداول مش موجودة: بيفضل محلي بالكامل (status = 'unavailable') ومفيش أي خطأ للمستخدم.
import { store } from './store.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const T = {
  subjects: 'planner_subjects', lessons: 'planner_lessons', plans: 'planner_plans', planSubjects: 'planner_plan_subjects',
  tasks: 'planner_tasks', sessions: 'planner_sessions', exams: 'planner_exams', goals: 'planner_goals',
  logs: 'planner_study_logs', settings: 'planner_user_settings',
};
const UPSERT_ORDER = ['subjects', 'lessons', 'plans', 'planSubjects', 'tasks', 'sessions', 'exams', 'goals', 'logs'];
const DELETE_ORDER = ['exams', 'sessions', 'logs', 'goals', 'tasks', 'plans', 'lessons', 'subjects'];
const ID_TABLES = DELETE_ORDER;

/* ---------- حالة المزامنة ---------- */
const listeners = new Set();
export const sync = { status: 'local', on(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
function setStatus(s, info) { sync.status = s; listeners.forEach((f) => { try { f(s, info); } catch { /* ignore */ } }); }

let active = null;
const dirtyKey = (a) => `ilp.dirty.${a.userId}`;
const missing = (e) => !!e && (['42P01', 'PGRST205', 'PGRST202'].includes(e.code) || /does not exist|schema cache|could not find the table/i.test(e.message || ''));
const ck = ({ error }) => { if (error) throw error; };
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
const uuid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

/* ---------- تنظيف القيم لتطابق قيود الـ SQL ---------- */
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const int = (v, min, max, d = min) => Math.min(max, Math.max(min, Math.round(num(v, d))));
const str = (v, max) => String(v ?? '').slice(0, max);
const dateOnly = (v) => (/^\d{4}-\d{2}-\d{2}/.test(v || '') ? String(v).slice(0, 10) : null);
const hhmm = (v, fb) => (/^\d{1,2}:\d{2}/.test(v || '') ? String(v).slice(0, 5).padStart(5, '0') : fb);
const todayStr = () => new Date().toISOString().slice(0, 10);
const tsOf = (v) => `${dateOnly(v) || todayStr()}T00:00:00Z`;

function hasContent(s) { return ['subjects', 'tasks', 'sessions', 'plans', 'exams', 'goals', 'logs'].some((k) => (s[k] || []).length); }

// ids قديمة (Date.now().toString(36)) -> UUID مرة واحدة، مع تحديث كل المراجع
function ensureUuids() {
  const s = store.state; let need = false;
  const scan = (arr) => arr.forEach((x) => { if (!UUID_RE.test(x.id)) need = true; });
  [s.subjects, s.tasks, s.sessions, s.plans, s.exams, s.goals, s.logs].forEach(scan);
  s.subjects.forEach((x) => scan(x.lessons || []));
  if (!need) return;
  const map = new Map();
  const nid = (old) => { if (old == null || UUID_RE.test(old)) return old; if (!map.has(old)) map.set(old, uuid()); return map.get(old); };
  store.update((st) => {
    st.subjects.forEach((x) => { x.id = nid(x.id); (x.lessons || []).forEach((l) => { l.id = nid(l.id); }); });
    st.tasks.forEach((x) => { x.id = nid(x.id); x.subjectId = nid(x.subjectId); });
    st.sessions.forEach((x) => { x.id = nid(x.id); x.subjectId = nid(x.subjectId); x.lessonId = nid(x.lessonId); });
    st.plans.forEach((x) => { x.id = nid(x.id); x.subjectIds = (x.subjectIds || []).map(nid); });
    st.exams.forEach((x) => { x.id = nid(x.id); x.subjectId = nid(x.subjectId); x.planId = nid(x.planId); });
    st.goals.forEach((x) => { x.id = nid(x.id); });
    st.logs.forEach((x) => { x.id = nid(x.id); x.subjectId = nid(x.subjectId); });
  }, { silent: true });
}

/* ---------- local -> rows ---------- */
export function toRows(s, userId) {
  const r = { subjects: [], lessons: [], plans: [], planSubjects: [], tasks: [], sessions: [], exams: [], goals: [], logs: [], settings: null };
  const subj = new Set(), lesn = new Set(), plan = new Set();
  for (const x of s.subjects) {
    subj.add(x.id); r.subjects.push({ id: x.id, user_id: userId, name: str(x.name, 80) || '—', color: str(x.color, 20) || '#136F58' });
    (x.lessons || []).forEach((l, i) => { lesn.add(l.id); r.lessons.push({ id: l.id, subject_id: x.id, title: str(l.title, 160) || '—', done: !!l.done, sort_order: i }); });
  }
  for (const p of s.plans) {
    plan.add(p.id);
    r.plans.push({ id: p.id, user_id: userId, title: str(p.title, 160) || '—', total_hours: int(p.totalHours, 1, 32767, 1), done: !!p.done, created_at: tsOf(p.createdAt) });
    [...new Set(p.subjectIds || [])].filter((id) => subj.has(id)).forEach((sid) => r.planSubjects.push({ plan_id: p.id, subject_id: sid }));
  }
  for (const t of s.tasks) r.tasks.push({
    id: t.id, user_id: userId, subject_id: subj.has(t.subjectId) ? t.subjectId : null, title: str(t.title, 200) || '—', description: str(t.desc, 5000),
    due_date: dateOnly(t.dueDate), priority: ['low', 'med', 'high'].includes(t.priority) ? t.priority : 'med',
    status: ['todo', 'doing', 'done'].includes(t.status) ? t.status : 'todo',
    est_hours: Math.min(999.9, Math.max(0.1, Math.round(num(t.estHours, 1) * 10) / 10)), created_at: tsOf(t.createdAt),
  });
  for (const x of s.sessions) {
    if (!subj.has(x.subjectId)) continue;
    const a = int(x.startMin, 0, 1439), b = int(x.endMin, 1, 1440);
    if (b <= a) continue;
    r.sessions.push({ id: x.id, user_id: userId, subject_id: x.subjectId, lesson_id: lesn.has(x.lessonId) ? x.lessonId : null, day_of_week: int(x.day, 0, 6), start_min: a, end_min: b, note: str(x.note, 1000) });
  }
  for (const e of s.exams) {
    if (!subj.has(e.subjectId) || !dateOnly(e.date)) continue;
    r.exams.push({ id: e.id, user_id: userId, subject_id: e.subjectId, plan_id: plan.has(e.planId) ? e.planId : null, topic: str(e.topic, 500), exam_date: dateOnly(e.date), exam_time: hhmm(e.time, null), notes: str(e.notes, 2000) });
  }
  for (const g of s.goals) {
    if (!['daily', 'weekly'].includes(g.type) || !['hours', 'lessons'].includes(g.metric)) continue;
    r.goals.push({ id: g.id, user_id: userId, goal_type: g.type, metric: g.metric, target: int(g.target, 1, 32767, 1), period: dateOnly(g.period), closed: !!g.closed, achieved: typeof g.achieved === 'boolean' ? g.achieved : null, created_at: tsOf(g.createdAt) });
  }
  for (const l of s.logs) r.logs.push({
    id: l.id, user_id: userId, subject_id: subj.has(l.subjectId) ? l.subjectId : null, minutes: int(l.minutes, 0, 1440, 0), logged_date: dateOnly(l.date) || todayStr(),
    source: ['timer', 'manual', 'lesson'].includes(l.source) ? l.source : 'manual', lesson_done: !!l.lessonDone, created_at: tsOf(l.date),
  });
  const st = s.settings || {}, pm = st.pomodoro || {};
  r.settings = {
    user_id: userId, study_days: [...new Set((st.studyDays || [0, 1, 2, 3, 4]).map((d) => int(d, 0, 6)))],
    day_start: hhmm(st.dayStart, '16:00'), day_end: hhmm(st.dayEnd, '21:00'),
    pomodoro: { focus: int(pm.focus, 1, 600, 25), break: int(pm.break, 1, 600, 5), cycles: int(pm.cycles, 1, 50, 4) },
    notif: !!st.notif, theme: st.theme === 'dark' ? 'dark' : 'light',
  };
  return r;
}

/* ---------- rows -> local ---------- */
const byCreated = (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''));
export function fromRemote(r) {
  const les = new Map();
  (r.lessons || []).slice().sort((a, b) => a.sort_order - b.sort_order).forEach((l) => { if (!les.has(l.subject_id)) les.set(l.subject_id, []); les.get(l.subject_id).push({ id: l.id, title: l.title, done: !!l.done }); });
  const ps = new Map();
  (r.planSubjects || []).forEach((x) => { if (!ps.has(x.plan_id)) ps.set(x.plan_id, []); ps.get(x.plan_id).push(x.subject_id); });
  const out = {
    subjects: (r.subjects || []).slice().sort(byCreated).map((s) => ({ id: s.id, name: s.name, color: s.color, lessons: les.get(s.id) || [] })),
    plans: (r.plans || []).slice().sort(byCreated).map((p) => ({ id: p.id, title: p.title, subjectIds: ps.get(p.id) || [], totalHours: p.total_hours, createdAt: dateOnly(p.created_at), done: !!p.done })),
    tasks: (r.tasks || []).slice().sort(byCreated).map((t) => ({ id: t.id, title: t.title, desc: t.description, subjectId: t.subject_id, dueDate: t.due_date, priority: t.priority, status: t.status, estHours: Number(t.est_hours), createdAt: dateOnly(t.created_at) })),
    sessions: (r.sessions || []).map((x) => ({ id: x.id, day: x.day_of_week, startMin: x.start_min, endMin: x.end_min, subjectId: x.subject_id, lessonId: x.lesson_id, note: x.note })),
    exams: (r.exams || []).map((e) => ({ id: e.id, subjectId: e.subject_id, topic: e.topic, date: e.exam_date, time: e.exam_time ? String(e.exam_time).slice(0, 5) : '', notes: e.notes, planId: e.plan_id })),
    goals: (r.goals || []).slice().sort(byCreated).map((g) => ({ id: g.id, type: g.goal_type, metric: g.metric, target: g.target, period: g.period, createdAt: dateOnly(g.created_at), closed: !!g.closed, ...(typeof g.achieved === 'boolean' ? { achieved: g.achieved } : {}) })),
    logs: (r.logs || []).slice().sort(byCreated).map((l) => ({ id: l.id, subjectId: l.subject_id, minutes: l.minutes, date: l.logged_date, source: l.source, lessonDone: !!l.lesson_done })),
  };
  const s = r.settings;
  if (s) out.settings = { studyDays: s.study_days, dayStart: String(s.day_start).slice(0, 5), dayEnd: String(s.day_end).slice(0, 5), pomodoro: s.pomodoro, notif: !!s.notif, theme: s.theme };
  return out;
}

/* ---------- الاتصال ---------- */
const emptyKnown = () => ({ subjects: new Set(), lessons: new Set(), plans: new Set(), tasks: new Set(), sessions: new Set(), exams: new Set(), goals: new Set(), logs: new Set(), planSubjects: new Set() });
function idsOf(r) {
  const k = emptyKnown();
  ID_TABLES.forEach((t) => (r[t] || []).forEach((x) => k[t].add(x.id)));
  (r.planSubjects || []).forEach((x) => k.planSubjects.add(`${x.plan_id}|${x.subject_id}`));
  return k;
}
function idsOfRows(rows) {
  const k = emptyKnown();
  ID_TABLES.forEach((t) => rows[t].forEach((x) => k[t].add(x.id)));
  rows.planSubjects.forEach((x) => k.planSubjects.add(`${x.plan_id}|${x.subject_id}`));
  return k;
}

async function fetchAll(a) {
  const keys = Object.keys(T);
  const res = await Promise.all(keys.map((k) => a.client.from(T[k]).select('*')));
  const out = {};
  for (let i = 0; i < keys.length; i++) {
    const { data, error } = res[i];
    if (error) { if (missing(error)) return null; throw error; }
    out[keys[i]] = data || [];
  }
  out.settings = out.settings[0] || null;
  return out;
}
const isEmptyRemote = (r) => !r.settings && ID_TABLES.every((t) => !r[t].length);

async function pushNow(a) {
  if (active !== a) return;
  if (a.running) { a.dirty = true; return; }
  a.running = true; a.dirty = false; setStatus('syncing');
  try {
    ensureUuids();
    const rows = toRows(store.state, a.userId), cur = idsOfRows(rows);
    for (const k of UPSERT_ORDER) {
      for (const part of chunk(rows[k], 500)) {
        ck(await a.client.from(T[k]).upsert(part, { onConflict: k === 'planSubjects' ? 'plan_id,subject_id' : 'id' }));
      }
    }
    ck(await a.client.from(T.settings).upsert(rows.settings, { onConflict: 'user_id' }));
    // حذف المحذوف محليًا (الأبناء بتتحذف cascade من القاعدة)
    for (const k of DELETE_ORDER) {
      const stale = [...a.known[k]].filter((id) => !cur[k].has(id));
      for (const part of chunk(stale, 100)) ck(await a.client.from(T[k]).delete().in('id', part));
    }
    for (const pair of a.known.planSubjects) {
      if (cur.planSubjects.has(pair)) continue;
      const [p, s] = pair.split('|');
      if (cur.plans.has(p)) ck(await a.client.from(T.planSubjects).delete().eq('plan_id', p).eq('subject_id', s));
    }
    a.known = cur; a.retries = 0;
    if (!a.dirty) { try { localStorage.removeItem(dirtyKey(a)); } catch { /* ignore */ } }
    setStatus('synced');
  } catch (e) {
    console.warn('[planner] sync failed, will retry:', e);
    a.dirty = true; setStatus('error', e);
    if (a.retries < 6) { const wait = Math.min(60000, 2000 * 2 ** a.retries++); clearTimeout(a.timer); a.timer = setTimeout(() => pushNow(a), wait); }
  } finally {
    a.running = false;
    if (a.dirty && active === a && a.retries === 0) schedule(a);
  }
}

function schedule(a) {
  try { localStorage.setItem(dirtyKey(a), '1'); } catch { /* ignore */ }
  clearTimeout(a.timer); a.timer = setTimeout(() => pushNow(a), a.delay ?? 1500);
}

function backupLocal(a) {
  if (!hasContent(store.state)) return;
  try { localStorage.setItem(`ilp.backup.${a.userId}`, JSON.stringify(store.state)); } catch { /* ignore */ }
}

export async function startSync(user, client, opts = {}) {
  if (active && active.userId === user.id) return;
  stopSync();
  const a = { userId: user.id, client: null, known: emptyKnown(), running: false, dirty: false, timer: null, retries: 0, delay: opts.delay };
  active = a;
  try {
    a.client = client || (await import('./supabase-client.js')).supabase;
    setStatus('syncing');
    const remote = await fetchAll(a);
    if (active !== a) return;
    if (remote === null) { active = null; setStatus('unavailable'); return; }   // الجداول لسه متعملتش: يفضل محلي
    a.known = idsOf(remote);
    const pending = (() => { try { return localStorage.getItem(dirtyKey(a)) === '1'; } catch { return false; } })();
    const localHas = hasContent(store.state);
    store.setSyncHook(() => schedule(a));
    if (pending || (isEmptyRemote(remote) && localHas)) await pushNow(a);          // المحلي هو الأحدث / أول رفع
    else if (isEmptyRemote(remote)) setStatus('synced');
    else { backupLocal(a); store.replaceState(fromRemote(remote)); setStatus('synced', { pulled: true }); }
  } catch (e) {
    console.warn('[planner] initial sync failed, staying local:', e);
    if (active === a) { active = null; store.setSyncHook(null); setStatus('error', e); setTimeout(() => { if (!active) startSync(user, client, opts); }, 20000); }
  }
}

export function stopSync() {
  if (active) clearTimeout(active.timer);
  active = null; store.setSyncHook(null); setStatus('local');
}
export const flush = () => (active ? pushNow(active) : Promise.resolve());

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  addEventListener('online', () => { if (active) { active.retries = 0; schedule(active); } });
}
