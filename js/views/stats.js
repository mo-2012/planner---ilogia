// iLogia Planner — Statistics
import { el, ms, fmtDur, weekStartISO, todayISO, addDays, fmtDate, AR_DAYS, EN_DAYS } from '../utils.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { barChart, donut, lineChart } from '../charts.js';

export function renderStats(root) {
  const lang = getLang();
  const st = store.state;
  const days = lang === 'ar' ? AR_DAYS : EN_DAYS;

  const totalMin = st.logs.reduce((a, l) => a + l.minutes, 0);
  const doneTasks = st.tasks.filter(x => x.status === 'done').length;

  // most studied subjects
  const bySubj = {};
  for (const l of st.logs) bySubj[l.subjectId || '—'] = (bySubj[l.subjectId || '—'] || 0) + l.minutes;
  const top = Object.entries(bySubj).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // adherence: logged minutes vs scheduled minutes (past sessions this week)
  const wk = weekStartISO();
  const todayIdx = [6, 0, 1, 2, 3, 4, 5].indexOf(new Date().getDay());
  const scheduled = st.sessions.filter(s => s.day <= todayIdx).reduce((a, s) => a + (s.endMin - s.startMin), 0);
  const loggedWk = st.logs.filter(l => l.date >= wk).reduce((a, l) => a + l.minutes, 0);
  const adherence = scheduled ? Math.min(1, loggedWk / scheduled) : 0;

  // stat strip
  root.append(el('div', { class: 'grid g4' },
    stat('schedule', fmtDur(totalMin, lang), t('totalHours')),
    stat('task_alt', String(doneTasks), t('doneTasks')),
    stat('event_available', `${Math.round(adherence * 100)}%`, t('adherence')),
    stat('bolt', top.length ? store.subjectName(top[0][0]) : '—', t('topSubjects'))));

  // weekly bars (current week, Sat..Fri)
  const weekData = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(wk, i);
    weekData.push({ label: days[i].slice(0, lang === 'ar' ? 5 : 3), value: Math.round(store.minutesOn(iso) / 60 * 10) / 10 });
  }
  const weekPanel = el('div', { class: 'panel' }, el('h3', { html: ms('bar_chart') }, t('weeklyTrend')));
  weekPanel.append(barChart(weekData, { unit: lang === 'ar' ? 'س' : 'h' }));

  // monthly line (last 8 weeks)
  const monthData = [];
  for (let i = 7; i >= 0; i--) {
    const start = addDays(wk, -7 * i);
    monthData.push({ label: fmtDate(start, lang), value: Math.round(store.weekMinutes(start) / 60 * 10) / 10 });
  }
  const monthPanel = el('div', { class: 'panel' }, el('h3', { html: ms('show_chart') }, t('monthlyTrend')));
  monthPanel.append(lineChart(monthData, { unit: 'h' }));

  // donut of subjects
  const donutPanel = el('div', { class: 'panel' }, el('h3', { html: ms('donut_large') }, t('topSubjects')));
  if (top.length) {
    const dData = top.map(([id, mins]) => ({ label: store.subjectName(id), value: mins, color: store.subjectColor(id) }));
    const total = top.reduce((a, [, v]) => a + v, 0);
    donutPanel.append(el('div', { class: 'row', style: 'justify-content:center;gap:24px;flex-wrap:wrap' },
      donut(dData, { size: 200, thickness: 30, centerLabel: fmtDur(total, lang) }),
      el('div', {}, ...dData.map(d => el('div', { class: 'row', style: 'gap:8px;padding:3px 0;font-size:14px' },
        el('span', { class: 'dot', style: `background:${d.color}` }),
        el('span', { style: 'flex:1' }, d.label),
        el('b', {}, fmtDur(d.value, lang)))))));
  } else {
    donutPanel.append(el('div', { class: 'empty' }, el('span', { class: 'ms' }, 'donut_large'), el('div', {}, t('noData'))));
  }

  root.append(
    el('div', { class: 'grid g2', style: 'margin-top:16px' }, weekPanel, monthPanel),
    el('div', { style: 'margin-top:16px' }, donutPanel));
}

function stat(icon, big, label) {
  return el('div', { class: 'stat' },
    el('span', { class: 'ic', html: ms(icon) }),
    el('div', {}, el('b', {}, big), el('span', {}, label)));
}
