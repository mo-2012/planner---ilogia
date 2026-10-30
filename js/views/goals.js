// iLogia Planner — Goals (daily/weekly, hours/lessons, progress, completed log)
import { el, ms, confirmBox, fmtDate, weekStartISO, todayISO } from '../utils.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { goalModal } from '../forms.js';
import { ring } from '../charts.js';

export function renderGoals(root) {
  const lang = getLang();
  const st = store.state;
  const today = todayISO();
  const wk = weekStartISO();

  const progressOf = (g) => {
    const done = g.metric === 'hours'
      ? (g.type === 'daily' ? store.minutesOn(today) / 60 : store.weekMinutes(wk) / 60)
      : (g.type === 'daily'
        ? store.lessonsDoneOn(today)
        : st.logs.filter(l => l.lessonDone && l.date >= wk).length);
    return { done: Math.round(done * 10) / 10, frac: Math.min(1, done / g.target) };
  };

  // auto-close achieved goals of the previous day/week
  store.update(s => {
    for (const g of s.goals) {
      if (g.closed || !g.period) continue;
      if (g.type === 'daily' && g.period < today) {
        const met = (g.metric === 'hours' ? store.minutesOn(g.period) / 60 : store.lessonsDoneOn(g.period)) >= g.target;
        g.closed = true; g.achieved = met;
      }
    }
  });

  const paint = () => {
    root.innerHTML = '';
    const active = st.goals.filter(g => !g.closed);
    const closed = st.goals.filter(g => g.closed).sort((a, b) => (b.period || '').localeCompare(a.period || ''));

    const wrap = el('div', { class: 'grid g3' });
    if (!active.length) wrap.append(el('div', { class: 'empty', style: 'grid-column:1/-1' }, el('span', { class: 'ms' }, 'track_changes'), el('div', {}, t('emptyGoals'))));
    for (const g of active) {
      const { done, frac } = progressOf(g);
      wrap.append(el('div', { class: 'panel', style: 'display:flex;gap:16px;align-items:center' },
        ring(frac, { size: 88, thickness: 10, color: g.type === 'daily' ? 'var(--primary-c)' : 'var(--gold)' }),
        el('div', { style: 'flex:1' },
          el('div', { style: 'font-weight:600' }, g.type === 'daily' ? t('dailyGoal') : t('weeklyGoal')),
          el('div', { style: 'font-size:12px;color:var(--mut)' }, g.metric === 'hours' ? t('hoursMetric') : t('lessonsMetric')),
          el('div', { style: 'margin-top:4px;font-size:14px' }, `${done} / ${g.target}`)),
        el('div', {},
          el('button', { class: 'ibtn', html: ms('edit'), onclick: () => goalModal(g, paint) }),
          el('button', {
            class: 'ibtn del', html: ms('delete'), onclick: () =>
              confirmBox(lang === 'ar' ? 'حذف هذا الهدف؟' : 'Delete this goal?', () => {
                store.update(s => s.goals = s.goals.filter(x => x.id !== g.id)); paint();
              }, lang)
          }))));
    }

    const history = el('div', { class: 'panel', style: 'margin-top:16px' },
      el('h3', { html: ms('history') }, t('completedGoals')));
    if (!closed.length) history.append(el('div', { class: 'empty' }, el('span', { class: 'ms' }, 'emoji_events'), el('div', {}, t('noData'))));
    for (const g of closed.slice(0, 10)) {
      history.append(el('div', { class: 'logline' },
        el('span', { class: 'ms', style: `color:${g.achieved ? 'var(--ok)' : 'var(--err)'}` }, g.achieved ? 'check_circle' : 'cancel'),
        el('span', { style: 'flex:1' }, `${g.type === 'daily' ? t('dailyGoal') : t('weeklyGoal')} — ${g.metric === 'hours' ? t('hoursMetric') : t('lessonsMetric')} (${g.target})`),
        el('span', { style: 'color:var(--mut);font-size:12px' }, g.period ? fmtDate(g.period, lang) : '')));
    }

    root.append(
      el('div', { class: 'row', style: 'margin-bottom:12px' },
        el('button', { class: 'btn', html: ms('add'), onclick: () => goalModal(null, paint) }, t('addGoal'))),
      wrap, history);
  };
  paint();
}
