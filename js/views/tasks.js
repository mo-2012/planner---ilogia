// iLogia Planner — Tasks (CRUD, priority, status, filter & search)
import { el, ms, fmtDate, confirmBox, toast, todayISO } from '../utils.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';
import { taskModal } from '../forms.js';

let filter = { status: 'all', priority: 'all', subject: 'all', q: '' };

export function renderTasks(root) {
  const lang = getLang();
  const st = store.state;
  const today = todayISO();

  const paint = () => {
    listWrap.innerHTML = '';
    let items = st.tasks.filter(x =>
      (filter.status === 'all' || x.status === filter.status) &&
      (filter.priority === 'all' || x.priority === filter.priority) &&
      (filter.subject === 'all' || x.subjectId === filter.subject) &&
      (!filter.q || (x.title + ' ' + (x.desc || '')).toLowerCase().includes(filter.q.toLowerCase())));
    items.sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (b.status === 'done' && a.status !== 'done') return -1;
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });
    if (!items.length) { listWrap.append(el('div', { class: 'empty' }, el('span', { class: 'ms' }, 'task_alt'), el('div', {}, t('emptyTasks')))); return; }
    for (const task of items) {
      const overdue = task.status !== 'done' && task.dueDate && task.dueDate < today;
      listWrap.append(el('div', { class: 'taskrow' + (task.status === 'done' ? ' done' : '') },
        el('button', {
          class: 'ibtn', html: ms(task.status === 'done' ? 'check_circle' : task.status === 'doing' ? 'timelapse' : 'radio_button_unchecked'),
          title: t('status'),
          onclick: () => {
            store.update(s => {
              const x = s.tasks.find(y => y.id === task.id);
              x.status = x.status === 'todo' ? 'doing' : x.status === 'doing' ? 'done' : 'todo';
            });
            paint();
          }
        }),
        el('span', { class: 'dot', style: `background:${store.subjectColor(task.subjectId)}` }),
        el('div', { style: 'min-width:0;flex:1' },
          el('div', { class: 'ttl' }, task.title),
          el('div', { class: 'sub' }, `${store.subjectName(task.subjectId)}${task.dueDate ? ' · ' + fmtDate(task.dueDate, lang) : ''}${task.estHours ? ` · ${task.estHours}h` : ''}${task.desc ? ' · ' + task.desc.slice(0, 60) : ''}`)),
        overdue ? el('span', { class: 'pr high' }, t('overdue')) : null,
        el('span', { class: `pr ${task.priority}` }, t('p' + task.priority[0].toUpperCase() + task.priority.slice(1))),
        el('span', { class: `st ${task.status}` }, t('s' + task.status[0].toUpperCase() + task.status.slice(1))),
        el('button', { class: 'ibtn', html: ms('edit'), onclick: () => taskModal(task, paint) }),
        el('button', {
          class: 'ibtn del', html: ms('delete'), onclick: () =>
            confirmBox(lang === 'ar' ? `حذف "${task.title}"؟` : `Delete "${task.title}"?`, () => {
              store.update(s => s.tasks = s.tasks.filter(x => x.id !== task.id));
              toast(lang === 'ar' ? 'حُذفت المهمة' : 'Task deleted', 'ok');
              paint();
            }, lang)
        })
      ));
    }
  };

  // filters bar
  const search = el('input', { type: 'search', placeholder: t('search'), value: filter.q });
  search.addEventListener('input', () => { filter.q = search.value; paint(); });

  const chipRow = (key, options) => el('div', { class: 'row', style: 'gap:4px' },
    ...options.map(([v, label]) => el('button', {
      class: 'chip', 'aria-pressed': String(filter[key] === v),
      onclick: (e) => {
        filter[key] = v;
        e.currentTarget.parentElement.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        paint();
      }
    }, label)));

  const subjSel = el('select', { style: 'width:auto;min-block-size:40px' },
    el('option', { value: 'all' }, `${t('all')} — ${t('subjects')}`),
    ...st.subjects.map(s => el('option', { value: s.id }, s.name)));
  subjSel.value = filter.subject;
  subjSel.addEventListener('change', () => { filter.subject = subjSel.value; paint(); });

  const listWrap = el('div', { class: 'panel', style: 'padding:8px 16px' });

  root.append(
    el('div', { class: 'filters' },
      el('button', { class: 'btn', html: ms('add'), onclick: () => taskModal(null, paint) }, t('addTask')),
      search, subjSel,
      chipRow('status', [['all', t('all')], ['todo', t('sTodo')], ['doing', t('sDoing')], ['done', t('sDone')]]),
      chipRow('priority', [['all', t('all')], ['high', t('pHigh')], ['med', t('pMed')], ['low', t('pLow')]]),
    ),
    listWrap
  );
  paint();
}
