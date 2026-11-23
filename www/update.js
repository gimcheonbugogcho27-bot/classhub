/* ===== 새 버전 알림 (exe · apk 에서만) =====
   앱을 켜면 GitHub 릴리스 이름의 "빌드 N" 을 읽어, 이 앱에 들어 있는 빌드 번호보다 크면 알려 줍니다. */
(function () {
  'use strict';
  var REPO = 'gimcheonbugogcho27-bot/classhub';
  var cur = +((window.APP_CONFIG && window.APP_CONFIG.build) || 0);
  var isApp = isNative || /Electron/i.test(navigator.userAgent);
  if (!isApp || !cur) return;                 // 웹 버전은 저절로 새 버전이 열리고, 직접 만든 빌드는 번호가 없음

  var bar = $('updateBar'), found = null;

  function show(build, rel) {
    found = { build: build, url: rel.html_url };
    $('updText').textContent = '🔔 새 버전이 나왔어요 (빌드 ' + build + ' · 지금 ' + cur + ')';
    bar.hidden = false;
  }
  $('updLater').onclick = function () { if (found) store.set('upd.skip', found.build); bar.hidden = true; };
  $('updGo').onclick = function () {
    if (!found) return;
    bar.hidden = true;
    if (isNative) {                           // 안드로이드: 기본 브라우저가 apk 를 받음
      toast('받은 apk 파일을 열어 설치하세요');
      location.href = 'https://github.com/' + REPO + '/releases/latest/download/ClassHub.apk';
    } else {                                  // PC: 다운로드 페이지를 기본 브라우저로
      window.open(found.url, '_blank');
    }
  };

  function check() {
    if (Date.now() - store.get('upd.checked', 0) < 3600e3) return;   // 1시간에 한 번만
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        store.set('upd.checked', Date.now());
        var m = /빌드\s*(\d+)/.exec(j.name || ''); if (!m) return;
        var b = +m[1];
        if (b > cur && store.get('upd.skip', 0) < b) show(b, j);
      })
      .catch(function () { /* 인터넷이 없으면 조용히 넘어감 */ });
  }
  setTimeout(check, 3000);
})();
