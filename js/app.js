// iLogia Planner — app shell: layout, sidebar, hash router
import { el, ms, $ } from './utils.js';
import { t, getLang, setLang, isRTL } from './i18n.js';
import { store, seedIfEmpty } from './store.js';
import { initAuth, getUser, loginDialog, logout } from './auth.js';
import { renderDashboard } from './views/dashboard.js';
import { renderTimetable } from './views/timetable.js';
import { renderTasks } from './views/tasks.js';
import { renderPlanner } from './views/planner.js';
import { renderTimer, stopTimerView } from './views/timer.js';
import { renderExams } from './views/exams.js';
import { renderGoals } from './views/goals.js';
import { renderStats } from './views/stats.js';
import { renderSettings } from './views/settings.js';

const ROUTES = {
  dashboard: { icon: 'dashboard', render: renderDashboard },
  timetable: { icon: 'calendar_month', render: renderTimetable },
  tasks: { icon: 'task_alt', render: renderTasks },
  planner: { icon: 'route', render: renderPlanner },
  timer: { icon: 'timer', render: renderTimer, unmount: stopTimerView },
  exams: { icon: 'event', render: renderExams },
  goals: { icon: 'track_changes', render: renderGoals },
  stats: { icon: 'monitoring', render: renderStats },
  settings: { icon: 'settings', render: renderSettings },
};
const NAV = [
  { grp: 'navMain', items: ['dashboard', 'timetable', 'tasks'] },
  { grp: 'navPlan', items: ['planner', 'timer', 'exams'] },
  { grp: 'navTrack', items: ['goals', 'stats', 'settings'] },
];

let currentRoute = null;

function route() {
  const h = location.hash.replace('#/', '').replace('#', '') || 'dashboard';
  return ROUTES[h] ? h : 'dashboard';
}

function applyPrefs() {
  document.documentElement.lang = getLang();
  document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
  document.documentElement.dataset.theme = store.settings.theme === 'dark' ? 'dark' : '';
}

function shell() {
  const app = $('#app');
  app.innerHTML = '';
  app.className = 'app';

  const brand = el('a', { class: 'brand', href: '#/' },
    el('span', { class: 'lm', html: ms('school', 'f') }),
    el('span', {}, el('b', {}, t('appName')), el('small', {}, t('appSub'))));

  const snav = el('nav', { class: 'snav' });
  for (const g of NAV) {
    snav.append(el('div', { class: 'grp' }, t(g.grp)));
    for (const key of g.items) {
      snav.append(el('a', { href: `#/${key}`, 'data-r': key, html: ms(ROUTES[key].icon) + `<span>${t(key)}</span>` }));
    }
  }

  const userBox = el('div', { class: 'foot' });
  const side = el('aside', { class: 'side' }, brand, snav, userBox);

  const burger = el('button', { class: 'ibtn burger', html: ms('menu'), onclick: toggleSide });
  const pageTitle = el('h1', {}, '');
  const langBtn = el('button', {
    class: 'btn g s', onclick: () => { setLang(getLang() === 'ar' ? 'en' : 'ar'); boot(); }
  }, getLang() === 'ar' ? 'EN' : 'عربي');
  const mbar = el('header', { class: 'mbar' }, burger, pageTitle, el('div', { class: 'sp' }, langBtn));

  const content = el('main', { class: 'content' });
  const pfoot = el('div', { class: 'pfoot' }, t('localMode'));
  const main = el('div', { class: 'main' }, mbar, content, pfoot);

  app.append(side, main);
  return { side, snav, userBox, pageTitle, content };
}

let ui;
function toggleSide() {
  ui.side.classList.toggle('open');
  document.querySelector('.scrim')?.remove();
  if (ui.side.classList.contains('open')) {
    const scrim = el('div', { class: 'scrim', onclick: toggleSide });
    document.body.append(scrim);
  }
}

function renderUserBox() {
  const u = getUser();
  ui.userBox.innerHTML = '';
  if (u) {
    ui.userBox.append(
      el('span', {}, `${t('loggedAs')}: ${u.email}`),
      el('button', { class: 'btn g s', onclick: async () => { await logout(); renderUserBox(); } }, t('logout'))
    );
  } else {
    ui.userBox.append(
      el('button', { class: 'btn gold s', onclick: () => loginDialog() }, t('login'))
    );
  }
}

function mount() {
  const r = route();
  if (currentRoute && ROUTES[currentRoute].unmount) ROUTES[currentRoute].unmount();
  currentRoute = r;
  ui.pageTitle.textContent = t(r);
  ui.snav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  ui.side.classList.remove('open');
  document.querySelector('.scrim')?.remove();
  ui.content.innerHTML = '';
  ROUTES[r].render(ui.content);
  renderUserBox();
}

function boot() {
  applyPrefs();
  ui = shell();
  mount();
}

window.addEventListener('hashchange', mount);

seedIfEmpty();
boot();
initAuth().then(renderUserBox);
