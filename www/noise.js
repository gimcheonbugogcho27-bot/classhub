/* 교실 소음 측정기 — 마이크 소리 크기를 신호등으로 보여 주고, 너무 시끄러우면 알려 줍니다.
   소리는 이 기기 안에서 크기만 재며, 녹음·저장·전송하지 않습니다. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  if (!$('noise')) return;
  var kv = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  var PRESETS = { strict: [25, 45], normal: [40, 62], loose: [55, 78] };   // [노랑, 빨강] 기준
  var cfg = kv.get('noise.cfg', { y: 40, r: 62, preset: 'normal', sound: true });
  var ctx = null, an = null, src = null, stream = null, buf = null, raf = 0, level = 0, hist = [], running = false;
  var overSince = 0, lastAlert = 0, count = 0, calibrating = 0, calSum = 0, calN = 0, lastTick = 0;

  function save() { kv.set('noise.cfg', cfg); }
  function paintCfg() {
    $('nzY').style.left = cfg.y + '%'; $('nzR').style.left = cfg.r + '%';
    document.querySelectorAll('#nzPre .pill').forEach(function (b) { b.classList.toggle('sel', b.dataset.p === cfg.preset); });
    $('nzSnd').classList.toggle('sel', !!cfg.sound);
    $('nzSnd').textContent = cfg.sound ? '🔔 너무 시끄러우면 소리로 알림' : '🔕 소리 알림 꺼짐';
  }
  document.querySelectorAll('#nzPre .pill').forEach(function (b) {
    b.onclick = function () { var p = PRESETS[b.dataset.p]; cfg.y = p[0]; cfg.r = p[1]; cfg.preset = b.dataset.p; save(); paintCfg(); };
  });
  $('nzSnd').onclick = function () { cfg.sound = !cfg.sound; save(); paintCfg(); };
  $('nzReset').onclick = function () { count = 0; $('nzCnt').textContent = 0; };

  function state() { return level >= cfg.r ? 2 : level >= cfg.y ? 1 : 0; }
  function paint() {
    var st = running ? state() : -1;
    document.querySelectorAll('#nzLight i').forEach(function (el, i) { el.classList.toggle('on', i === st); });
    var m = $('nzMsg');
    if (calibrating) { m.textContent = '조용히 기다려 주세요…'; m.className = 'big num'; }
    else if (!running) { m.textContent = '마이크가 꺼져 있어요'; m.className = 'big num'; }
    else { m.textContent = ['조용해요 👍', '조금 시끄러워요', '너무 시끄러워요!'][st]; m.className = 'big num ' + ['ok', 'warn', 'bad'][st]; }
    $('nzNum').textContent = Math.round(level);
    var f = $('nzFill'); f.style.width = Math.min(100, level) + '%'; f.style.background = ['#2bd16a', '#f5c518', '#ff4b4b'][Math.max(0, st)];
    var g = $('nzGraph'), c = g.getContext('2d'), w = g.width, h = g.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(245,197,24,.18)'; c.fillRect(0, h - h * cfg.r / 100, w, h * (cfg.r - cfg.y) / 100);
    c.fillStyle = 'rgba(255,75,75,.18)'; c.fillRect(0, 0, w, h - h * cfg.r / 100);
    c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = '#7fd1ff'; c.beginPath();
    hist.forEach(function (v, i) { var x = i / 119 * w, y = h - Math.min(100, v) / 100 * h; i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.stroke();
  }

  function alertNow() {
    count++; $('nzCnt').textContent = count;
    var card = $('nzCard'); card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    if (cfg.sound && typeof beep === 'function') { try { if (typeof audio === 'function') audio(); beep(740, .22, 0, .5); beep(520, .3, .28, .5); } catch (e) {} }
  }

  function loop(ts) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (ts - lastTick < 50) return; lastTick = ts;
    an.getFloatTimeDomainData(buf);
    var s = 0; for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    var rms = Math.sqrt(s / buf.length), db = 20 * Math.log10(rms || 1e-6);
    var raw = Math.max(0, Math.min(100, (db + 80) / 70 * 100));           // -80dB → 0, -10dB → 100
    level += (raw - level) * (raw > level ? 0.5 : 0.12);                  // 올라갈 땐 빠르게, 내려갈 땐 천천히
    hist.push(level); if (hist.length > 120) hist.shift();
    var now = Date.now();
    if (calibrating) {
      calSum += raw; calN++;
      if (now >= calibrating) {                                            // 3초 평균을 '조용'으로
        var b = calSum / Math.max(1, calN); calibrating = 0;
        cfg.y = Math.round(Math.min(90, b + 12)); cfg.r = Math.round(Math.min(98, b + 26)); cfg.preset = ''; save(); paintCfg();
        $('nzNote').textContent = '지금 소리를 조용한 기준으로 맞췄어요. (노랑 ' + cfg.y + ', 빨강 ' + cfg.r + ')';
      }
    } else if (state() === 2) {
      if (!overSince) overSince = now;
      if (now - overSince >= 1500 && now - lastAlert >= 6000) { lastAlert = now; alertNow(); }   // 1.5초 이상 계속 시끄러울 때만
    } else overSince = 0;
    paint();
  }

  function stop() {
    running = false; cancelAnimationFrame(raf); overSince = 0; calibrating = 0;
    try { stream && stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { src && src.disconnect(); } catch (e) {}
    try { ctx && ctx.close(); } catch (e) {}
    ctx = an = src = stream = null; level = 0; hist = [];
    $('nzStart').textContent = '마이크 켜기'; $('nzStart').className = 'btn primary'; paint();
  }
  function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('nzNote').textContent = '이 기기에서는 마이크를 쓸 수 없어요.'; return; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (st) {
      stream = st; var AC = window.AudioContext || window.webkitAudioContext; ctx = new AC();
      src = ctx.createMediaStreamSource(st); an = ctx.createAnalyser(); an.fftSize = 2048; buf = new Float32Array(an.fftSize);
      src.connect(an); running = true; level = 0; hist = [];
      $('nzStart').textContent = '마이크 끄기'; $('nzStart').className = 'btn pause';
      $('nzNote').textContent = '마이크 소리는 이 기기 안에서만 크기를 재고, 녹음하거나 저장하지 않아요.';
      raf = requestAnimationFrame(loop);
    }).catch(function () {
      $('nzNote').textContent = '마이크를 사용할 수 없어요. 마이크 사용을 허용했는지 확인해 주세요.';
    });
  }
  $('nzStart').onclick = function () { running ? stop() : start(); };
  $('nzCal').onclick = function () {
    if (!running) { $('nzNote').textContent = '먼저 마이크를 켜 주세요.'; return; }
    calibrating = Date.now() + 3000; calSum = 0; calN = 0; $('nzNote').textContent = '3초 동안 교실이 조용할 때의 소리를 재고 있어요…';
  };
  document.addEventListener('tabchange', function (e) { if (e.detail !== 'noise' && running) stop(); });   // 다른 탭으로 가면 마이크 끔
  document.addEventListener('visibilitychange', function () { if (document.hidden && running) stop(); });
  paintCfg(); paint();
})();
