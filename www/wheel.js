/* 숫자 휠(드럼) 선택기 — 휴대폰은 손가락으로 돌리고, 컴퓨터는 마우스 휠·드래그·방향키로 맞춥니다. */
(function () {
  window.makeWheels = function (host, cols, onchange) {
    host.classList.add('wheels'); host.textContent = '';
    var vals = cols.map(function () { return 0; }), ws = [], ihs = [], tgt = [], tgtT = [];
    function base(ci) { return tgt[ci] !== undefined && Date.now() - tgtT[ci] < 400 ? tgt[ci] : vals[ci]; }
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    function fmt(c, i) { return c.pad ? String(i).padStart(2, '0') : String(i); }
    function paintSel(ci) {
      var items = ws[ci].children;
      for (var i = 0; i < items.length; i++) items[i].classList.toggle('sel', i === vals[ci]);
      ws[ci].setAttribute('aria-valuenow', vals[ci]);
    }
    function apply() {            // 화면에 보일 때만 위치를 맞춤 (숨겨진 탭에서는 높이가 0)
      ws.forEach(function (w, ci) {
        var it = w.firstChild, h = it ? it.offsetHeight : 0; ihs[ci] = h;
        if (h) w.scrollTop = vals[ci] * h;
      });
    }
    function goto(ci, v, smooth) {
      v = clamp(v, 0, cols[ci].n - 1); var h = ihs[ci] || ws[ci].firstChild.offsetHeight;
      tgt[ci] = v; tgtT[ci] = Date.now();
      if (!h) { vals[ci] = v; paintSel(ci); return; }
      ws[ci].scrollTo({ top: v * h, behavior: smooth ? 'smooth' : 'auto' });
    }
    function edit(ci, col) {
      if (col.querySelector('.wedit')) return;
      var inp = document.createElement('input'); inp.className = 'wedit num'; inp.type = 'text';
      inp.inputMode = 'numeric'; inp.maxLength = 2; inp.value = ''; inp.placeholder = fmt(cols[ci], vals[ci]);
      inp.setAttribute('aria-label', cols[ci].label + ' 직접 입력');
      col.appendChild(inp); inp.focus();
      var done = false;
      function finish(ok) {
        if (done) return; done = true;
        var v = parseInt(inp.value, 10);
        inp.remove();
        if (ok && !isNaN(v)) goto(ci, v, false);
        ws[ci].focus({ preventScroll: true });
      }
      inp.addEventListener('input', function () { inp.value = inp.value.replace(/\D/g, ''); });
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });
      inp.addEventListener('blur', function () { finish(true); });
    }
    cols.forEach(function (c, ci) {
      var col = document.createElement('div'); col.className = 'wcol';
      var w = document.createElement('div'); w.className = 'wheel'; w.tabIndex = 0;
      w.setAttribute('role', 'spinbutton'); w.setAttribute('aria-label', c.label);
      w.setAttribute('aria-valuemin', 0); w.setAttribute('aria-valuemax', c.n - 1);
      for (var i = 0; i < c.n; i++) { var it = document.createElement('div'); it.className = 'wi num'; it.textContent = fmt(c, i); w.appendChild(it); }
      col.appendChild(w);
      var u = document.createElement('span'); u.className = 'wu'; u.textContent = c.label; col.appendChild(u);
      host.appendChild(col); ws.push(w); ihs.push(0);

      w.addEventListener('scroll', function () {
        var h = ihs[ci] || w.firstChild.offsetHeight; if (!h) return;
        var idx = clamp(Math.round(w.scrollTop / h), 0, c.n - 1);
        if (idx !== vals[ci]) { vals[ci] = idx; paintSel(ci); onchange && onchange(vals.slice()); }
      });
      var acc = 0, lastT = 0, streak = 0;       // 마우스 휠: 한 칸씩 (빠르면 가속)
      w.addEventListener('wheel', function (e) {
        e.preventDefault();
        var dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY, step = 0, now = e.timeStamp;
        if (now - lastT < 140) streak++; else streak = 0; lastT = now;
        var mult = streak < 2 ? 1 : streak < 4 ? 3 : streak < 7 ? 6 : 10;   // 빠르게 돌릴수록 크게 건너뜀
        if (Math.abs(dy) >= 50) { step = (dy > 0 ? 1 : -1) * mult; acc = 0; }    // 마우스 휠 한 칸 = 숫자 하나(빠르면 가속)
        else { acc += dy; if (Math.abs(acc) >= 60) { step = (acc > 0 ? 1 : -1) * mult; acc = 0; } }   // 터치패드는 모아서
        if (step) goto(ci, base(ci) + step, true);
      }, { passive: false });
      var typed = '', typedT = 0;
      w.addEventListener('keydown', function (e) {
        if (/^[0-9]$/.test(e.key)) {                       // 숫자를 치면 바로 그 값으로 (예: 2, 5 → 25)
          e.preventDefault(); e.stopPropagation();
          typed = (Date.now() - typedT < 1200 ? typed : '') + e.key; typedT = Date.now();
          if (+typed > c.n - 1) typed = e.key;
          goto(ci, +typed, true); return;
        }
        var d = { ArrowDown: 1, ArrowUp: -1, PageDown: 5, PageUp: -5 }[e.key];
        if (e.key === 'Home') d = -999; if (e.key === 'End') d = 999;
        if (d === undefined) return;
        e.preventDefault(); e.stopPropagation(); goto(ci, vals[ci] + d, true);
      });
      var drag = null;                                       // 마우스 드래그 / 클릭
      w.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        drag = { y: e.clientY, top: w.scrollTop, moved: false };
        w.setPointerCapture(e.pointerId); w.style.scrollSnapType = 'none'; w.focus({ preventScroll: true });
      });
      w.addEventListener('pointermove', function (e) {
        if (!drag) return; var dy = e.clientY - drag.y;
        if (Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved) w.scrollTop = drag.top - dy;
      });
      var movedAt = 0;
      function up() {
        if (!drag) return; var h = ihs[ci] || w.firstChild.offsetHeight, d = drag; drag = null;
        w.style.scrollSnapType = '';
        if (d.moved) { movedAt = Date.now(); goto(ci, Math.round(w.scrollTop / h), true); }
      }
      w.addEventListener('click', function (e) {             // 탭/클릭: 가운데 숫자는 직접 입력, 위아래 숫자는 그 값으로
        if (Date.now() - movedAt < 300) return;
        var h = ihs[ci] || w.firstChild.offsetHeight, rel = e.clientY - w.getBoundingClientRect().top, off = Math.floor(rel / h) - 1;
        if (off === 0) edit(ci, col); else goto(ci, vals[ci] + off, true);
      });
      w.addEventListener('pointerup', up); w.addEventListener('pointercancel', up);
      paintSel(ci);
    });
    document.addEventListener('tabchange', function () { requestAnimationFrame(apply); });
    window.addEventListener('resize', apply);
    return {
      set: function (arr) {
        var ch = false;
        arr.forEach(function (v, ci) { v = clamp(v | 0, 0, cols[ci].n - 1); if (v !== vals[ci]) { vals[ci] = v; paintSel(ci); ch = true; } });
        if (ch) apply();
      },
      get: function () { return vals.slice(); }
    };
  };
})();
