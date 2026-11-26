/* 타이머 + 소음 신호등 연동 — 타이머가 돌아가는 동안 타이머 화면에 작은 소음 신호등을 보여 줍니다.
   기준(노랑/빨강)은 '소음' 탭 설정을 그대로 따르고, 마이크 소리는 크기만 재며 녹음·저장·전송하지 않습니다. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  if (!$('tmNz') || !$('timer')) return;
  var kv = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  var cfg = kv.get('tmnz.cfg', { on: false, sound: true });
  var MAXV = 250, ctx = null, an = null, src = null, stream = null, buf = null, raf = 0, level = 0, running = false, starting = false;
  var overSince = 0, lastAlert = 0, lastTick = 0, msgAt = 0, msgSt = -1, msgTxt = '';
  var MSG = [['조용해요 👍', '잘하고 있어요!', '집중하는 모습이 멋져요'], ['조금 시끄러워요', '목소리를 조금만 낮춰요 🤫'], ['너무 시끄러워요!', '쉿! 조용히 해요 🤫', '잠깐 멈춤! 목소리를 낮춰요']];
  function th() { var n = kv.get('noise.cfg', null); return (n && n.v === 2) ? { y: n.y, r: n.r } : { y: 100, r: 155 }; }   // 소음 탭의 기준
  function save() { kv.set('tmnz.cfg', cfg); }
  function paintBtns() {
    $('tmNz').classList.toggle('sel', cfg.on); $('tmNz').textContent = cfg.on ? '🚦 소음 신호등 켬' : '🚦 소음 신호등 끔';
    $('tmNzSnd').hidden = !cfg.on; $('tmNzSnd').classList.toggle('sel', cfg.sound); $('tmNzSnd').textContent = cfg.sound ? '🔔 알림 소리 켬' : '🔕 알림 소리 끔';
  }
  function paint() {
    var bar = $('tmNzBar'); bar.hidden = !(cfg.on && running);
    if (bar.hidden) return;
    var t = th(), st = level >= t.r ? 2 : level >= t.y ? 1 : 0, now = Date.now();
    document.querySelectorAll('#tmNzBar .lights i').forEach(function (el, i) { el.classList.toggle('on', i === st); });
    if (st !== msgSt || now - msgAt > 6000) { var l = MSG[st], x; do { x = l[Math.floor(Math.random() * l.length)]; } while (x === msgTxt && l.length > 1); msgSt = st; msgTxt = x; msgAt = now; }
    $('tmNzMsg').textContent = msgTxt; $('tmNzMsg').className = ['ok', 'warn', 'bad'][st]; $('tmNzNum').textContent = Math.round(level);
  }
  function alertNow() {
    var bar = $('tmNzBar'); bar.classList.remove('flash'); void bar.offsetWidth; bar.classList.add('flash');
    if (cfg.sound && typeof beep === 'function') { try { if (typeof audio === 'function') audio(); beep(740, .22, 0, .4); beep(520, .3, .28, .4); } catch (e) {} }
  }
  function loop(ts) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (ts - lastTick < 60) return; lastTick = ts;
    an.getFloatTimeDomainData(buf);
    var s = 0; for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    var db = 20 * Math.log10(Math.sqrt(s / buf.length) || 1e-6), raw = Math.max(0, Math.min(MAXV, (db + 80) / 80 * MAXV));
    level += (raw - level) * (raw > level ? 0.5 : 0.12);
    var now = Date.now(), ringing = $('ring').classList.contains('on');   // 알람·전환 화면이 떠 있을 땐 알리지 않음
    if (level >= th().r && !ringing) { if (!overSince) overSince = now; if (now - overSince >= 1500 && now - lastAlert >= 6000) { lastAlert = now; alertNow(); } }
    else overSince = 0;
    paint();
  }
  function stop() {
    running = false; cancelAnimationFrame(raf); overSince = 0;
    try { stream && stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { src && src.disconnect(); } catch (e) {}
    try { ctx && ctx.close(); } catch (e) {}
    ctx = an = src = stream = null; level = 0; paint();
  }
  function start() {
    if (running || starting) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('tmNzBar').hidden = false; $('tmNzMsg').textContent = '이 기기에서는 마이크를 쓸 수 없어요'; return; }
    starting = true;
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (st) {
      starting = false;
      if (!want()) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = st; var AC = window.AudioContext || window.webkitAudioContext; ctx = new AC();
      src = ctx.createMediaStreamSource(st); an = ctx.createAnalyser(); an.fftSize = 2048; buf = new Float32Array(an.fftSize);
      src.connect(an); running = true; level = 0; raf = requestAnimationFrame(loop);
    }).catch(function () {
      starting = false; cfg.on = false; save(); paintBtns();
      $('tmNzBar').hidden = false; $('tmNzMsg').textContent = '마이크를 쓸 수 없어요. 마이크 사용을 허용했는지 확인해 주세요'; $('tmNzMsg').className = 'warn';
    });
  }
  // 켜져 있고, 타이머가 돌아가고, 타이머 화면을 보고 있을 때만 마이크를 씁니다
  function want() { return cfg.on && typeof tmRun !== 'undefined' && tmRun && $('timer').classList.contains('on') && !document.hidden; }
  function sync() { var w = want(); if (w && !running) start(); else if (!w && (running || starting)) { if (running) stop(); } }
  setInterval(sync, 400);
  $('tmNz').onclick = function () { cfg.on = !cfg.on; save(); paintBtns(); if (cfg.on && typeof tmRun !== 'undefined' && tmRun) start(); else if (!cfg.on) stop(); else $('tmNzBar').hidden = true; };
  $('tmNzSnd').onclick = function () { cfg.sound = !cfg.sound; save(); paintBtns(); };
  paintBtns(); paint();
})();
