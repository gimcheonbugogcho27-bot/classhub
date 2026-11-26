/* ===== QR 만들기 (제목 + QR 이미지) ===== */
(function () {
  'use strict';
  var titleIn = $('qTitle'), urlIn = $('qUrl'), err = $('qErr');
  var canvas = $('qrCanvas'), result = $('qResult');
  var current = null; // { title, url }
  var HKEY = 'qrmaker.history';   // 예전 QR메이커 기록과 같은 이름

  function normalizeUrl(s) {
    s = (s || '').trim();
    if (!s) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
    return s;
  }

  function wrap(ctx, text, maxW) {
    if (!text) return [];
    var out = [], line = '';
    Array.from(text).forEach(function (ch) {
      if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
      else line += ch;
    });
    if (line) out.push(line);
    return out.slice(0, 3);
  }

  // 제목이 위에 적힌 QR 이미지 (1000px 폭, 게시용)
  function draw(title, url) {
    var lib = window.QRCodeLib;
    var qr = new lib.QRCode(-1, lib.ECL.M);
    qr.addData(unescape(encodeURIComponent(url))); // UTF-8 바이트
    qr.make();
    var n = qr.getModuleCount();

    var W = 1000, padY = 70;
    var cell = Math.floor(W / (n + 8));           // 사방 4칸 여백 (인식률)
    var qrSize = cell * n;
    var offX = Math.floor((W - qrSize) / 2);
    var font = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR",sans-serif';

    var ctx = canvas.getContext('2d');
    ctx.font = 'bold 64px ' + font;
    var lines = wrap(ctx, title, W - padY * 2);
    var titleH = title ? lines.length * 80 + 40 : 0;
    var quiet = cell * 4;
    var H = (title ? padY : quiet) + titleH + qrSize + quiet;

    canvas.width = W; canvas.height = H;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    if (title) {
      ctx.fillStyle = '#1d2340';
      ctx.font = 'bold 64px ' + font;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      lines.forEach(function (l, i) { ctx.fillText(l, W / 2, padY + i * 80); });
    }
    var top = (title ? padY : quiet) + titleH;
    ctx.fillStyle = '#000000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(offX + c * cell, top + r * cell, cell, cell);
    }
  }

  function make(title, url, silent) {
    err.textContent = '';
    url = normalizeUrl(url);
    if (!url) { err.textContent = 'URL을 입력해 주세요.'; urlIn.focus(); return; }
    try { draw(title, url); }
    catch (e) { err.textContent = '주소가 너무 길어서 QR을 만들 수 없어요.'; return; }
    current = { title: title, url: url };
    $('qUrlText').textContent = url;
    result.hidden = false;
    if (!silent) { addHistory(title, url); result.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  $('qMake').onclick = function () { make(titleIn.value.trim(), urlIn.value); };
  titleIn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !isComposing(e)) { e.preventDefault(); urlIn.focus(); }
  });
  urlIn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !isComposing(e)) { e.preventDefault(); $('qMake').click(); }
  });

  // 다른 탭(AI 대화 등)에서 바로 QR 만들기
  window.qrFrom = function (url, title) {
    titleIn.value = title || ''; urlIn.value = url;
    showTab('qr'); make(title || '', url);
  };

  function fileName() {
    var base = (current.title || 'QR').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
    return base + '_QR.png';
  }

  $('qSave').onclick = function () {
    if (!current) return;
    var dataUrl = canvas.toDataURL('image/png');
    if (isNative) return saveAndroid(dataUrl);
    var a = document.createElement('a');
    a.href = dataUrl; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    toast('이미지를 저장했어요');
  };

  function saveAndroid(dataUrl) {
    var FS = plug('Filesystem'), Share = plug('Share');
    var name = Date.now() + '_' + fileName();
    var data = dataUrl.split(',')[1];
    // 1) 문서/QR메이커 폴더에 저장  2) 실패하면 캐시에 저장 후 공유 창
    FS.writeFile({ path: 'QR메이커/' + name, data: data, directory: 'DOCUMENTS', recursive: true })
      .then(function () { toast('문서/QR메이커 폴더에 저장했어요'); })
      .catch(function () {
        return FS.writeFile({ path: name, data: data, directory: 'CACHE' })
          .then(function (res) { return Share.share({ title: current.title || 'QR 코드', files: [res.uri] }); })
          .catch(function () { toast('저장에 실패했어요'); });
      });
  }

  $('qCopy').onclick = function () { if (current) copyText(current.url, '주소를 복사했어요'); };

  // ---------- 최근 기록 ----------
  function getHist() { var h = store.get(HKEY, []); return Array.isArray(h) ? h : []; }
  function setHist(h) { store.set(HKEY, h); renderHist(); }
  function addHistory(title, url) {
    var h = getHist().filter(function (x) { return !(x.url === url && x.title === title); });
    h.unshift({ title: title, url: url });
    setHist(h.slice(0, 20));
  }
  function renderHist() {
    var ul = $('qHistory'), h = getHist();
    ul.innerHTML = '';
    if (!h.length) { ul.innerHTML = '<div class="empty">아직 만든 QR이 없어요</div>'; return; }
    h.forEach(function (x, i) {
      var li = document.createElement('li');
      var t = document.createElement('div'); t.className = 't';
      var b = document.createElement('b'); b.textContent = x.title || '(제목 없음)';
      var s = document.createElement('small'); s.textContent = x.url;
      t.appendChild(b); t.appendChild(s);
      var del = document.createElement('button'); del.className = 'del'; del.textContent = '×'; del.title = '삭제';
      del.onclick = function (e) { e.stopPropagation(); var a = getHist(); a.splice(i, 1); setHist(a); };
      li.onclick = function () {
        titleIn.value = x.title; urlIn.value = x.url; make(x.title, x.url, true);
        result.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      li.appendChild(t); li.appendChild(del); ul.appendChild(li);
    });
  }
  // 기본 confirm 창은 PC 앱에서 입력칸이 먹통이 될 수 있어 화면 안 확인창 사용
  $('qClear').onclick = function () { $('qModal').classList.add('on'); };
  $('qNo').onclick = function () { $('qModal').classList.remove('on'); };
  $('qYes').onclick = function () { $('qModal').classList.remove('on'); setHist([]); };
  $('qModal').onclick = function (e) { if (e.target.id === 'qModal') $('qModal').classList.remove('on'); };
  renderHist();

  document.addEventListener('tabchange', function (e) {
    if (e.detail === 'qr' && !/Android|iPhone|iPad/i.test(navigator.userAgent)) setTimeout(function () { titleIn.focus(); }, 50);
  });
})();
