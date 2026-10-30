// iLogia Planner — utilities: dates, formatting, DOM helpers, modal, toast
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children.flat(9)) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(c));
  }
  return n;
}

export const ms = (name, cls = '') => `<span class="ms ${cls}">${name}</span>`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- dates (week starts Saturday) ----------
export const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5]; // JS getDay(): 0=Sun … we show Sat..Fri
export function dayIndex(jsDay) { return DAY_ORDER.indexOf(jsDay); } // 0=Sat … 6=Fri
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return todayISO(d); }
export function weekStartISO(d = new Date()) { // Saturday
  const off = DAY_ORDER.indexOf(d.getDay());
  const s = new Date(d); s.setDate(s.getDate() - off);
  return todayISO(s);
}
export function daysBetween(aISO, bISO) { return Math.round((parseISO(bISO) - parseISO(aISO)) / 864e5); }

export const AR_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
export const EN_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso, lang = 'ar', withYear = false) {
  const d = parseISO(iso);
  const months = lang === 'ar' ? AR_MONTHS : EN_MONTHS;
  return `${d.getDate()} ${months[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}
export function fmtTime(mins) { // minutes from midnight -> "08:30"
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function parseTime(str) { const [h, m] = str.split(':').map(Number); return h * 60 + m; }
export function fmtDur(mins, lang = 'ar') {
  if (mins < 60) return lang === 'ar' ? `${mins} د` : `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? (lang === 'ar' ? `${h} س ${m} د` : `${h}h ${m}m`) : (lang === 'ar' ? `${h} س` : `${h}h`);
}
export function fmtClock(totalSec) {
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

// ---------- toast ----------
let toastHost;
export function toast(msg, kind = '') {
  if (!toastHost) { toastHost = el('div', { class: 'toasts' }); document.body.append(toastHost); }
  const t = el('div', { class: `toast ${kind}` }, msg);
  toastHost.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 2600);
}

// ---------- modal ----------
export function modal(title, bodyNode, onSubmit, opts = {}) {
  const wrap = el('div', { class: 'modal-wrap' });
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const m = el('div', { class: 'modal' },
    el('h3', {}, title),
    bodyNode,
    el('div', { class: 'acts' },
      onSubmit ? el('button', {
        class: 'btn', onclick: () => { const r = onSubmit(); if (r !== false) close(); }
      }, opts.okLabel || (document.documentElement.lang === 'ar' ? 'حفظ' : 'Save')) : null,
      el('button', { class: 'btn g', onclick: close }, opts.cancelLabel || (document.documentElement.lang === 'ar' ? 'إلغاء' : 'Cancel')),
      opts.extraBtn || null
    )
  );
  wrap.append(m);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.body.append(wrap);
  const first = m.querySelector('input,select,textarea'); if (first) setTimeout(() => first.focus(), 30);
  return close;
}

export function confirmBox(msg, onYes, lang = 'ar') {
  modal(lang === 'ar' ? 'تأكيد' : 'Confirm', el('p', {}, msg), () => { onYes(); }, {
    okLabel: lang === 'ar' ? 'نعم، احذف' : 'Yes, delete'
  });
}

export const SUBJECT_COLORS = ['#136F58', '#D4AF37', '#82C341', '#E5A93C', '#4A7FB5', '#9A7B1C', '#7A5C8E', '#C23B3B'];
