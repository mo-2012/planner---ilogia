// iLogia Planner — Weekly timetable (interactive grid, color-coded sessions, conflict detection)
import { el, ms, fmtTime, fmtDur, AR_DAYS, EN_DAYS, confirmBox, toast } from '../utils.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { findConflicts } from '../smart.js';
import { sessionModal } from '../forms.js';

const DAY_START_H = 6, DAY_END_H = 23, SLOT = 30; // minutes
const ROWS = ((DAY_END_H - DAY_START_H) * 60) / SLOT;

export function renderTimetable(root) {
  const lang = getLang();
  const days = lang === 'ar' ? AR_DAYS : EN_DAYS;
  const st = store.state;
  const conflicts = findConflicts(st.sessions);
  const todayPlannerDay = [6, 0, 1, 2, 3, 4, 5].indexOf(new Date().getDay());

  const legend = el('div', { class: 'legend', style: 'margin-bottom:12px' },
    ...st.subjects.map(s => el('span', { class: 'row', style: 'gap:6px' },
      el('span', { class: 'dot', style: `background:${s.color}` }), s.name)));

  const grid = el('div', {
    class: 'tt',
    style: `grid-template-columns:56px repeat(7,minmax(110px,1fr));grid-auto-rows:44px`
  });

  // header row
  grid.append(el('div', { class: 'th corner', style: 'grid-row:1' }, ''));
  days.forEach((d, i) => {
    grid.append(el('div', {
      class: 'th' + (i === todayPlannerDay ? ' today' : ''),
      style: 'grid-row:1', html: `<b>${d}</b>${i === todayPlannerDay ? `<span style="color:var(--primary-c)">${t('today')}</span>` : ''}`
    }));
  });

  const evsByDay = {};
  for (const s of st.sessions) (evsByDay[s.day] ||= []).push(s);

  for (let r = 0; r < ROWS; r++) {
    const mins = DAY_START_H * 60 + r * SLOT;
    // axis label on the hour
    grid.append(el('div', { class: 'axis', style: `grid-row:${r + 2};grid-column:1` }, mins % 60 === 0 ? fmtTime(mins) : ''));
    for (let d = 0; d < 7; d++) {
      const covered = (evsByDay[d] || []).some(s => s.startMin < mins + SLOT && s.endMin > mins);
      const isStudyDay = st.settings.studyDays.includes(d);
      if (!covered) {
        grid.append(el('div', {
          class: 'cell' + (isStudyDay ? '' : ' off'),
          style: `grid-row:${r + 2};grid-column:${d + 2}`,
          onclick: isStudyDay ? () => sessionModal(null, { day: d, start: mins }, rerender) : null,
          html: isStudyDay ? '<span class="hit">+</span>' : ''
        }));
      }
    }
  }

  // events on top
  for (const s of st.sessions) {
    const r0 = (s.startMin - DAY_START_H * 60) / SLOT + 2;
    const span = Math.max(1, (s.endMin - s.startMin) / SLOT);
    const subj = store.subject(s.subjectId);
    const lesson = subj?.lessons.find(l => l.id === s.lessonId);
    const ev = el('div', {
      class: 'evt' + (conflicts.has(s.id) ? ' conflict' : ''),
      style: `grid-column:${s.day + 2};grid-row:${r0} / span ${span};background:${store.subjectColor(s.subjectId)}`,
      title: conflicts.has(s.id) ? t('conflictWarn') : '',
      onclick: (e) => {
        e.stopPropagation();
        sessionModal(s, null, rerender);
      },
      html: `<b>${subj?.name || '—'}</b><small>${fmtTime(s.startMin)}–${fmtTime(s.endMin)}${lesson ? ' · ' + lesson.title : ''}${conflicts.has(s.id) ? ' ⚠' : ''}</small>`
    });
    // delete button
    const del = el('button', {
      class: 'ibtn', style: 'position:absolute;top:2px;inset-inline-end:2px;width:22px;height:22px;color:#fff',
      html: ms('close'), onclick: (e) => {
        e.stopPropagation();
        confirmBox(getLang() === 'ar' ? 'حذف هذه الجلسة؟' : 'Delete this session?', () => {
          store.update(st2 => st2.sessions = st2.sessions.filter(x => x.id !== s.id));
          rerender();
        }, getLang());
      }
    });
    ev.append(del);
    grid.append(ev);
  }

  if (conflicts.size) {
    root.append(el('div', { class: 'warn-strip', html: ms('warning') },
      el('span', {}, `${t('conflictWarn')} — ${conflicts.size / 2} ${lang === 'ar' ? 'تعارض' : 'overlap(s)'}`)));
  }

  root.append(
    el('div', { class: 'row', style: 'margin-bottom:12px' },
      el('button', { class: 'btn', html: ms('add') , onclick: () => sessionModal(null, null, rerender) }, t('addSession'))),
    legend,
    el('div', { class: 'tt-wrap' }, grid)
  );

  function rerender() { root.innerHTML = ''; renderTimetable(root); }
}
