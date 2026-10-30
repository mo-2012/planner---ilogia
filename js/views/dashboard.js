// iLogia Planner — Dashboard
import { el, ms, fmtDur, fmtDate, fmtTime, todayISO, daysBetween, weekStartISO, AR_DAYS, EN_DAYS, parseISO } from '../utils.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { ring } from '../charts.js';
import { taskModal } from '../forms.js';

export function renderDashboard(root) {
  const lang = getLang();
  const st = store.state;
  const today = todayISO();
  const jsDay = new Date().getDay();
  const plannerDay = [6, 0, 1, 2, 3, 4, 5].indexOf(jsDay);
  const days = lang === 'ar' ? AR_DAYS : EN_DAYS;

  // today sessions
  const todays = st.sessions.filter(s => s.day === plannerDay).sort((a, b) => a.startMin - b.startMin);
  const openTasks = st.tasks.filter(x => x.status !== 'done').sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const minsToday = store.minutesOn(today);

  // goals rate: current daily + weekly goals progress
  const activeGoals = st.goals.filter(g => !g.closed);
  const rate = goalRate(activeGoals, today);

  const nextExams = st.exams.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  // ---- stat strip ----
  const stats = el('div', { class: 'grid g4' },
    stat('schedule', days[plannerDay], lang === 'ar' ? 'جلسات اليوم' : "Today's sessions", String(todays.length)),
    stat('timer', fmtDur(minsToday, lang), t('studiedToday'), lang === 'ar' ? `${st.logs.filter(l => l.date === today).length} جلسة` : `${st.logs.filter(l => l.date === today).length} logs`),
    stat('task_alt', `${st.tasks.filter(x => x.status === 'done').length}/${st.tasks.length}`, t('doneTasks'), ''),
    stat('track_changes', `${Math.round(rate * 100)}%`, t('goalsRate'), ''),
  );

  // ---- today's plan ----
  const planPanel = el('div', { class: 'panel' }, el('h3', { html: ms('today') }, t('todayPlan')));
  if (todays.length) {
    for (const s of todays) {
      planPanel.append(el('div', { class: 'row', style: 'padding:8px 0;border-block-end:1px solid var(--line)' },
        el('span', { class: 'dot', style: `background:${store.subjectColor(s.subjectId)}` }),
        el('div', {},
          el('div', { style: 'font-weight:600' }, store.subjectName(s.subjectId)),
          el('div', { class: 'sub', style: 'font-size:12px;color:var(--mut)' }, `${fmtTime(s.startMin)} – ${fmtTime(s.endMin)} · ${fmtDur(s.endMin - s.startMin, lang)}`)),
        el('span', { class: 'sp' }),
        el('a', { class: 'lnk', href: '#/timetable' }, t('timetable'))
      ));
    }
  } else {
    planPanel.append(empty('event_busy', t('emptySessions')));
  }

  // ---- tasks due ----
  const taskPanel = el('div', { class: 'panel' }, el('h3', { html: ms('checklist') }, t('todayTasks'),
    el('button', { class: 'btn s sp', onclick: () => taskModal(null, () => renderDashboard(root)) }, t('addTask'))));
  const dueSoon = openTasks.slice(0, 5);
  if (dueSoon.length) {
    for (const task of dueSoon) {
      const overdue = task.dueDate && task.dueDate < today;
      taskPanel.append(el('div', { class: 'taskrow' + (task.status === 'done' ? ' done' : '') },
        el('button', {
          class: 'ibtn', html: ms(task.status === 'done' ? 'check_circle' : 'radio_button_unchecked'),
          onclick: () => { store.update(s => { const x = s.tasks.find(y => y.id === task.id); x.status = x.status === 'done' ? 'todo' : 'done'; }); renderDashboard(root); }
        }),
        el('div', {},
          el('div', { class: 'ttl' }, task.title),
          el('div', { class: 'sub' }, `${store.subjectName(task.subjectId)}${task.dueDate ? ' · ' + fmtDate(task.dueDate, lang) : ''}`)),
        el('span', { class: 'sp' }),
        overdue ? el('span', { class: 'pr high' }, t('overdue')) : el('span', { class: `pr ${task.priority}` }, t('p' + cap(task.priority))),
        el('button', { class: 'ibtn', html: ms('edit'), onclick: () => taskModal(task, () => renderDashboard(root)) })
      ));
    }
  } else taskPanel.append(empty('task_alt', t('emptyTasks')));

  // ---- next exams ----
  const examPanel = el('div', { class: 'panel' }, el('h3', { html: ms('event') }, t('nextExams')));
  if (nextExams.length) {
    for (const e of nextExams) {
      const dLeft = daysBetween(today, e.date);
      examPanel.append(el('div', { class: 'row', style: 'padding:8px 0;border-block-end:1px solid var(--line)' },
        el('span', { class: 'dot', style: `background:${store.subjectColor(e.subjectId)}` }),
        el('div', {},
          el('div', { style: 'font-weight:600' }, `${store.subjectName(e.subjectId)}${e.topic ? ' — ' + e.topic : ''}`),
          el('div', { style: 'font-size:12px;color:var(--mut)' }, `${fmtDate(e.date, lang, true)} · ${e.time || ''}`)),
        el('span', { class: 'sp' }),
        el('span', { class: 'badge' + (dLeft <= 3 ? ' gold' : '') }, dLeft === 0 ? t('examToday') : `${dLeft} ${t('daysLeft')}`)
      ));
    }
  } else examPanel.append(empty('event', t('emptyExams')));

  // ---- goals ring ----
  const goalPanel = el('div', { class: 'panel', style: 'display:grid;place-items:center;text-align:center' },
    el('h3', { html: ms('track_changes') }, t('goalsRate')),
    ring(rate, { size: 130, thickness: 12 }),
    el('p', { style: 'color:var(--mut);font-size:13px;margin-top:8px' },
      activeGoals.length ? (lang === 'ar' ? `${activeGoals.length} أهداف نشطة` : `${activeGoals.length} active goals`) : t('emptyGoals')));

  // ---- mini calendar ----
  const calPanel = el('div', { class: 'panel' }, el('h3', { html: ms('calendar_month') }, t('miniCal')), miniCal());

  root.append(
    stats,
    el('div', { class: 'grid g2', style: 'margin-top:16px' },
      el('div', { class: 'grid' }, planPanel, examPanel),
      el('div', { class: 'grid' }, taskPanel)),
    el('div', { class: 'grid g2', style: 'margin-top:16px' }, goalPanel, calPanel)
  );
}

function goalRate(goals, today) {
  if (!goals.length) return 0;
  const wk = weekStartISO();
  const parts = goals.map(g => {
    const done = g.metric === 'hours'
      ? (g.type === 'daily' ? store.minutesOn(today) / 60 : store.weekMinutes(wk) / 60)
      : (g.type === 'daily' ? store.lessonsDoneOn(today) : countLessonsWeek(wk));
    return Math.min(1, done / g.target);
  });
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}
function countLessonsWeek(wkStart) {
  const end = new Date(wkStart + 'T00:00:00'); end.setDate(end.getDate() + 7);
  const endISO = todayISO(end);
  return store.state.logs.filter(l => l.lessonDone && l.date >= wkStart && l.date < endISO).length;
}

function miniCal() {
  const lang = getLang();
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const days = lang === 'ar' ? AR_DAYS : EN_DAYS;
  const wrap = el('div', { class: 'mcal' });
  for (const d of [6, 0, 1, 2, 3, 4, 5].map(j => days[[6, 0, 1, 2, 3, 4, 5].indexOf(j)])) wrap.append(el('div', { class: 'h' }, d.slice(0, lang === 'ar' ? 5 : 2)));
  const first = new Date(y, m, 1);
  const lead = [6, 0, 1, 2, 3, 4, 5].indexOf(first.getDay());
  const prevDays = new Date(y, m, 0).getDate();
  const withMarks = new Set([...store.state.exams.map(e => e.date), ...store.state.logs.map(l => l.date)]);
  for (let i = 0; i < 42; i++) {
    const dayNum = i - lead + 1;
    let btn;
    if (dayNum < 1) btn = el('button', { class: 'dim', disabled: '' }, String(prevDays + dayNum));
    else if (dayNum > new Date(y, m + 1, 0).getDate()) btn = el('button', { class: 'dim', disabled: '' }, String(dayNum - new Date(y, m + 1, 0).getDate()));
    else {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      btn = el('button', { class: iso === todayISO() ? 'today' : '' }, String(dayNum), withMarks.has(iso) ? el('span', { class: 'd' }) : null);
    }
    wrap.append(btn);
  }
  return wrap;
}

function stat(icon, big, label, sub) {
  return el('div', { class: 'stat' },
    el('span', { class: 'ic', html: ms(icon) }),
    el('div', {}, el('b', {}, big), el('span', {}, label), sub ? el('span', { style: 'display:block' }, sub) : null));
}
function empty(icon, msg) {
  return el('div', { class: 'empty' }, el('span', { class: 'ms' }, icon), el('div', {}, msg));
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
