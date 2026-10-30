// iLogia Planner — Exams calendar
import { el, ms, fmtDate, daysBetween, todayISO, confirmBox, AR_DAYS, EN_DAYS, AR_MONTHS, EN_MONTHS } from '../utils.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { examModal } from '../forms.js';

export function renderExams(root) {
  const lang = getLang();
  const st = store.state;
  const today = todayISO();

  const paint = () => {
    listWrap.innerHTML = '';
    const exams = [...st.exams].sort((a, b) => a.date.localeCompare(b.date));
    if (!exams.length) {
      listWrap.append(el('div', { class: 'empty' }, el('span', { class: 'ms' }, 'event'), el('div', {}, t('emptyExams'))));
    }
    for (const e of exams) {
      const dLeft = daysBetween(today, e.date);
      const soon = dLeft >= 0 && dLeft <= 3;
      const past = dLeft < 0;
      const plan = st.plans.find(p => p.id === e.planId);
      listWrap.append(el('div', { class: 'exam-card' + (soon ? ' soon' : ''), style: 'margin-bottom:8px' + (past ? ';opacity:.55' : '') },
        el('div', { class: 'cd' },
          el('b', {}, past ? '—' : String(dLeft)),
          el('span', {}, past ? t('overdue') : dLeft === 0 ? t('examToday') : t('daysLeft'))),
        el('div', { style: 'flex:1;min-width:0' },
          el('div', { style: 'font-weight:600' },
            el('span', { class: 'dot', style: `background:${store.subjectColor(e.subjectId)};margin-inline-end:6px` }),
            `${store.subjectName(e.subjectId)}${e.topic ? ' — ' + e.topic : ''}`),
          el('div', { style: 'font-size:12px;color:var(--mut)' },
            `${fmtDate(e.date, lang, true)} · ${e.time || ''}${plan ? ` · ${t('planner')}: ${plan.title}` : ''}${e.notes ? ' · ' + e.notes.slice(0, 40) : ''}`)),
        el('button', { class: 'ibtn', html: ms('edit'), onclick: () => examModal(e, paint) }),
        el('button', {
          class: 'ibtn del', html: ms('delete'), onclick: () =>
            confirmBox(lang === 'ar' ? 'حذف هذا الامتحان؟' : 'Delete this exam?', () => {
              store.update(s => s.exams = s.exams.filter(x => x.id !== e.id)); paint(); paintCal();
            }, lang)
        })));
    }
  };

  // ---- calendar grid of current month with exam markers ----
  const calPanel = el('div', { class: 'panel' }, el('h3', { html: ms('calendar_month') }, t('miniCal')));
  const calWrap = el('div', {});
  calPanel.append(calWrap);

  function paintCal() {
    calWrap.innerHTML = '';
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const days = lang === 'ar' ? AR_DAYS : EN_DAYS;
    const months = lang === 'ar' ? AR_MONTHS : EN_MONTHS;
    calWrap.append(el('div', { style: 'text-align:center;font-weight:700;margin-bottom:8px;font-family:var(--serif)' }, `${months[m]} ${y}`));
    const grid = el('div', { class: 'mcal' });
    for (const d of days) grid.append(el('div', { class: 'h' }, d.slice(0, lang === 'ar' ? 5 : 3)));
    const first = new Date(y, m, 1);
    const lead = [6, 0, 1, 2, 3, 4, 5].indexOf(first.getDay());
    const nDays = new Date(y, m + 1, 0).getDate();
    const examDates = new Map(st.exams.map(e => [e.date, e]));
    for (let i = 0; i < lead; i++) grid.append(el('button', { class: 'dim', disabled: '' }, ''));
    for (let d = 1; d <= nDays; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const ex = examDates.get(iso);
      grid.append(el('button', {
        class: iso === today ? 'today' : '',
        title: ex ? `${store.subjectName(ex.subjectId)} — ${ex.topic || ''}` : '',
        style: ex ? 'box-shadow:inset 0 0 0 2px var(--gold);font-weight:700' : ''
      }, String(d), ex ? el('span', { class: 'd' }) : null));
    }
    calWrap.append(grid);
  }

  const listWrap = el('div', {});
  root.append(
    el('div', { class: 'row', style: 'margin-bottom:12px' },
      el('button', { class: 'btn', html: ms('add'), onclick: () => examModal(null, () => { paint(); paintCal(); }) }, t('addExam'))),
    el('div', { class: 'grid g2' },
      el('div', {}, listWrap),
      calPanel)
  );
  paint(); paintCal();
}
