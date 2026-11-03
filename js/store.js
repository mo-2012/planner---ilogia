// iLogia Planner — data store. Local persistence (localStorage) keyed per user.
// Swappable with the Supabase adapter once migrations/001_planner_schema.sql is approved (see PROGRESS.md).
import { uid, todayISO } from './utils.js';

const KEY = (scope) => `ilp.data.${scope || 'anon'}`;

const blank = () => ({
  subjects: [],   // {id,name,color,lessons:[{id,title,done}]}
  tasks: [],      // {id,title,desc,subjectId,dueDate,priority,status,estHours,createdAt}
  sessions: [],   // {id,day,startMin,endMin,subjectId,lessonId,note}
  plans: [],      // {id,title,subjectIds,totalHours,createdAt,done}
  exams: [],      // {id,subjectId,topic,date,time,notes,planId}
  goals: [],      // {id,type:'daily'|'weekly',metric:'hours'|'lessons',target,period,createdAt,closed}
  logs: [],       // {id,subjectId,minutes,date,source}
  settings: {
    studyDays: [0, 1, 2, 3, 4],  // 0=Sat … 6=Fri (Fri off by default)
    dayStart: '16:00', dayEnd: '21:00',
    pomodoro: { focus: 25, break: 5, cycles: 4 },
    notif: false, theme: 'light',
  },
});

let scope = 'anon';
let state = blank();
const listeners = new Set();

function normalize(obj) {
  const b = blank(), s = { ...b, ...(obj || {}) };
  s.settings = { ...b.settings, ...(s.settings || {}) };
  s.settings.pomodoro = { ...b.settings.pomodoro, ...(s.settings.pomodoro || {}) };
  return s;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY(scope));
    state = raw ? normalize(JSON.parse(raw)) : blank();
  } catch { state = blank(); }
}
let syncHook = null;   // بيتركّب من sync.js لما المستخدم يكون مسجّل دخول
function persist(silent) { localStorage.setItem(KEY(scope), JSON.stringify(state)); if (!silent && syncHook) syncHook(); }

export const store = {
  setScope(s) { scope = s || 'anon'; load(); emit(); },
  get scope() { return scope; },
  get state() { return state; },
  get settings() { return state.settings; },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  update(mut, opts) { mut(state); persist(opts && opts.silent); emit(); },
  setSyncHook(fn) { syncHook = fn || null; },
  // استبدال الحالة ببيانات جاية من السيرفر (بدون ما نرجّع نرفعها)
  replaceState(next) { state = normalize(next); persist(true); emit(); },
  // helpers
  subject(id) { return state.subjects.find(s => s.id === id); },
  subjectName(id) { return this.subject(id)?.name || '—'; },
  subjectColor(id) { return this.subject(id)?.color || '#5C6B66'; },
  minutesOn(dateISO) { return state.logs.filter(l => l.date === dateISO).reduce((a, l) => a + l.minutes, 0); },
  weekMinutes(weekStartISO) {
    const end = addDaysSafe(weekStartISO, 7);
    return state.logs.filter(l => l.date >= weekStartISO && l.date < end).reduce((a, l) => a + l.minutes, 0);
  },
  lessonsDoneOn(dateISO) {
    // lessons completed on a date are tracked via log entries with lesson flag
    return state.logs.filter(l => l.date === dateISO && l.lessonDone).length;
  },
  addLog(entry) { this.update(s => s.logs.push({ id: uid(), date: todayISO(), source: 'manual', ...entry })); },
};
function addDaysSafe(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return todayISO(d); }
function emit() { listeners.forEach(fn => fn()); }

// Seed a friendly starter set on very first run (clearly removable, marked as samples)
export function seedIfEmpty() {
  if (localStorage.getItem('ilp.seeded') || state.subjects.length) return;
  localStorage.setItem('ilp.seeded', '1');
  const now = todayISO();
  store.update(s => {
    const mk = (name, color, lessons) => ({ id: uid(), name, color, lessons: lessons.map(t => ({ id: uid(), title: t, done: false })) });
    const math = mk('رياضيات', '#136F58', ['الدوال التربيعية', 'المتراجحات', 'النهايات']);
    const phys = mk('فيزياء', '#4A7FB5', ['قوانين نيوتن', 'الشغل والطاقة']);
    const chem = mk('كيمياء', '#D4AF37', ['الروابط الكيميائية']);
    s.subjects.push(math, phys, chem);
    s.tasks.push(
      { id: uid(), title: 'حل تمرين الدوال', desc: 'صفحة 42 — تدريبات 1-10', subjectId: math.id, dueDate: addDaysSafe(now, 2), priority: 'high', status: 'todo', estHours: 1.5, createdAt: now },
      { id: uid(), title: 'مراجعة قوانين نيوتن', desc: '', subjectId: phys.id, dueDate: addDaysSafe(now, 4), priority: 'med', status: 'todo', estHours: 1, createdAt: now },
    );
    s.sessions.push(
      { id: uid(), day: 0, startMin: 16 * 60, endMin: 17.5 * 60, subjectId: math.id, lessonId: math.lessons[0].id, note: '' },
      { id: uid(), day: 2, startMin: 17 * 60, endMin: 18 * 60, subjectId: phys.id, lessonId: null, note: '' },
    );
    s.exams.push({ id: uid(), subjectId: math.id, topic: 'الدوال والمتراجحات', date: addDaysSafe(now, 9), time: '09:00', notes: '', planId: null });
    s.goals.push({ id: uid(), type: 'daily', metric: 'hours', target: 2, period: now, createdAt: now, closed: false });
  });
}

load();
