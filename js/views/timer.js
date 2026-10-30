// iLogia Planner — Study timer (Pomodoro). Timing is timestamp-based, so background tabs and
// page reloads don't corrupt elapsed time; interval is display-only.
import { el, ms, fmtClock, fmtDur, fmtDate, toast, modal, uid } from '../utils.js';
import { t, getLang } from '../i18n.js';
import { store } from '../store.js';

const TKEY = 'ilp.timer';
let tickHandle = null;

function loadTimer() { try { return JSON.parse(localStorage.getItem(TKEY)); } catch { return null; } }
function saveTimer(o) { o ? localStorage.setItem(TKEY, JSON.stringify(o)) : localStorage.removeItem(TKEY); }

// state: {phase:'focus'|'break', startedAt:epochMs, durationSec, accumulatedSec, running:bool, cycle, subjectId}
function remaining(ts) {
  if (!ts) return 0;
  const elapsed = ts.accumulatedSec + (ts.running ? (Date.now() - ts.startedAt) / 1000 : 0);
  return Math.max(0, Math.round(ts.durationSec - elapsed));
}

export function renderTimer(root) {
  const lang = getLang();
  const pom = store.settings.pomodoro;
  let ts = loadTimer();

  const subjSel = el('select', { style: 'max-width:240px' });
  subjSel.append(el('option', { value: '' }, '—'));
  for (const s of store.state.subjects) subjSel.append(el('option', { value: s.id }, s.name));
  if (ts?.subjectId) subjSel.value = ts.subjectId;

  const timeLbl = el('div', { class: 't' }, '00:00');
  const phaseLbl = el('div', { class: 's' }, '');
  const phaseChip = el('span', { class: 'phase-chip focus' }, t('focus'));
  const cycleLbl = el('span', { class: 'badge' }, '');
  const ringFg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 260 260');
  const R = 118, C = 2 * Math.PI * R;
  const mk = (attrs) => { const c = document.createElementNS(NS, 'circle'); for (const [k, v] of Object.entries(attrs)) c.setAttribute(k, v); return c; };
  const bg = mk({ cx: 130, cy: 130, r: R, fill: 'none', stroke: 'var(--cream)', 'stroke-width': 12 });
  const fg = mk({ cx: 130, cy: 130, r: R, fill: 'none', stroke: 'var(--primary-c)', 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-dasharray': `${C}`, 'stroke-dashoffset': '0' });
  svg.append(bg, fg);

  const btnMain = el('button', { class: 'btn', style: 'min-width:160px' }, t('startTimer'));
  const btnPause = el('button', { class: 'btn g' }, t('pause'));
  const btnFinish = el('button', { class: 'btn gold' }, t('finish'));

  const notif = () => {
    if (store.settings.notif && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(t('appName'), { body: t('timerEnded') });
    } else toast(t('timerEnded'), 'ok');
    try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play().catch(() => {}); } catch {}
  };

  function newTimer(phase, cycle, subjectId) {
    const dur = (phase === 'focus' ? pom.focus : pom.break) * 60;
    return { phase, cycle, subjectId: subjectId || null, durationSec: dur, startedAt: Date.now(), accumulatedSec: 0, running: true, completedFocusSec: 0 };
  }

  function paint() {
    const rem = remaining(ts);
    timeLbl.textContent = ts ? fmtClock(rem) : fmtClock(pom.focus * 60);
    if (!ts) {
      phaseChip.textContent = t('focus'); phaseChip.className = 'phase-chip focus';
      cycleLbl.textContent = `${t('cycleOf')} 1/${pom.cycles}`;
      fg.setAttribute('stroke-dashoffset', '0');
      btnMain.textContent = t('startTimer'); btnPause.disabled = true; btnFinish.disabled = true;
      return;
    }
    const frac = ts.durationSec ? rem / ts.durationSec : 0;
    fg.setAttribute('stroke-dashoffset', String(C * (1 - frac)));
    fg.setAttribute('stroke', ts.phase === 'focus' ? 'var(--primary-c)' : 'var(--gold)');
    phaseChip.textContent = ts.phase === 'focus' ? t('focus') : t('break_');
    phaseChip.className = 'phase-chip ' + (ts.phase === 'focus' ? 'focus' : 'brk');
    phaseLbl.textContent = ts.running ? t('timerRunning') : t('pause');
    cycleLbl.textContent = `${t('cycleOf')} ${ts.cycle}/${pom.cycles}`;
    btnMain.textContent = ts.running ? t('pause') : t('resume');
    btnPause.disabled = false; btnFinish.disabled = ts.phase !== 'focus' && !(ts.completedFocusSec > 0);
  }

  function phaseDone() {
    if (!ts) return;
    if (ts.phase === 'focus') {
      ts.completedFocusSec = (ts.completedFocusSec || 0) + ts.durationSec;
      // log focus time
      store.addLog({ subjectId: ts.subjectId || subjSel.value || null, minutes: Math.round(ts.durationSec / 60), source: 'timer' });
      notif();
      if (ts.cycle < pom.cycles) { ts = newTimer('break', ts.cycle, ts.subjectId); }
      else { finishSession(true); return; }
    } else {
      notif();
      ts = newTimer('focus', ts.cycle + 1, ts.subjectId);
    }
    saveTimer(ts); paint();
  }

  function finishSession(completedAll = false) {
    if (!ts) return;
    const focusSec = (ts.completedFocusSec || 0) + (ts.phase === 'focus' ? Math.min(ts.durationSec, ts.durationSec - remaining(ts)) : 0);
    const mins = Math.max(0, Math.round(focusSec / 60));
    if (ts.phase === 'focus' && focusSec > 0 && !completedAll) {
      store.addLog({ subjectId: ts.subjectId || subjSel.value || null, minutes: Math.max(1, Math.round(focusSec / 60)), source: 'timer' });
    }
    const subjName = store.subjectName(ts.subjectId || subjSel.value);
    ts = null; saveTimer(null); paint(); paintLogs();
    modal(t('sessionDone'), el('div', { class: 'form-grid', style: 'text-align:center' },
      el('div', { html: ms('check_circle', 'f'), style: 'font-size:48px;color:var(--primary-c)' }),
      el('p', {}, `${t('studiedFor')}:`),
      el('b', { style: 'font:700 1.6rem var(--serif)' }, fmtDur(mins, lang)),
      el('p', { style: 'color:var(--mut)' }, subjName || '')
    ), null, {});
    toast(t('sessionLogged'), 'ok');
  }

  function tick() {
    if (!ts) return;
    paint();
    if (remaining(ts) <= 0) phaseDone();
  }

  btnMain.onclick = () => {
    if (!ts) { ts = newTimer('focus', 1, subjSel.value || null); saveTimer(ts); paint(); return; }
    if (ts.running) { ts.accumulatedSec += (Date.now() - ts.startedAt) / 1000; ts.running = false; }
    else { ts.startedAt = Date.now(); ts.running = true; }
    saveTimer(ts); paint();
  };
  btnPause.onclick = btnMain.onclick; // same toggle (kept for muscle memory)
  btnFinish.onclick = () => finishSession(false);
  subjSel.addEventListener('change', () => { if (ts) { ts.subjectId = subjSel.value || null; saveTimer(ts); } });

  // recent logs
  const logsWrap = el('div', { class: 'panel' }, el('h3', { html: ms('history') }, lang === 'ar' ? 'سجل الجلسات الأخيرة' : 'Recent sessions'));
  function paintLogs() {
    logsWrap.querySelectorAll('.logline,.empty').forEach(n => n.remove());
    const logs = [...store.state.logs].filter(l => l.minutes > 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    if (!logs.length) logsWrap.append(el('div', { class: 'empty' }, el('span', { class: 'ms' }, 'timer'), el('div', {}, t('emptyLogs'))));
    for (const l of logs) {
      logsWrap.append(el('div', { class: 'logline' },
        el('span', { class: 'dot', style: `background:${store.subjectColor(l.subjectId)}` }),
        el('span', { style: 'flex:1' }, store.subjectName(l.subjectId)),
        el('span', { class: 'badge' }, fmtDur(l.minutes, lang)),
        el('span', { style: 'color:var(--mut);font-size:12px' }, fmtDate(l.date, lang))));
    }
  }
  paintLogs();

  root.append(
    el('div', { class: 'panel timer-stage' },
      el('div', { class: 'row' }, phaseChip, cycleLbl),
      el('div', { class: 'ring' }, svg, el('div', { class: 'lbl' }, el('div', {}, timeLbl, phaseLbl))),
      el('div', { class: 'row' }, el('label', { style: 'display:flex;gap:8px;align-items:center' }, t('subject'), subjSel)),
      el('div', { class: 'row' }, btnMain, btnFinish),
      el('p', { style: 'color:var(--mut);font-size:12px;text-align:center;max-width:420px' },
        lang === 'ar'
          ? `Pomodoro: ${pom.focus} دقيقة تركيز / ${pom.break} دقيقة استراحة × ${pom.cycles} دورات. الوقت يُحسب من ختم زمني — يعمل حتى لو غادرت الصفحة.`
          : `Pomodoro: ${pom.focus}m focus / ${pom.break}m break × ${pom.cycles}. Time is timestamp-based — accurate even if you leave the page.`)),
    el('div', { style: 'height:16px' }),
    logsWrap
  );

  paint();
  tickHandle = setInterval(tick, 500);
}

export function stopTimerView() {
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
}
