const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- 공통 도우미 ---------- */
const Cap0 = window.Capacitor;
const isNative = !!(Cap0 && Cap0.isNativePlatform && Cap0.isNativePlatform());
const plug = name => isNative ? ((Cap0.Plugins && Cap0.Plugins[name]) || (Cap0.registerPlugin && Cap0.registerPlugin(name))) : null;
let toastT;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800);
}
function copyText(text, okMsg) {
  const done = () => toast(okMsg || '복사했어요');
  const fallback = () => {
    const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('복사에 실패했어요'); }
    t.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}
const isComposing = e => e.isComposing || e.keyCode === 229;   // 한글 조합 중 Enter 무시용

/* ---------- 테마 ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $('themeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
  store.set('theme', t);
}
setTheme(store.get('theme', 'dark'));
$('themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

/* ---------- 탭 ---------- */
const tabs = [...document.querySelectorAll('#tabs button')];
function showTab(id) {
  tabs.forEach(b => b.classList.toggle('on', b.dataset.t === id));
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('on', s.id === id));
  store.set('lastTab', id);
  document.dispatchEvent(new CustomEvent('tabchange', { detail: id }));
}
tabs.forEach(b => b.onclick = () => showTab(b.dataset.t));
$('fsBtn').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
};

/* ---------- 소리 ---------- */
let actx = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
document.addEventListener('pointerdown', () => audio(), { once: true });
/* 설정 (소리 · 음량 · 자동 멈춤) */
const settings = Object.assign({ sound: 'beep', vol: 80, autoStop: 60 }, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);
const V = () => settings.vol / 100;

function tone(f, dur, when = 0, o = {}) {
  const a = audio(), osc = a.createOscillator(), g = a.createGain(), t = a.currentTime + when;
  const vol = (o.vol ?? .45) * V();
  osc.type = o.type || 'triangle'; osc.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01);
  if (o.decay) g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  else { g.gain.setValueAtTime(vol, t + dur - .03); g.gain.linearRampToValueAtTime(0, t + dur); }
  osc.connect(g).connect(a.destination); osc.start(t); osc.stop(t + dur + .02);
}
const beep = (f = 880, dur = .18, when = 0, vol = .45) => tone(f, dur, when, { vol });
const bell = (f, w) => [[1,.45],[2.76,.18],[5.4,.08]].forEach(([m, v]) => tone(f*m, 1.8, w, { type:'sine', vol:v, decay:true }));
const SOUNDS = {
  beep: { name: '삐삐삐', every: 1500, play: () => { tone(988,.15,0,{type:'square',vol:.25}); tone(988,.15,.22,{type:'square',vol:.25}); tone(988,.15,.44,{type:'square',vol:.25}); tone(1319,.32,.66); } },
  bell: { name: '종소리', every: 2000, play: () => { bell(880, 0); bell(659, .55); } },
  xylo: { name: '실로폰', every: 1600, play: () => [1047,1319,1568,2093].forEach((f,i) => tone(f,.45,i*.14,{type:'sine',decay:true})) },
  soft: { name: '부드러운 차임', every: 2200, play: () => { tone(660,.7,0,{type:'sine',vol:.4,decay:true}); tone(880,.9,.45,{type:'sine',vol:.4,decay:true}); } }
};

let ringTimer = null, ringStop = null;
function startRing(msg) {
  $('ringMsg').textContent = msg;
  $('ringAuto').textContent = settings.autoStop ? ` · ${settings.autoStop >= 60 ? settings.autoStop / 60 + '분' : settings.autoStop + '초'} 뒤 자동으로 멈춰요` : '';
  $('ring').classList.add('on');
  const s = SOUNDS[settings.sound] || SOUNDS.beep;
  s.play(); clearInterval(ringTimer); ringTimer = setInterval(s.play, s.every);
  clearTimeout(ringStop);
  if (settings.autoStop) ringStop = setTimeout(stopRing, settings.autoStop * 1000);   // 자동 멈춤
}
function stopRing() { clearInterval(ringTimer); clearTimeout(ringStop); ringTimer = ringStop = null; $('ring').classList.remove('on'); }
$('ring').onclick = stopRing;
$('ringStop').onclick = e => { e.stopPropagation(); stopRing(); };

/* ---------- 시계 + 세계시각 ---------- */
const CITIES = [
  ['서울','Asia/Seoul'], ['도쿄','Asia/Tokyo'], ['베이징','Asia/Shanghai'], ['뉴델리','Asia/Kolkata'],
  ['런던','Europe/London'], ['파리','Europe/Paris'], ['뉴욕','America/New_York'], ['시드니','Australia/Sydney']
];
const DAYS = ['일','월','화','수','목','금','토'];
const fmtCache = {};
function partsIn(tz, d) {
  const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, year:'numeric', month:'numeric',
    day:'numeric', hour:'numeric', minute:'numeric', hourCycle:'h23' }));
  const o = {}; f.formatToParts(d).forEach(p => o[p.type] = p.value);
  return { y:+o.year, mo:+o.month, d:+o.day, h:+o.hour % 24, m:+o.minute };
}
$('world').innerHTML = CITIES.map((c,i) =>
  `<div class="city glass" id="city${i}"><div><div class="n">${c[0]}</div><div class="d"></div></div><div class="t num"></div></div>`).join('');
const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
function tickClock() {
  const now = new Date(), h = now.getHours();
  $('cDate').textContent = `${now.getMonth()+1}월 ${now.getDate()}일 ${DAYS[now.getDay()]}요일`;
  $('cTime').innerHTML = `<span class="ampm">${h < 12 ? '오전' : '오후'}</span>${h % 12 || 12}:${pad(now.getMinutes())}<span class="sub">:${pad(now.getSeconds())}</span>`;
  const here = partsIn(localTZ, now), hereDay = Date.UTC(here.y, here.mo-1, here.d);
  CITIES.forEach((c,i) => {
    const p = partsIn(c[1], now), el = $('city'+i);
    const diff = Math.round((Date.UTC(p.y, p.mo-1, p.d) - hereDay) / 864e5);
    el.querySelector('.t').textContent = `${pad(p.h)}:${pad(p.m)}`;
    el.querySelector('.d').textContent = `${p.h >= 6 && p.h < 18 ? '☀️' : '🌙'} ${diff === 0 ? '오늘' : diff > 0 ? '내일' : '어제'}`;
  });
  checkAlarms(now);
}

/* ---------- 스톱워치 ---------- */
let swRun = false, swBase = 0, swAcc = 0, laps = [];
const swNow = () => swAcc + (swRun ? performance.now() - swBase : 0);
function fmtSW(ms) {
  const t = Math.floor(ms / 10), cs = t % 100, s = Math.floor(t / 100) % 60, m = Math.floor(t / 6000) % 60, h = Math.floor(t / 360000);
  return `${h ? h + ':' + pad(m) : pad(m)}:${pad(s)}<span class="sub">.${pad(cs)}</span>`;
}
const drawSW = () => $('swDisp').innerHTML = fmtSW(swNow());
function setSwBtn() {
  $('swStart').textContent = swRun ? '멈춤' : (swNow() ? '계속' : '시작');
  $('swStart').className = 'btn ' + (swRun ? 'pause' : 'primary');
}
$('swStart').onclick = () => {
  if (swRun) { swAcc += performance.now() - swBase; swRun = false; } else { swBase = performance.now(); swRun = true; }
  setSwBtn();
};
$('swLap').onclick = () => { const t = swNow(); if (t) { laps.unshift(t); drawLaps(); } };
$('swReset').onclick = () => { swRun = false; swAcc = 0; laps = []; drawLaps(); drawSW(); setSwBtn(); };
function drawLaps() {
  $('laps').innerHTML = laps.map((t,i) => `<div class="lap glass"><b>${laps.length - i}</b><span class="num">${fmtSW(t)}</span></div>`).join('');
}

/* ---------- 타이머 ---------- */
let tmSet = 300, tmLeft = 300, tmRun = false, tmEnd = 0, lastBeep = -1;
const tmWheel = makeWheels($('tmWheel'), [{ n: 10, label: '시간' }, { n: 60, label: '분' }, { n: 60, label: '초' }], v => {
  const t = Math.min(10 * 3600 - 1, v[0] * 3600 + v[1] * 60 + v[2]);
  tmLeft = tmSet = t; tmRun = false;
  document.querySelectorAll('#tmPre .pill').forEach(x => x.classList.toggle('sel', +x.dataset.set === t));
  setTmUI(); drawTM();
});
const tmRemaining = () => tmRun ? Math.max(0, (tmEnd - Date.now()) / 1000) : tmLeft;
function fmtTM(sec) {
  sec = Math.ceil(sec);
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s);
}
function drawTM() {
  const r = tmRemaining(), state = r > 0 && r <= 10 ? 'last' : r > 10 && r <= 60 ? 'warn' : '';
  $('tmDisp').textContent = fmtTM(r);
  $('tmDisp').className = 'big num ' + state + (tmRun ? '' : ' editable');
  $('tmBarWrap').className = 'bar ' + state;
  $('tmBar').style.width = (tmSet ? Math.min(100, r / tmSet * 100) : 0) + '%';
  if (tmRun) {
    const c = Math.ceil(r);
    if (c <= 5 && c > 0 && c !== lastBeep) { lastBeep = c; beep(660, .12, 0, .3); }
    if (r <= 0) { tmRun = false; tmLeft = 0; setTmUI(); startRing('시간 끝!'); }
  }
}
function setTmUI() {
  $('tmStart').textContent = tmRun ? '일시정지' : (tmLeft > 0 && tmLeft < tmSet ? '계속' : '시작');
  $('tmStart').className = 'btn ' + (tmRun ? 'pause' : 'primary');
  $('tmPre').classList.toggle('hide', tmRun);
  const idle = !tmRun && (tmLeft <= 0 || tmLeft >= tmSet);   // 멈춰 있고 아직 시작 전이면 휠로 맞추기
  $('timer').classList.toggle('idle', idle);
  if (idle) { const t = Math.round(tmLeft > 0 ? tmLeft : tmSet); tmWheel.set([Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60]); }
  $('tmCap').textContent = tmRun ? '진행 중 · 시간을 더하거나 뺄 수 있어요' : idle ? '휠을 돌려 시간을 맞추세요 (컴퓨터는 마우스 휠)' : '숫자를 누르면 시간을 직접 입력할 수 있어요';
  $('tmDisp').classList.toggle('editable', !tmRun);
}
$('tmStart').onclick = () => {
  audio();
  if (tmRun) { tmLeft = tmRemaining(); tmRun = false; }
  else {
    if (tmLeft <= 0) tmLeft = tmSet;
    if (tmLeft <= 0) return;
    tmEnd = Date.now() + tmLeft * 1000; tmRun = true; lastBeep = -1;
  }
  setTmUI(); drawTM();
};
$('tmReset').onclick = () => { tmRun = false; tmLeft = tmSet; setTmUI(); drawTM(); };
document.querySelectorAll('#tmPre .pill').forEach(b => b.onclick = () => {
  document.querySelectorAll('#tmPre .pill').forEach(x => x.classList.toggle('sel', x === b));
  tmSet = tmLeft = +b.dataset.set; setTmUI(); drawTM();
});
const MAX = 10 * 3600 - 1;
document.querySelectorAll('#tmAdj .pill').forEach(b => b.onclick = () => {
  const add = +b.dataset.add;
  document.querySelectorAll('#tmPre .pill').forEach(x => x.classList.remove('sel'));
  if (tmRun) {
    // 진행 중: 남은 시간만 조절 (최소 1초 남김)
    const r = Math.min(MAX, Math.max(1, tmRemaining() + add));
    tmEnd = Date.now() + r * 1000;
    if (r > tmSet) tmSet = Math.ceil(r);
    if (Math.ceil(r) > 5) lastBeep = -1;
  } else {
    tmLeft = Math.min(MAX, Math.max(0, Math.round(tmLeft) + add));
    tmSet = tmLeft;
  }
  setTmUI(); drawTM();
});

/* ---------- 타이머 직접 입력 (숫자판) ---------- */
let padBuf = '';
const padOpen = () => $('pad').classList.contains('on');
function padParse() {
  const d = padBuf.padStart(4, '0');
  return { m: +d.slice(0, 2), s: +d.slice(2) };
}
function padDraw() {
  const d = padBuf.padStart(4, '0'), lead = 4 - padBuf.length;   // 아직 안 친 자리는 흐리게
  const ch = [...d].map((c, i) => i < lead ? `<span class="dim">${c}</span>` : c);
  $('padShow').innerHTML = ch.slice(0, 2).join('') + (lead > 2 ? '<span class="dim">:</span>' : ':') + ch.slice(2).join('');
}
function padKey(k) {
  if (k === 'del') padBuf = padBuf.slice(0, -1);
  else if (padBuf.length < 4) padBuf = (padBuf + k).replace(/^0+/, '').slice(0, 4);
  padDraw();
}
function openPad() {
  if (tmRun || document.body.classList.contains('mini')) return;
  padBuf = ''; padDraw(); $('pad').classList.add('on');
}
function closePad(ok) {
  if (ok && padBuf) {
    const { m, s } = padParse();
    const total = Math.min(MAX, m * 60 + s);        // 90초처럼 넣어도 1:30으로 맞춰짐
    if (total > 0) {
      tmSet = tmLeft = total;
      document.querySelectorAll('#tmPre .pill').forEach(x => x.classList.toggle('sel', +x.dataset.set === total));
      setTmUI(); drawTM();
    }
  }
  $('pad').classList.remove('on');
}
$('tmDisp').onclick = openPad;
$('keys').querySelectorAll('button').forEach(b => b.onclick = () => padKey(b.dataset.k || b.textContent));
$('padOk').onclick = () => closePad(true);
$('padCancel').onclick = () => closePad(false);
$('pad').onclick = e => { if (e.target.id === 'pad') closePad(false); };

/* ---------- 설정 창 ---------- */
const setOpen = () => $('settings').classList.contains('on');
function drawSettings() {
  $('sndList').innerHTML = Object.entries(SOUNDS).map(([k, s]) =>
    `<div class="snd ${settings.sound === k ? 'sel' : ''}" data-snd="${k}"><span>${s.name}</span><button class="play" data-play="${k}" title="미리 듣기">▶</button></div>`).join('');
  $('sndList').querySelectorAll('[data-snd]').forEach(el => el.onclick = e => {
    settings.sound = el.dataset.snd; saveSettings(); drawSettings();
    if (!e.target.closest('[data-play]')) SOUNDS[settings.sound].play();
  });
  $('sndList').querySelectorAll('[data-play]').forEach(b => b.onclick = e => { e.stopPropagation(); audio(); SOUNDS[b.dataset.play].play(); });
  $('vol').value = settings.vol; $('volVal').textContent = settings.vol + '%';
  document.querySelectorAll('#autoStop .pill').forEach(b => b.classList.toggle('sel', +b.dataset.s === settings.autoStop));
  $('setNote').textContent = LN
    ? '앱을 내리거나 꺼도 알람·타이머가 휴대폰 알림으로 울려요. 이때 음량은 휴대폰 알림 음량을 따라요.'
    : '';
}
$('vol').oninput = () => { settings.vol = +$('vol').value; $('volVal').textContent = settings.vol + '%'; saveSettings(); };
$('vol').onchange = () => SOUNDS[settings.sound].play();
document.querySelectorAll('#autoStop .pill').forEach(b => b.onclick = () => { settings.autoStop = +b.dataset.s; saveSettings(); drawSettings(); });
$('setBtn').onclick = () => { audio(); drawSettings(); $('settings').classList.add('on'); };
$('setClose').onclick = () => $('settings').classList.remove('on');
$('settings').onclick = e => { if (e.target.id === 'settings') $('settings').classList.remove('on'); };

/* ---------- 휴대폰(apk): 앱을 내려도 울리는 알림 ---------- */
const LN = plug('LocalNotifications');
async function nativeInit() {
  if (!LN) return;
  try {
    const p = await LN.checkPermissions();
    if (p.display !== 'granted') await LN.requestPermissions();
    for (const [k, s] of Object.entries(SOUNDS)) {
      await LN.createChannel({ id: 'alarm-' + k, name: '알람 · ' + s.name, importance: 5, visibility: 1,
                               sound: 'snd_' + k + '.wav', vibration: true, lights: true });
    }
  } catch (e) { console.warn(e); }
}
async function nativeCancel() {
  if (!LN) return;
  try {
    const p = await LN.getPending();
    if (p.notifications.length) await LN.cancel({ notifications: p.notifications.map(n => ({ id: n.id })) });
  } catch (e) {}
}
async function nativeSchedule() {    // 앱이 화면에서 사라질 때 예약
  if (!LN) return;
  try {
    await nativeCancel();
    const ch = 'alarm-' + settings.sound, list = [];
    alarms.filter(a => a.on).forEach((a, i) => list.push({
      id: 100 + i, title: '⏰ 우리반 도구함', body: a.memo || `${a.h < 12 ? '오전' : '오후'} ${a.h % 12 || 12}:${pad(a.m)} 알람`,
      channelId: ch, smallIcon: 'ic_stat_timer', iconColor: '#5b5bf0',
      schedule: { on: { hour: a.h, minute: a.m }, allowWhileIdle: true }
    }));
    if (tmRun && tmEnd > Date.now() + 1000) list.push({
      id: 1, title: '⏳ 시간 끝!', body: '타이머가 끝났어요', channelId: ch, smallIcon: 'ic_stat_timer', iconColor: '#5b5bf0',
      schedule: { at: new Date(tmEnd), allowWhileIdle: true }
    });
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) { console.warn(e); }
}
// 화면에 보일 땐 앱이 직접 울리고, 내려가면 휴대폰 알림에 맡김 (두 번 울리지 않게)
document.addEventListener('visibilitychange', () => { document.hidden ? nativeSchedule() : nativeCancel(); });
nativeInit();

/* ---------- 알람 ---------- */
let aH = 9, aM = 0, alarms = store.get('classAlarms', []);
const saveAlarms = () => store.set('classAlarms', alarms);
const drawSet = () => { $('aPreview').textContent = `${aH < 12 ? '오전' : '오후'} ${aH % 12 || 12}시 ${pad(aM)}분 · 휠을 돌려 맞추세요`; };
const aWheel = makeWheels($('aWheel'), [{ n: 24, label: '시', pad: true }, { n: 60, label: '분', pad: true }], v => { aH = v[0]; aM = v[1]; drawSet(); });
aWheel.set([aH, aM]); drawSet();
$('aAdd').onclick = () => {
  alarms.push({ id: Date.now(), h: aH, m: aM, memo: $('aMemo').value.trim(), on: true, last: '' });
  alarms.sort((a,b) => (a.h*60+a.m) - (b.h*60+b.m));
  $('aMemo').value = ''; saveAlarms(); drawAlarms(); audio();
};
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function drawAlarms() {
  $('aList').innerHTML = alarms.length ? alarms.map(a => `
    <div class="al glass ${a.on ? '' : 'off'}">
      <span class="t num"><small>${a.h < 12 ? '오전' : '오후'}</small>${a.h % 12 || 12}:${pad(a.m)}</span>
      <span class="m">${esc(a.memo || '')}</span>
      <button class="switch ${a.on ? 'on' : ''}" data-tog="${a.id}" title="켜기/끄기"></button>
      <button class="del" data-del="${a.id}" title="삭제">✕</button>
    </div>`).join('') : '<div class="empty">아직 알람이 없어요</div>';
  $('aList').querySelectorAll('[data-tog]').forEach(b => b.onclick = () => {
    const a = alarms.find(x => x.id == b.dataset.tog); a.on = !a.on; saveAlarms(); drawAlarms(); });
  $('aList').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    alarms = alarms.filter(x => x.id != b.dataset.del); saveAlarms(); drawAlarms(); });
}
function checkAlarms(now) {
  const key = `${now.toDateString()} ${now.getHours()}:${now.getMinutes()}`;
  alarms.forEach(a => {
    if (a.on && a.h === now.getHours() && a.m === now.getMinutes() && a.last !== key) {
      a.last = key; saveAlarms(); startRing(a.memo || `${a.h % 12 || 12}:${pad(a.m)} 알람`);
    }
  });
}

/* ---------- PC 앱: 창 버튼 · 작은 창 ---------- */
const api = window.winApi;
let mini = false;
function setMini(on) {
  if (!api) return;
  mini = on;
  if (on && !['clock', 'stopwatch', 'timer'].includes(document.querySelector('main section.on').id)) showTab('clock');
  document.body.classList.toggle('mini', on);
  api.mini(on);
}
if (api) {
  document.body.classList.add('app');
  $('wMin').onclick = () => api.minimize();
  $('wMax').onclick = () => api.maximize();
  $('wClose').onclick = () => api.close();
  $('miniBtn').onclick = () => setMini(true);
  $('miniExit').onclick = () => setMini(false);
  document.addEventListener('dblclick', e => { if (mini && !e.target.closest('button')) setMini(false); });
}

/* ---------- 키보드 ---------- */
document.addEventListener('keydown', e => {
  const tg = (e.composedPath && e.composedPath()[0]) || e.target;   // 구슬 탭(Shadow DOM) 안의 입력칸도 인식
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return;
  if (setOpen()) { if (e.key === 'Escape') $('settings').classList.remove('on'); return; }
  if (padOpen()) {
    e.preventDefault();
    if (/^[0-9]$/.test(e.key)) padKey(e.key);
    else if (e.key === 'Backspace') padKey('del');
    else if (e.key === 'Enter') closePad(true);
    else if (e.key === 'Escape') closePad(false);
    return;
  }
  if ($('ring').classList.contains('on')) { stopRing(); e.preventDefault(); return; }
  const cur = document.querySelector('main section.on').id, k = e.key.toLowerCase();
  if (e.code === 'Space') { e.preventDefault(); if (cur === 'stopwatch') $('swStart').click(); if (cur === 'timer') $('tmStart').click(); }
  if (k === 'r') { if (cur === 'stopwatch') $('swReset').click(); if (cur === 'timer') $('tmReset').click(); }
  if (k === 'l' && cur === 'stopwatch') $('swLap').click();
  if (k === 't') $('themeBtn').click();
  if (k === 'm') setMini(!mini);
  if (cur === 'timer' && (e.key === 'Enter' || k === 'e') && !tmRun) { e.preventDefault(); openPad(); return; }
  if (cur === 'timer' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault(); document.querySelector(`#tmAdj [data-add="${e.key === 'ArrowUp' ? 60 : -60}"]`).click();
  }
  const n = ['1','2','3','4','5','6','7'].indexOf(e.key);
  if (n >= 0 && !(mini && n >= 3)) tabs[n].click();
});

/* ---------- 웹 버전: 화면 꺼짐 방지 · 오프라인 ---------- */
let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !document.hidden) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
document.addEventListener('pointerdown', keepAwake, { once: true });
keepAwake();
if ('serviceWorker' in navigator && location.protocol === 'https:' && !isNative) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------- 루프 ---------- */
drawSet(); drawAlarms(); drawTM(); drawSW(); setSwBtn(); setTmUI(); tickClock();
{ const t = store.get('lastTab', 'clock'); if (tabs.some(b => b.dataset.t === t)) showTab(t); }
setInterval(tickClock, 250);
setInterval(() => { if (tmRun) drawTM(); }, 200);
(function loop() { if (swRun) drawSW(); requestAnimationFrame(loop); })();
