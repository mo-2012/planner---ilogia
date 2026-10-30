// iLogia Planner — Study planner + rule-based smart distribution
import { el, ms, modal, toast, uid, fmtDate, fmtDur, fmtTime, todayISO, AR_DAYS, EN_DAYS, confirmBox, parseTime } from '../utils.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { suggestDistribution, overdueTasks } from '../smart.js';

export function renderPlanner(root) {
  const lang = getLang();
  const st = store.state;
  const days = lang === 'ar' ? AR_DAYS : EN_DAYS;

  // overdue warning
  const overdue = overdueTasks(st);
  if (overdue.length) {
    root.append(el('div', { class: 'warn-strip', html: ms('warning') },
      el('span', {}, `${t('taskOverdueReplan')} (${overdue.length})`),
      el('button', { class: 'btn s sp', onclick: () => runSmart() }, t('replan'))));
  }

  // ---- smart distribution panel ----
  const smartPanel = el('div', { class: 'panel' },
    el('h3', { html: ms('route') }, t('smartPlan')),
    el('p', { style: 'color:var(--mut);font-size:14px' }, t('smartDesc')),
    el('button', { class: 'btn', html: ms('bolt'), onclick: () => runSmart() }, t('generate')));
  const suggWrap = el('div', { style: 'margin-top:12px' });
  smartPanel.append(suggWrap);

  function runSmart() {
    const { slots, warnings } = suggestDistribution(store.state);
    suggWrap.innerHTML = '';
    if (!slots.length) {
      suggWrap.append(el('div', { class: 'empty' }, el('span', { class: 'ms' }, 'route'),
        el('div', {}, warnings.length ? t('noAvailableDays') : t('emptyTasks'))));
      return;
    }
    if (warnings.length) suggWrap.append(el('div', { class: 'warn-strip', html: ms('warning') }, el('span', {}, t('noAvailableDays'))));
    const accepted = new Set(slots.map((_, i) => i));
    const renderList = () => {
      suggWrap.innerHTML = '';
      slots.forEach((sl, i) => {
        if (!accepted.has(i)) return;
        const d = new Date(sl.date + 'T00:00:00');
        const pDay = [6, 0, 1, 2, 3, 4, 5].indexOf(d.getDay());
        suggWrap.append(el('div', { class: 'sugg' },
          el('span', { class: 'day' }, `${days[pDay]} · ${fmtDate(sl.date, lang)}`),
          el('span', { class: 'dot', style: `background:${store.subjectColor(sl.subjectId)}` }),
          el('span', { style: 'flex:1' }, sl.title),
          el('span', { class: 'badge' }, fmtDur(sl.minutes, lang)),
          el('button', { class: 'ibtn del', html: ms('close'), onclick: () => { accepted.delete(i); renderList(); } })
        ));
      });
      suggWrap.append(el('div', { class: 'row', style: 'margin-top:8px' },
        el('button', {
          class: 'btn gold', html: ms('check'),
          onclick: () => {
            // materialize: add as timetable sessions into free slots of each day
            store.update(s => {
              for (const i of accepted) {
                const sl = slots[i];
                const d = new Date(sl.date + 'T00:00:00');
                const pDay = [6, 0, 1, 2, 3, 4, 5].indexOf(d.getDay());
                const startM = nextFreeStart(s.sessions, pDay, parseTime(store.settings.dayStart), parseTime(store.settings.dayEnd), sl.minutes);
                if (startM === null) continue;
                s.sessions.push({ id: uid(), day: pDay, startMin: startM, endMin: startM + sl.minutes, subjectId: sl.subjectId, lessonId: null, note: `${t('smartPlan')}: ${sl.title}` });
              }
            });
            toast(lang === 'ar' ? 'أُضيفت الجلسات للجدول' : 'Sessions added to timetable', 'ok');
            suggWrap.innerHTML = '';
          }
        }, t('acceptAll'))));
    };
    renderList();
  }

  // ---- study plans list ----
  const plansPanel = el('div', { class: 'panel' },
    el('h3', { html: ms('menu_book') }, t('planner'),
      el('button', { class: 'btn s sp', onclick: () => planModal(null, rerender) }, t('addPlan'))));

  if (!st.plans.length) {
    plansPanel.append(el('div', { class: 'empty' }, el('span', { class: 'ms' }, 'menu_book'), el('div', {}, t('emptyPlans'))));
  }
  for (const p of st.plans) {
    // progress: hours logged on plan subjects / totalHours
    const logged = st.logs.filter(l => p.subjectIds.includes(l.subjectId)).reduce((a, l) => a + l.minutes, 0) / 60;
    const frac = Math.min(1, logged / (p.totalHours || 1));
    const linkedExam = st.exams.find(e => e.planId === p.id);
    plansPanel.append(el('div', { class: 'exam-card', style: 'margin-bottom:8px' },
      el('div', { style: 'flex:1;min-width:0' },
        el('div', { style: 'font-weight:600' }, p.title),
        el('div', { style: 'font-size:12px;color:var(--mut)' },
          `${p.subjectIds.map(id => store.subjectName(id)).join('، ') || '—'} · ${fmtDur(Math.round(logged * 60), lang)} ${t('of')} ${p.totalHours}${lang === 'ar' ? ' س' : 'h'}${linkedExam ? ` · ${t('exams')}: ${fmtDate(linkedExam.date, lang)}` : ''}`),
        el('div', { class: 'prog', style: 'margin-top:8px' }, el('i', { style: `inline-size:${frac * 100}%` }))),
      el('b', { style: 'font-family:var(--serif)' }, `${Math.round(frac * 100)}%`),
      el('button', { class: 'ibtn', html: ms('edit'), onclick: () => planModal(p, rerender) }),
      el('button', {
        class: 'ibtn del', html: ms('delete'), onclick: () =>
          confirmBox(lang === 'ar' ? `حذف خطة "${p.title}"؟` : `Delete plan "${p.title}"?`, () => {
            store.update(s => s.plans = s.plans.filter(x => x.id !== p.id)); rerender();
          }, lang)
      })));
  }

  root.append(smartPanel, el('div', { style: 'height:16px' }), plansPanel);

  function rerender() { root.innerHTML = ''; renderPlanner(root); }
}

function nextFreeStart(sessions, day, winStart, winEnd, dur) {
  const dayS = sessions.filter(s => s.day === day).sort((a, b) => a.startMin - b.startMin);
  let cursor = winStart;
  for (const s of dayS) {
    if (s.startMin - cursor >= dur) return cursor;
    cursor = Math.max(cursor, s.endMin);
  }
  return cursor + dur <= winEnd ? cursor : null;
}

function planModal(existing, onSaved) {
  const lang = getLang();
  const title = el('input', { value: existing?.title || '', placeholder: lang === 'ar' ? 'مثال: خطة مراجعة الرياضيات' : 'e.g. Math revision plan' });
  const hours = el('input', { type: 'number', min: '1', value: existing?.totalHours ?? 10 });
  const subjWrap = el('div', { class: 'row' });
  const chosen = new Set(existing?.subjectIds || []);
  const paintChips = () => {
    subjWrap.innerHTML = '';
    for (const s of store.state.subjects) {
      subjWrap.append(el('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(chosen.has(s.id)),
        onclick: (e) => { chosen.has(s.id) ? chosen.delete(s.id) : chosen.add(s.id); e.currentTarget.setAttribute('aria-pressed', String(chosen.has(s.id))); }
      }, s.name));
    }
  };
  paintChips();
  const err = el('p', { class: 'fieldmsg' });
  modal(existing ? t('edit') : t('addPlan'), el('div', { class: 'form-grid' },
    el('label', {}, t('planTitle'), title),
    el('label', {}, t('planHours'), hours),
    el('label', {}, t('planSubjects'), subjWrap),
    err
  ), () => {
    if (!title.value.trim()) { err.textContent = lang === 'ar' ? 'أدخل عنوان الخطة' : 'Title required'; return false; }
    if (!chosen.size) { err.textContent = lang === 'ar' ? 'اختر مادة واحدة على الأقل' : 'Pick at least one subject'; return false; }
    store.update(s => {
      const data = { title: title.value.trim(), totalHours: parseInt(hours.value) || 1, subjectIds: [...chosen] };
      if (existing) Object.assign(s.plans.find(x => x.id === existing.id), data);
      else s.plans.push({ id: uid(), createdAt: todayISO(), done: false, ...data });
    });
    onSaved?.();
  });
}
