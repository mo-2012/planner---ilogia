// iLogia Planner — optional Supabase auth via the shared iLogia client (js/supabase-client.js).
// Imported lazily: if the CDN or Supabase is unreachable the app still works in local mode.
// Data stays local until the planner_* schema migration is approved & applied (see migrations/).
import { store } from './store.js';
import { toast, el, modal } from './utils.js';
import { t, getLang } from './i18n.js';

let currentUser = null;
let authService = null;

async function getAuth() {
  if (!authService) {
    const m = await import('./supabase-client.js');
    authService = m.authService;
  }
  return authService;
}

export async function initAuth() {
  try {
    const auth = await getAuth();
    const session = await auth.session();
    setUser(session?.user || null);
    auth.onChange((s) => setUser(s?.user || null));
  } catch (e) {
    console.warn('[planner] auth unavailable, staying local:', e);
  }
}

function setUser(user) {
  const wasAnon = !currentUser;
  currentUser = user || null;
  store.setScope(user ? user.id : 'anon');
  if (user && wasAnon) toast(`${t('loggedAs')}: ${user.email}`, 'ok');
}

export const getUser = () => currentUser;

export function loginDialog() {
  const lang = getLang();
  const email = el('input', { type: 'email', dir: 'ltr', placeholder: 'name@example.com' });
  const pass = el('input', { type: 'password', dir: 'ltr', placeholder: '••••••••' });
  const err = el('p', { class: 'fieldmsg' });
  const body = el('div', { class: 'form-grid' },
    el('label', {}, t('email'), email),
    el('label', {}, t('password'), pass),
    err,
    el('button', {
      class: 'btn g', type: 'button', onclick: async () => {
        try { const auth = await getAuth(); await auth.google(); } catch (e) { err.textContent = e.message; }
      }
    }, t('googleLogin'))
  );
  modal(t('login'), body, async () => {
    err.textContent = '';
    if (!email.value || !pass.value) { err.textContent = lang === 'ar' ? 'أدخل البريد وكلمة المرور' : 'Email & password required'; return false; }
    try {
      const auth = await getAuth();
      await auth.login(email.value.trim(), pass.value);
    } catch (e) {
      err.textContent = lang === 'ar' ? 'بيانات الدخول غير صحيحة أو الحساب غير مفعّل' : (e.message || 'Login failed');
      return false;
    }
  }, { okLabel: t('login') });
}

export async function logout() {
  try { const auth = await getAuth(); await auth.logout(); } catch { /* local mode */ }
  store.setScope('anon');
}
