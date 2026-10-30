// iLogia Planner — shared form modals (subjects, tasks, sessions, exams, goals)
import { el, ms, modal, toast, uid, SUBJECT_COLORS, fmtTime, parseTime, AR_DAYS, EN_DAYS } from './utils.js';
import { t, getLang } from './i18n.js';
import { store } from './store.js';

const days = () => (getLang() === 'ar' ? AR_DAYS : EN_DAYS);

function subjectSelect(selected) {
  const sel = el('select', {});
  sel.append(el('option', { value: '' }, '—'));
  for (const s of store.state.subjects) sel.append(el('option', { value: s.id }, s.name));
  if (selected) sel.value = selected;
  return sel;
}
function lessonSelect(subjectId, selected) {
  const sel = el('select', {});
  sel.append(el('option', { value: '' }, '—'));
  const subj = store.subject(subjectId);
  if (subj) for (const l of subj.lessons) sel.append(el('option', { value: l.id }, l.title));
  if (selected) sel.value = selected;
  return sel;
}

// ---------- subject ----------
export function subjectModal(existing, onSaved) {
  let color = existing?.color || SUBJECT_COLORS[0];
  const name = el('input', { value: existing?.name || '', placeholder: getLang() === 'ar' ? 'مثال: رياضيات' : 'e.g. Math' });
  const palette = el('div', { class: 'colors' });
  const paint = () => {
    palette.innerHTML = '';
    for (const c of SUBJECT_COLORS) {
      palette.append(el('button', {
        type: 'button', style: `background:${c}`, 'aria-pressed': String(c === color),
        onclick: () => { color = c; paint(); }
      }));
    }
  };
  paint();
  modal(existing ? t('edit') : t('addSubject'), el('div', { class: 'form-grid' },
    el('label', {}, t('title'), name), el('label', {}, 'Color', palette)
  ), () => {
    if (!name.value.trim()) return false;
    store.update(s => {
      if (existing) Object.assign(s.subjects.find(x => x.id === existing.id), { name: name.value.trim(), color });
      else s.subjects.push({ id: uid(), name: name.value.trim(), color, lessons: [] });
    });
    onSaved?.();
  });
}

export function lessonsModal(subj, onSaved) {
  const wrap = el('div', { class: 'form-grid' });
  const list = el('div', {});
  const paintList = () => {
    list.innerHTML = '';
    for (const l of subj.lessons) {
      list.append(el('div', { class: 'row', style: 'padding:4px 0' },
        el('span', { class: 'dot', style: `background:${subj.color}` }),
        el('span', { style: l.done ? 'text-decoration:line-through;color:var(--mut)' : '' }, l.title),
        el('span', { class: 'sp' }),
        el('button', {
          class: 'ibtn', html: ms(l.done ? 'undo' : 'check'), title: t('markDone'),
          onclick: () => { store.update(s => { const sj = s.subjects.find(x => x.id === subj.id); const ls = sj.lessons.find(x => x.id === l.id); ls.done = !ls.done; if (ls.done) s.logs.push({ id: uid(), subjectId: subj.id, minutes: 0, date: new Date().toISOString().slice(0, 10), source: 'lesson', lessonDone: true }); }); paintList(); onSaved?.(); }
        }),
        el('button', {
          class: 'ibtn del', html: ms('delete'), onclick: () => { store.update(s => { const sj = s.subjects.find(x => x.id === subj.id); sj.lessons = sj.lessons.filter(x => x.id !== l.id); }); paintList(); onSaved?.(); }
        })
      ));
    }
  };
  paintList();
  const inp = el('input', { placeholder: t('addLesson') });
  wrap.append(list, el('div', { class: 'row' },
    inp,
    el('button', {
      class: 'btn s', onclick: () => {
        if (!inp.value.trim()) return;
        store.update(s => s.subjects.find(x => x.id === subj.id).lessons.push({ id: uid(), title: inp.value.trim(), done: false }));
        inp.value = ''; paintList(); onSaved?.();
      }
    }, t('addLesson'))
  ));
  modal(`${t('lessonsOf')} — ${subj.name}`, wrap, null, { okLabel: '' });
}

// ---------- task ----------
export function taskModal(existing, onSaved) {
  const lang = getLang();
  const title = el('input', { value: existing?.title || '' });
  const desc = el('textarea', {}, existing?.desc || '');
  const subj = subjectSelect(existing?.subjectId);
  const due = el('input', { type: 'date', value: existing?.dueDate || '' });
  const hours = el('input', { type: 'number', min: '0.5', step: '0.5', value: existing?.estHours ?? 1 });
  const pr = el('select', {},
    el('option', { value: 'low' }, t('pLow')), el('option', { value: 'med' }, t('pMed')), el('option', { value: 'high' }, t('pHigh')));
  if (existing) pr.value = existing.priority;
  const st = el('select', {},
    el('option', { value: 'todo' }, t('sTodo')), el('option', { value: 'doing' }, t('sDoing')), el('option', { value: 'done' }, t('sDone')));
  if (existing) st.value = existing.status;
  modal(existing ? t('edit') : t('addTask'), el('div', { class: 'form-grid' },
    el('label', {}, t('title'), title),
    el('label', {}, t('desc'), desc),
    el('div', { class: 'two' },
      el('label', {}, t('subject'), subj),
      el('label', {}, t('dueDate'), due)),
    el('div', { class: 'two' },
      el('label', {}, t('priority'), pr),
      el('label', {}, t('estHours'), hours)),
    existing ? el('label', {}, t('status'), st) : null
  ), () => {
    if (!title.value.trim()) return false;
    const data = { title: title.value.trim(), desc: desc.value, subjectId: subj.value || null, dueDate: due.value || null, priority: pr.value, status: st.value, estHours: parseFloat(hours.value) || 1 };
    store.update(s => {
      if (existing) Object.assign(s.tasks.find(x => x.id === existing.id), data);
      else s.tasks.push({ id: uid(), createdAt: new Date().toISOString().slice(0, 10), ...data });
    });
    toast(lang === 'ar' ? 'تم الحفظ' : 'Saved', 'ok');
    onSaved?.();
  });
}

// ---------- session ----------
export function sessionModal(existing, preset, onSaved) {
  const lang = getLang();
  const subj = subjectSelect(existing?.subjectId || preset?.subjectId);
  const lesson = lessonSelect(subj.value, existing?.lessonId);
  subj.addEventListener('change', () => { const nl = lessonSelect(subj.value, null); lesson.replaceWith(nl); nl.id = 'lesson-sel'; });
  lesson.id = 'lesson-sel';
  const day = el('select', {});
  days().forEach((d, i) => day.append(el('option', { value: i }, d)));
  day.value = existing?.day ?? preset?.day ?? 0;
  const start = el('input', { type: 'time', value: existing ? fmtTime(existing.startMin) : (preset?.start ? fmtTime(preset.start) : store.settings.dayStart) });
  const end = el('input', { type: 'time', value: existing ? fmtTime(existing.endMin) : (preset?.start ? fmtTime(preset.start + 60) : store.settings.dayEnd) });
  const note = el('input', { value: existing?.note || '' });
  const err = el('p', { class: 'fieldmsg' });
  modal(existing ? t('edit') : t('addSession'), el('div', { class: 'form-grid' },
    el('div', { class: 'two' },
      el('label', {}, t('subject'), subj),
      el('label', {}, t('lesson'), lesson)),
    el('label', {}, t('day'), day),
    el('div', { class: 'two' },
      el('label', {}, t('start'), start),
      el('label', {}, t('end'), end)),
    el('label', {}, t('notes'), note),
    err
  ), () => {
    const sMin = parseTime(start.value), eMin = parseTime(end.value);
    if (!subj.value) { err.textContent = lang === 'ar' ? 'اختر المادة' : 'Pick a subject'; return false; }
    if (eMin <= sMin) { err.textContent = lang === 'ar' ? 'وقت النهاية يجب أن يكون بعد البداية' : 'End must be after start'; return false; }
    store.update(s => {
      const data = { day: +day.value, startMin: sMin, endMin: eMin, subjectId: subj.value, lessonId: document.querySelector('#lesson-sel')?.value || null, note: note.value };
      if (existing) Object.assign(s.sessions.find(x => x.id === existing.id), data);
      else s.sessions.push({ id: uid(), ...data });
    });
    onSaved?.();
  });
}

// ---------- exam ----------
export function examModal(existing, onSaved) {
  const subj = subjectSelect(existing?.subjectId);
  const topic = el('input', { value: existing?.topic || '' });
  const date = el('input', { type: 'date', value: existing?.date || '' });
  const time = el('input', { type: 'time', value: existing?.time || '09:00' });
  const notes = el('textarea', {}, existing?.notes || '');
  const plan = el('select', {});
  plan.append(el('option', { value: '' }, t('none')));
  for (const p of store.state.plans) plan.append(el('option', { value: p.id }, p.title));
  if (existing?.planId) plan.value = existing.planId;
  const err = el('p', { class: 'fieldmsg' });
  modal(existing ? t('edit') : t('addExam'), el('div', { class: 'form-grid' },
    el('div', { class: 'two' },
      el('label', {}, t('subject'), subj),
      el('label', {}, t('examTopic'), topic)),
    el('div', { class: 'two' },
      el('label', {}, t('examDate'), date),
      el('label', {}, t('examTime'), time)),
    el('label', {}, t('linkExam'), plan),
    el('label', {}, t('notes'), notes),
    err
  ), () => {
    if (!subj.value || !date.value) { err.textContent = getLang() === 'ar' ? 'المادة والتاريخ مطلوبان' : 'Subject & date required'; return false; }
    const data = { subjectId: subj.value, topic: topic.value.trim(), date: date.value, time: time.value, notes: notes.value, planId: plan.value || null };
    store.update(s => {
      if (existing) Object.assign(s.exams.find(x => x.id === existing.id), data);
      else s.exams.push({ id: uid(), ...data });
    });
    onSaved?.();
  });
}

// ---------- goal ----------
export function goalModal(existing, onSaved) {
  const type = el('select', {}, el('option', { value: 'daily' }, t('dailyGoal')), el('option', { value: 'weekly' }, t('weeklyGoal')));
  const metric = el('select', {}, el('option', { value: 'hours' }, t('hoursMetric')), el('option', { value: 'lessons' }, t('lessonsMetric')));
  const target = el('input', { type: 'number', min: '1', value: existing?.target ?? 2 });
  if (existing) { type.value = existing.type; metric.value = existing.metric; }
  modal(existing ? t('edit') : t('addGoal'), el('div', { class: 'form-grid' },
    el('div', { class: 'two' },
      el('label', {}, t('status'), type),
      el('label', {}, t('target'), metric)),
    el('label', {}, `${t('target')} (${getLang() === 'ar' ? 'ساعات/دروس' : 'hours/lessons'})`, target)
  ), () => {
    const tg = parseInt(target.value);
    if (!tg || tg < 1) return false;
    store.update(s => {
      if (existing) Object.assign(s.goals.find(x => x.id === existing.id), { type: type.value, metric: metric.value, target: tg });
      else s.goals.push({ id: uid(), type: type.value, metric: metric.value, target: tg, period: null, createdAt: new Date().toISOString().slice(0, 10), closed: false });
    });
    onSaved?.();
  });
}
