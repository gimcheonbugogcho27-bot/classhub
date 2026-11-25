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
function stopRing() { if (typeof tmTransRing !== 'undefined') tmTransRing = false; if (typeof tmGapEnd !== 'undefined' && tmGapEnd) tmGapEnd = 1;   // 반복 알림 중 누르면 바로 다음 회차
  clearInterval(ringTimer); clearTimeout(ringStop); ringTimer = ringStop = null; $('ring').classList.remove('on'); }
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
/* 타이머 배경 음악: 진행 중에만 잔잔한 10분 곡을 무한 반복 */
let tmMusic = store.get('tmMusic', true), musFade = null;
function musVol() { return Math.max(0, Math.min(1, (settings.vol || 80) / 100)) * .5; }
function syncMusic() {
  const a = $('tmBgm'); if (!a) return;
  $('tmMus').textContent = tmMusic ? '🎹 피아노 켬' : '🎹 피아노 끔'; $('tmMus').classList.toggle('sel', tmMusic);
  const want = tmMusic && tmRun && !tmGapEnd;
  clearInterval(musFade);
  if (want) {
    if (a.paused) { a.volume = 0; a.play().catch(() => {}); }
    musFade = setInterval(() => { const v = musVol(); a.volume = Math.min(v, a.volume + .04); if (a.volume >= v) clearInterval(musFade); }, 60);
  } else if (!a.paused) {
    musFade = setInterval(() => { a.volume = Math.max(0, a.volume - .08); if (a.volume <= 0) { clearInterval(musFade); a.pause(); } }, 40);
  }
}
$('tmSong').value = store.get('tmSong', '1'); $('tmBgm').src = `audio/piano${$('tmSong').value}.mp3`;
$('tmSong').onchange = () => {
  store.set('tmSong', $('tmSong').value); const a = $('tmBgm'), was = !a.paused;
  clearInterval(musFade); a.pause(); a.src = `audio/piano${$('tmSong').value}.mp3`; a.currentTime = 0; if (was) { a.volume = 0; syncMusic(); }
};
$('tmMus').onclick = () => { tmMusic = !tmMusic; store.set('tmMusic', tmMusic); syncMusic(); };
const REP_GAP = 7000;   // 반복할 때 끝 소리가 나는 시간(ms)
let tmRepeat = store.get('tmRepeat', false), tmRounds = 0, tmGapEnd = 0, gapIv = null;
/* 안내 글씨: 시작할 때 / 시작하고 N분 뒤에 뜨는 글씨 */
const tmMsgs = Object.assign({ start: '', list: [], gap: 0, gapText: '', gapIncl: true }, store.get('tmMsgs', {}));
let tmFired = new Set(), tmMsgOn = store.get('tmMsgOn', true);
// 타이머 설정 시간과 같은 'N분 뒤' 글씨가 있으면 끝날 때 '시간 끝!' 대신 그 글씨를 띄운다
const endText = () => { if (!tmMsgOn) return ''; const x = tmMsgs.list.find(x => x.t && Math.round(x.m * 60) === Math.round(tmSet)); return x ? x.t : ''; };
if (!Array.isArray(tmMsgs.starts)) tmMsgs.starts = tmMsgs.start ? [{ t: tmMsgs.start, s: 5 }] : [];   // 예전 '시작 글씨 1개' → 목록으로
if (tmMsgs.startFull == null) tmMsgs.startFull = false;
const saveMsgs = () => store.set('tmMsgs', tmMsgs);
const startSeq = () => tmMsgs.starts.filter(x => x.t);
let tmStartIdx = -1;
// 시작 글씨: 목록 순서대로 각 N초씩(타이머 진행 시간 기준). 마지막 글씨는 다음 안내가 나올 때까지 남는다.
function startTick(el) {
  const q = startSeq(); if (!q.length || !tmMsgOn) return;
  let idx = 0, acc = 0, inFull = false;
  for (let i = 0; i < q.length - 1 && el >= acc + q[i].s; i++) { acc += q[i].s; idx = i + 1; }
  const ends = acc + q[idx].s;
  inFull = tmMsgs.startFull && el < ends && !tmFired.size;
  if (idx !== tmStartIdx && !tmFired.size) { tmStartIdx = idx; showMsg(q[idx].t, idx > 0); if (inFull) showTransRing(q[idx].t, Math.max(1, Math.ceil(ends - el)), true); }
  if (!inFull && tmTransRing && tmStartRing) { tmStartRing = false; hideTrans(); }
}
function showMsg(t, beepOn) {
  if (!tmMsgOn) t = '';
  const el = $('tmMsg'); el.textContent = t || ''; el.hidden = !t;
  if (t) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); if (beepOn) try { audio(); beep(880, .15, 0, .3); beep(1175, .2, .18, .3); } catch (e) {} }
}
let tmFreezeUntil = 0, tmFrozenMs = 0;
let tmPend = null, tmTransRing = false, tmStartRing = false;
function hideTrans() { if (!tmTransRing) return; tmTransRing = false; if (!ringTimer && !tmGapEnd) $('ring').classList.remove('on'); }
function showTransRing(text, sec, isStart) {     // 글씨 사이 전환: 시간 끝처럼 전체 화면으로
  if (ringTimer || tmGapEnd) return;     // 종료 알림이 이미 떠 있으면 건드리지 않음
  $('ringMsg').textContent = text; $('ringAuto').textContent = isStart ? '' : ` · ${sec}초 뒤 다음 글씨`; tmStartRing = !!isStart; $('ring').classList.add('on'); tmTransRing = true;
}   // 글씨 사이 '넘어가는 시간' 동안 기다리는 다음 글씨
function msgRoundStart() { tmFired = new Set(); tmPend = null; tmFreezeUntil = 0; hideTrans(); tmStartIdx = -1; tmStartRing = false; showMsg('', false); startTick(0); }
function msgTick(r) {
  const el = (tmSet - r), now = Date.now();
  startTick(el);
  if (tmPend && now >= tmPend.until) { hideTrans(); showMsg(tmPend.text, true); tmPend = null; }
  tmMsgs.list.forEach((x, i) => {
    if (!(tmMsgOn && x.t && Math.round(x.m * 60) < Math.round(tmSet) && !tmFired.has(i) && el >= x.m * 60)) return;
    tmFired.add(i);
    if (tmMsgs.gap > 0 && tmMsgs.gapText) {
      if (!tmMsgs.gapIncl) { tmFrozenMs = Math.max(0, tmEnd - now); tmFreezeUntil = now + tmMsgs.gap * 1000; }   // 전환 시간은 총 시간에서 빼고 멈춤
      showMsg(tmMsgs.gapText, true); showTransRing(tmMsgs.gapText, tmMsgs.gap); tmPend = { text: x.t, until: now + tmMsgs.gap * 1000 };   // 넘어가는 동안 전환 글씨
    }
    else { tmPend = null; showMsg(x.t, true); }
  });
}
function syncTotal() {
  if (!$('tmTotM') || document.activeElement === $('tmTotM') || document.activeElement === $('tmTotS')) return;
  $('tmTotM').value = Math.floor(tmSet / 60); $('tmTotS').value = Math.round(tmSet % 60);
  $('tmTotM').disabled = $('tmTotS').disabled = tmRun;
}
function setTotal() {
  if (tmRun) return;
  const t = Math.min(MAX, Math.max(1, Math.round((+$('tmTotM').value || 0) * 60 + (+$('tmTotS').value || 0))));
  clearGap(); tmSet = tmLeft = t; tmRounds = 0;
  document.querySelectorAll('#tmPre .pill').forEach(x => x.classList.toggle('sel', +x.dataset.set === t));
  setTmUI(); drawTM();
}
$('tmTotM').oninput = $('tmTotS').oninput = setTotal;
$('tmGap').oninput = e => { tmMsgs.gap = Math.max(0, Math.min(120, +e.target.value || 0)); saveMsgs(); };
$('tmGapIncl').onchange = e => { tmMsgs.gapIncl = e.target.checked; saveMsgs(); };
$('tmGapText').oninput = e => { tmMsgs.gapText = e.target.value; saveMsgs(); };
function renderMsgEditor() {
  $('tmStartList').innerHTML = tmMsgs.starts.map((x, i) =>
    `<div class="mrow"><input type="text" maxlength="40" value="${escH(x.t)}" placeholder="시작하면 뜨는 글씨" data-i="${i}" data-k="t"><input type="number" min="1" max="600" value="${x.s}" data-i="${i}" data-k="s" aria-label="몇 초 동안"><span>초</span><button class="pill minus" data-sdel="${i}">×</button></div>`).join('');
  $('tmStartFull').checked = !!tmMsgs.startFull;
  $('tmGap').value = tmMsgs.gap; $('tmGapText').value = tmMsgs.gapText; $('tmGapIncl').checked = tmMsgs.gapIncl !== false; syncTotal();
  $('tmMsgList').innerHTML = tmMsgs.list.map((x, i) =>
    `<div class="mrow"><input type="number" min="0" max="599" value="${x.m}" data-i="${i}" data-k="m" aria-label="몇 분 뒤"><span>분 뒤</span>` +
    `<input type="text" maxlength="40" value="${x.t.replace(/"/g, '&quot;')}" placeholder="뜨는 글씨" data-i="${i}" data-k="t"><button class="pill minus" data-del="${i}">×</button></div>`).join('');
}
function setMsgOn(v) {
  tmMsgOn = v; store.set('tmMsgOn', v); $('tmMsgOn').textContent = v ? '💬 안내 글씨 켬' : '💬 안내 글씨 끔'; $('tmMsgOn').classList.toggle('sel', v);
  $('tmMsgBox').classList.toggle('off', !v); if (!v) { showMsg(''); tmPend = null; tmFreezeUntil = 0; hideTrans(); } else if (tmRun) { tmStartIdx = -1; startTick(tmSet - tmRemaining()); }
  if (typeof nativeSchedule === 'function' && tmRun) nativeSchedule();
}
$('tmMsgOn').onclick = e => { e.preventDefault(); e.stopPropagation(); setMsgOn(!tmMsgOn); };
setMsgOn(tmMsgOn);
$('tmStartList').oninput = e => { const i = +e.target.dataset.i, k = e.target.dataset.k; if (k) { tmMsgs.starts[i][k] = k === 's' ? Math.max(1, +e.target.value || 1) : e.target.value; saveMsgs(); } };
$('tmStartList').onclick = e => { const d = e.target.dataset.sdel; if (d != null) { tmMsgs.starts.splice(+d, 1); saveMsgs(); renderMsgEditor(); } };
$('tmStartAdd').onclick = () => { tmMsgs.starts.push({ t: '', s: 5 }); saveMsgs(); renderMsgEditor(); };
$('tmStartFull').onchange = e => { tmMsgs.startFull = e.target.checked; saveMsgs(); };
$('tmMsgList').oninput = e => { const i = +e.target.dataset.i, k = e.target.dataset.k; if (k) { tmMsgs.list[i][k] = k === 'm' ? Math.max(0, +e.target.value || 0) : e.target.value; saveMsgs(); } };
$('tmMsgList').onclick = e => { const d = e.target.dataset.del; if (d != null) { tmMsgs.list.splice(+d, 1); saveMsgs(); renderMsgEditor(); } };
$('tmMsgAdd').onclick = () => { const last = tmMsgs.list.length ? tmMsgs.list[tmMsgs.list.length - 1].m : 0; tmMsgs.list.push({ m: last + 1, t: '' }); saveMsgs(); renderMsgEditor(); };
/* 루틴: 시간 + 안내 글씨를 이름 붙여 저장해 두고 한 번에 불러오기 */
let tmRoutines = store.get('tmRoutines', []);
const saveRt = () => store.set('tmRoutines', tmRoutines);
const escH = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderRoutines() {
  $('tmRtChips').hidden = !tmRoutines.length;
  $('tmRtChips').innerHTML = tmRoutines.map((r, i) => `<button class="pill" data-rt="${i}">📋 ${escH(r.name)} · ${fmtTM(r.set)}</button>`).join('');
  $('tmRtList').innerHTML = tmRoutines.map((r, i) => `<div class="mrow"><span style="flex:1">📋 ${escH(r.name)} (${fmtTM(r.set)}, 글씨 ${(r.starts ? r.starts.filter(x => x.t).length : (r.start ? 1 : 0)) + r.list.filter(x => x.t).length}개${r.gap ? `, 전환 ${r.gap}초 ${r.gapIncl === false ? '제외' : '포함'}` : ''})</span><button class="pill minus" data-rtdel="${i}">×</button></div>`).join('');
}
function applyRoutine(i) {
  const r = tmRoutines[i]; if (!r || tmRun) return;
  clearGap(); tmSet = tmLeft = r.set; tmRounds = 0;
  tmMsgs.starts = JSON.parse(JSON.stringify(r.starts || (r.start ? [{ t: r.start, s: 5 }] : []))); tmMsgs.startFull = !!r.startFull; tmMsgs.list = JSON.parse(JSON.stringify(r.list)); tmMsgs.gap = r.gap || 0; tmMsgs.gapText = r.gapText || ''; tmMsgs.gapIncl = r.gapIncl !== false; saveMsgs(); renderMsgEditor(); showMsg(''); tmFired = new Set();
  document.querySelectorAll('#tmPre .pill').forEach(x => x.classList.toggle('sel', +x.dataset.set === r.set));
  setTmUI(); drawTM();
}
$('tmRtChips').onclick = e => { const b = e.target.closest('[data-rt]'); if (b) applyRoutine(+b.dataset.rt); };
$('tmRtList').onclick = e => { const d = e.target.dataset.rtdel; if (d != null) { tmRoutines.splice(+d, 1); saveRt(); renderRoutines(); } };
$('tmRtSave').onclick = () => {
  const name = $('tmRtName').value.trim() || `루틴 ${tmRoutines.length + 1}`;
  const set = Math.round(tmRun ? tmSet : (tmLeft >= tmSet || tmLeft <= 0 ? tmSet : tmSet));
  const item = { name, set, gap: tmMsgs.gap, gapText: tmMsgs.gapText, gapIncl: tmMsgs.gapIncl !== false, starts: JSON.parse(JSON.stringify(startSeq())), startFull: !!tmMsgs.startFull, list: JSON.parse(JSON.stringify(tmMsgs.list.filter(x => x.t))) };
  const k = tmRoutines.findIndex(r => r.name === name); if (k >= 0) tmRoutines[k] = item; else tmRoutines.push(item);
  saveRt(); $('tmRtName').value = ''; renderRoutines();
};
renderMsgEditor(); renderRoutines();
function clearGap() { tmGapEnd = 0; clearInterval(gapIv); gapIv = null; if (!ringTimer) $('ring').classList.remove('on'); }   // 무한 반복: 끝나면 같은 시간으로 자동 다시 시작
const tmWheel = makeWheels($('tmWheel'), [{ n: 10, label: '시간' }, { n: 60, label: '분' }, { n: 60, label: '초' }], v => {
  const t = Math.min(10 * 3600 - 1, v[0] * 3600 + v[1] * 60 + v[2]);
  tmLeft = tmSet = t; tmRun = false;
  document.querySelectorAll('#tmPre .pill').forEach(x => x.classList.toggle('sel', +x.dataset.set === t));
  setTmUI(); drawTM();
});
// '총 시간에 포함 안 함' 이면 전환 글씨가 뜨는 동안 타이머를 멈춘다
const tmRemaining = () => {
  if (!tmRun) return tmLeft;
  if (tmFreezeUntil) { const n = Date.now(); if (n < tmFreezeUntil) tmEnd = n + tmFrozenMs; else tmFreezeUntil = 0; }
  return Math.max(0, (tmEnd - Date.now()) / 1000);
};
const gapActive = () => tmMsgOn && tmMsgs.gap > 0 && !!tmMsgs.gapText;
const extraGapMs = () => (!tmMsgs.gapIncl && gapActive())    // 안드로이드 알림: 앞으로 멈추게 될 전환 시간 합
  ? tmMsgs.list.filter((x, i) => x.t && Math.round(x.m * 60) < Math.round(tmSet) && !tmFired.has(i)).length * tmMsgs.gap * 1000 : 0;
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
    if (r > 0) msgTick(r);
    if (c <= 5 && c > 0 && c !== lastBeep) { lastBeep = c; beep(660, .12, 0, .3); }
    if (r <= 0) {
      if (tmRepeat && tmSet > 0) {                       // 반복 중: 7초 동안 소리 → 같은 시간으로 다시 시작
        const now = Date.now();
        if (!tmGapEnd) {
          tmGapEnd = now + REP_GAP; tmRounds++; setTmUI();
          $('ringMsg').textContent = endText() || '시간 끝!'; $('ringAuto').textContent = ` · ${REP_GAP / 1000}초 뒤 다음 시작`; $('ring').classList.add('on');
          const sd = SOUNDS[settings.sound] || SOUNDS.beep;
          try { audio(); sd.play(); gapIv = setInterval(() => { try { sd.play(); } catch (e) {} }, sd.every); } catch (e) {}
          const c = $('timer').querySelector('.card'); c.classList.remove('rep'); void c.offsetWidth; c.classList.add('rep');
        } else if (now >= tmGapEnd) {
          clearGap(); $('ring').classList.remove('on'); tmEnd = now + tmSet * 1000; lastBeep = -1; msgRoundStart(); setTmUI();
        }
      } else { tmRun = false; tmLeft = 0; tmFreezeUntil = 0; tmPend = null; tmTransRing = false; showMsg(''); setTmUI(); startRing(endText() || '시간 끝!'); }
    }
  }
}
function setTmUI() {
  $('tmStart').textContent = tmRun ? '일시정지' : (tmLeft > 0 && tmLeft < tmSet ? '계속' : '시작');
  $('tmStart').className = 'btn ' + (tmRun ? 'pause' : 'primary');
  $('tmPre').classList.toggle('hide', tmRun);
  const idle = !tmRun && (tmLeft <= 0 || tmLeft >= tmSet);   // 멈춰 있고 아직 시작 전이면 휠로 맞추기
  $('timer').classList.toggle('idle', idle);
  if (idle) { const t = Math.round(tmLeft > 0 ? tmLeft : tmSet); tmWheel.set([Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60]); }
  syncTotal(); syncMusic();
  $('tmRep').classList.toggle('sel', tmRepeat);
  $('tmRep').textContent = tmRepeat ? '🔁 반복 켬' : '🔁 반복 끔';
  $('tmCap').textContent = tmRun ? (tmRepeat ? (tmGapEnd ? `🔔 시간 끝! 잠시 후 ${tmRounds + 1}번째 시작` : `🔁 반복 중 · ${tmRounds + 1}번째 · 멈추려면 일시정지`) : '진행 중 · 시간을 더하거나 뺄 수 있어요') : idle ? '휠을 돌려 맞추세요 · 빨리 돌리면 빨리 넘어가고, 숫자를 누르면 직접 입력해요' : '숫자를 누르면 시간을 직접 입력할 수 있어요';
  $('tmDisp').classList.toggle('editable', !tmRun);
}
$('tmStart').onclick = () => {
  audio();
  clearGap(); hideTrans();
  if (tmRun) { tmLeft = tmRemaining(); tmRun = false; tmFreezeUntil = 0; }
  else {
    if (tmLeft <= 0) tmLeft = tmSet;
    if (tmLeft <= 0) return;
    if (tmLeft >= tmSet) { tmRounds = 0; msgRoundStart(); }
    tmEnd = Date.now() + tmLeft * 1000; tmRun = true; lastBeep = -1;
  }
  setTmUI(); drawTM();
};
$('tmRep').onclick = () => { tmRepeat = !tmRepeat; store.set('tmRepeat', tmRepeat); setTmUI(); };
$('tmReset').onclick = () => { tmFreezeUntil = 0; try { $('tmBgm').currentTime = 0; } catch (e) {} clearGap(); tmPend = null; hideTrans(); showMsg(''); tmFired = new Set(); tmRun = false; tmRounds = 0; tmLeft = tmSet; setTmUI(); drawTM(); };
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
    clearGap();
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
    if (tmRun && tmEnd > Date.now() + 1000) {
      const xg = extraGapMs(), times = tmRepeat && tmSet >= 5 ? Math.min(60, Math.floor(7200 / (tmSet + 7 + xg / 1000))) : 1;   // 반복이면 앞으로 2시간 안에서 최대 60번
      for (let k = 0; k < Math.max(1, times); k++) list.push({
        id: k ? 200 + k : 1, title: k ? `🔁 ${k + 1}번째 ${endText() || '시간 끝!'}` : `⏳ ${endText() || '시간 끝!'}`, body: tmRepeat ? '반복 타이머' : '타이머가 끝났어요', channelId: ch, smallIcon: 'ic_stat_timer', iconColor: '#5b5bf0',
        schedule: { at: new Date(tmEnd + xg + k * (tmSet + 7 + xg / 1000) * 1000), allowWhileIdle: true }
      });
    }
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) { console.warn(e); }
}
// 화면에 보일 땐 앱이 직접 울리고, 내려가면 휴대폰 알림에 맡김 (두 번 울리지 않게)
document.addEventListener('visibilitychange', () => { document.hidden ? nativeSchedule() : nativeCancel(); });
nativeInit();

/* ---------- 알람 ---------- */
let aH = 9, aM = 0, alarms = store.get('classAlarms', []);
const saveAlarms = () => store.set('classAlarms', alarms);
const drawSet = () => { $('aPreview').textContent = `${aH < 12 ? '오전' : '오후'} ${aH % 12 || 12}시 ${pad(aM)}분 · 휠을 돌리거나 숫자를 눌러 직접 입력`; };
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
  const n = ['1','2','3','4','5','6','7','8'].indexOf(e.key);
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
