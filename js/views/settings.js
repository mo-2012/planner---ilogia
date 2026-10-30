// iLogia Planner — Settings (schedule, pomodoro, notifications, theme, subjects)
import { el, ms, toast, confirmBox, AR_DAYS, EN_DAYS } from '../utils.js';
import { t, getLang, setLang } from '../i18n.js';
import { store } from '../store.js';
import { subjectModal, lessonsModal } from '../forms.js';

export function renderSettings(root) {
  const lang = getLang();
  const days = lang === 'ar' ? AR_DAYS : EN_DAYS;
  const s = store.settings;

  const rerender = () => { root.innerHTML = ''; renderSettings(root); };

  // ---- schedule ----
  const dayChecks = el('div', { class: 'row' });
  days.forEach((d, i) => {
    const on = s.studyDays.includes(i);
    dayChecks.append(el('button', {
      class: 'chip', 'aria-pressed': String(on),
      onclick: (e) => {
        store.update(st => {
          const arr = st.settings.studyDays;
          const idx = arr.indexOf(i);
          idx >= 0 ? arr.splice(idx, 1) : arr.push(i);
        });
        e.currentTarget.setAttribute('aria-pressed', String(store.settings.studyDays.includes(i)));
      }
    }, d));
  });
  const dayStart = el('input', { type: 'time', value: s.dayStart });
  const dayEnd = el('input', { type: 'time', value: s.dayEnd });
  dayStart.addEventListener('change', () => store.update(st => st.settings.dayStart = dayStart.value));
  dayEnd.addEventListener('change', () => store.update(st => st.settings.dayEnd = dayEnd.value));

  const schedPanel = el('div', { class: 'panel form-grid' },
    el('h3', { html: ms('calendar_month') }, t('timetable')),
    el('label', {}, t('studyDays'), dayChecks),
    el('div', { class: 'two', style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px' },
      el('label', {}, t('dayStart'), dayStart),
      el('label', {}, t('dayEnd'), dayEnd)));

  // ---- pomodoro ----
  const focus = el('input', { type: 'number', min: '5', max: '120', value: s.pomodoro.focus });
  const brk = el('input', { type: 'number', min: '1', max: '60', value: s.pomodoro.break });
  const cyc = el('input', { type: 'number', min: '1', max: '10', value: s.pomodoro.cycles });
  const pomPanel = el('div', { class: 'panel form-grid' },
    el('h3', { html: ms('timer') }, t('pomSettings')),
    el('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px' },
      el('label', {}, t('focusMin'), focus),
      el('label', {}, t('breakMin'), brk),
      el('label', {}, t('cycles'), cyc)),
    el('button', {
      class: 'btn s', style: 'justify-self:start', onclick: () => {
        store.update(st => st.settings.pomodoro = {
          focus: Math.max(5, +focus.value || 25), break: Math.max(1, +brk.value || 5), cycles: Math.max(1, +cyc.value || 4)
        });
        toast(lang === 'ar' ? 'تم الحفظ' : 'Saved', 'ok');
      }
    }, t('save')));

  // ---- notifications ----
  const notifSupported = 'Notification' in window;
  const notifBtn = el('button', {
    class: 'btn g s', disabled: notifSupported ? null : '',
    onclick: async () => {
      if (!notifSupported) return;
      const perm = await Notification.requestPermission();
      store.update(st => st.settings.notif = perm === 'granted');
      toast(perm === 'granted' ? (lang === 'ar' ? 'فُعّلت الإشعارات' : 'Notifications on') : (lang === 'ar' ? 'رُفض الإذن' : 'Permission denied'), perm === 'granted' ? 'ok' : 'err');
      rerender();
    }
  }, s.notif && Notification.permission === 'granted' ? '✓ ' + t('enableNotif') : t('enableNotif'));
  const notifPanel = el('div', { class: 'panel form-grid' },
    el('h3', { html: ms('notifications') }, t('prefNotif')),
    notifSupported ? notifBtn : el('p', { class: 'hint' }, t('notifUnsupported')));

  // ---- appearance ----
  const themeSel = el('select', {},
    el('option', { value: 'light' }, t('light')), el('option', { value: 'dark' }, t('dark')));
  themeSel.value = s.theme;
  themeSel.addEventListener('change', () => {
    store.update(st => st.settings.theme = themeSel.value);
    document.documentElement.dataset.theme = themeSel.value === 'dark' ? 'dark' : '';
  });
  const langSel = el('select', {}, el('option', { value: 'ar' }, 'العربية'), el('option', { value: 'en' }, 'English'));
  langSel.value = lang;
  langSel.addEventListener('change', () => { setLang(langSel.value); location.reload(); });
  const appearPanel = el('div', { class: 'panel form-grid' },
    el('h3', { html: ms('palette') }, t('theme')),
    el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:16px' },
      el('label', {}, t('theme'), themeSel),
      el('label', {}, t('language'), langSel)));

  // ---- subjects management ----
  const subjPanel = el('div', { class: 'panel' },
    el('h3', { html: ms('menu_book') }, t('manageSubjects'),
      el('button', { class: 'btn s sp', onclick: () => subjectModal(null, rerender) }, t('addSubject'))));
  if (!store.state.subjects.length) subjPanel.append(el('div', { class: 'empty' }, el('span', { class: 'ms' }, 'menu_book'), el('div', {}, t('noData'))));
  for (const subj of store.state.subjects) {
    const doneL = subj.lessons.filter(l => l.done).length;
    subjPanel.append(el('div', { class: 'row', style: 'padding:10px 0;border-block-end:1px solid var(--line)' },
      el('span', { class: 'dot', style: `background:${subj.color};width:14px;height:14px` }),
      el('div', { style: 'flex:1' },
        el('b', {}, subj.name),
        el('div', { style: 'font-size:12px;color:var(--mut)' }, `${doneL}/${subj.lessons.length} ${t('lessonsOf')}`)),
      el('button', { class: 'btn g s', onclick: () => lessonsModal(subj, rerender) }, t('lessonsOf')),
      el('button', { class: 'ibtn', html: ms('edit'), onclick: () => subjectModal(subj, rerender) }),
      el('button', {
        class: 'ibtn del', html: ms('delete'), onclick: () =>
          confirmBox(lang === 'ar' ? `حذف "${subj.name}"؟ ستبقى السجلات السابقة بلا مادة.` : `Delete "${subj.name}"?`, () => {
            store.update(st => st.subjects = st.subjects.filter(x => x.id !== subj.id)); rerender();
          }, lang)
      })));
  }

  // ---- data export/import ----
  const dataPanel = el('div', { class: 'panel form-grid' },
    el('h3', { html: ms('database') }, lang === 'ar' ? 'البيانات' : 'Data'),
    el('p', { class: 'hint' }, t('localMode')),
    el('div', { class: 'row' },
      el('button', {
        class: 'btn g s', html: ms('download'), onclick: () => {
          const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
          const a = el('a', { href: URL.createObjectURL(blob), download: `ilogia-planner-backup-${new Date().toISOString().slice(0, 10)}.json` });
          a.click();
        }
      }, lang === 'ar' ? 'تصدير نسخة احتياطية' : 'Export backup'),
      (() => {
        const inp = el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
        inp.addEventListener('change', async () => {
          const f = inp.files[0]; if (!f) return;
          try {
            const data = JSON.parse(await f.text());
            if (!data || !Array.isArray(data.tasks)) throw 0;
            store.update(st => Object.assign(st, data));
            toast(lang === 'ar' ? 'تم الاستيراد' : 'Imported', 'ok'); rerender();
          } catch { toast(lang === 'ar' ? 'ملف غير صالح' : 'Invalid file', 'err'); }
        });
        const btn = el('button', { class: 'btn g s', html: ms('upload'), onclick: () => inp.click() }, lang === 'ar' ? 'استيراد' : 'Import');
        const wrap = el('span', {}, btn, inp);
        return wrap;
      })()));

  root.append(
    el('div', { class: 'grid g2' },
      el('div', { class: 'grid' }, schedPanel, pomPanel, notifPanel, appearPanel),
      el('div', { class: 'grid' }, subjPanel, dataPanel)));
}
