/* ===== AI 대화 (Google Gemini API) =====
   - API 키는 이 기기의 localStorage 에만 저장되고, Google(generativelanguage.googleapis.com)으로만 전송됩니다.
   - 키는 코드에 넣지 않습니다. 앱 안에서 직접 입력하세요. (https://aistudio.google.com/apikey) */
(function () {
  'use strict';
  var API = 'https://generativelanguage.googleapis.com/v1beta/';
  var K_KEY = 'ai.key', K_MODEL = 'ai.model', K_SYS = 'ai.sys', K_CHAT = 'ai.chat';
  var DEFAULT_SYS = '당신은 초등학교 선생님과 학생을 돕는 친절한 한국어 AI 도우미입니다. 쉽고 짧게 답하고, 필요하면 목록으로 정리하세요. 모르는 것은 모른다고 말하세요.';
  var FALLBACK_MODELS = [
    ['gemini-flash-latest', 'Gemini Flash (빠름 · 기본)'],
    ['gemini-flash-lite-latest', 'Gemini Flash-Lite (더 빠름)'],
    ['gemini-pro-latest', 'Gemini Pro (더 똑똑함)']
  ];
  var QUICK = [
    ['📝 알림장', '4학년 학급 알림장을 써 줘. 내용: '],
    ['📣 가정통신문', '학부모님께 보낼 가정통신문 초안을 써 줘. 주제: '],
    ['❓ 퀴즈', '초등학교 4학년 수준으로 퀴즈 5문제와 정답을 만들어 줘. 주제: '],
    ['💡 모둠활동', '6모둠이 함께 할 수 있는 활동 아이디어를 알려 줘. 주제: '],
    ['🎲 아이스브레이킹', '수업 시작 전 3분 안에 할 수 있는 재미있는 활동 5가지를 알려 줘.']
  ];

  var msgs = (function () { var m = store.get(K_CHAT, []); return Array.isArray(m) ? m : []; })();
  var busy = false, ctrl = null;

  var chat = $('aiChat'), input = $('aiIn'), sendBtn = $('aiSend'), modelSel = $('aiModel');

  // ---------- 글 꾸미기 (안전하게: 먼저 이스케이프) ----------
  function md(text) {
    var blocks = [];
    var h = esc(text).replace(/```[^\n`]*\n?([\s\S]*?)```/g, function (m, c) { blocks.push(c.replace(/\n$/, '')); return '\u0000' + (blocks.length - 1) + '\u0000'; });
    h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>')
         .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
         .replace(/^#{1,6}\s*(.+)$/gm, '<b>$1</b>')
         .replace(/^\s*[*-]\s+(.+)$/gm, '• $1')
         .replace(/(https?:\/\/(?:(?!&quot;|&lt;|&gt;)[^\s<>"'`])+)/g, function (u) {
           var tail = (u.match(/[.,;:!?)\]]+$/) || [''])[0];
           var clean = tail ? u.slice(0, -tail.length) : u;
           return '<span class="lnk">' + clean + '</span><button class="mini-qr" data-qr="' + clean + '" title="이 주소로 QR 만들기">QR</button>' + tail;
         })
         .replace(/\n/g, '<br>');
    return h.replace(/\u0000(\d+)\u0000/g, function (m, i) { return '<pre><code>' + blocks[+i] + '</code></pre>'; });
  }

  function bubble(m, idx) {
    var d = document.createElement('div');
    d.className = 'msg ' + (m.role === 'user' ? 'user' : 'model') + (m.error ? ' err' : '');
    d.dataset.i = idx;
    var body = document.createElement('div'); body.className = 'body';
    if (m.role === 'user') body.textContent = m.text; else body.innerHTML = md(m.text || '…');
    d.appendChild(body);
    if (m.role !== 'user' && m.text && !m.error) {
      var act = document.createElement('div'); act.className = 'act';
      act.innerHTML = '<button data-copy="' + idx + '">📋 복사</button>';
      d.appendChild(act);
    }
    return d;
  }

  function render() {
    chat.innerHTML = '';
    if (!msgs.length) {
      chat.innerHTML = '<div class="empty">무엇이든 물어보세요!<br><small>알림장·가정통신문 초안, 퀴즈, 수업 아이디어 등을 도와드려요.<br>학생 이름·연락처 같은 개인정보는 입력하지 마세요.</small></div>';
      return;
    }
    msgs.forEach(function (m, i) { chat.appendChild(bubble(m, i)); });
    chat.scrollTop = chat.scrollHeight;
  }
  function paint(i) {               // 답이 흘러 들어올 때 마지막 말풍선만 갱신
    var el = chat.querySelector('.msg[data-i="' + i + '"] .body');
    if (!el) { render(); return; }
    el.innerHTML = md(msgs[i].text || '…');
    chat.scrollTop = chat.scrollHeight;
  }
  function save() {
    store.set(K_CHAT, msgs.filter(function (m) { return !m.error && m.text; }).slice(-40).map(function (m) { return { role: m.role, text: m.text }; }));
  }

  chat.addEventListener('click', function (e) {
    var q = e.target.closest('[data-qr]'); if (q) { window.qrFrom(q.dataset.qr, ''); return; }
    var c = e.target.closest('[data-copy]'); if (c) copyText(msgs[+c.dataset.copy].text, '답변을 복사했어요');
  });

  // ---------- 모델 ----------
  function fillModels(list, keep) {
    modelSel.innerHTML = '';
    list.forEach(function (m) { var o = document.createElement('option'); o.value = m[0]; o.textContent = m[1]; modelSel.appendChild(o); });
    var want = keep || store.get(K_MODEL, FALLBACK_MODELS[0][0]);
    if (!list.some(function (m) { return m[0] === want; })) want = list[0][0];
    modelSel.value = want; store.set(K_MODEL, want);
  }
  modelSel.onchange = function () { store.set(K_MODEL, modelSel.value); };
  fillModels(FALLBACK_MODELS);

  function loadModels(quiet) {
    var key = store.get(K_KEY, '');
    if (!key) return Promise.resolve();
    return fetch(API + 'models?pageSize=100', { headers: { 'x-goog-api-key': key } })
      .then(function (r) { return r.ok ? r.json() : r.json().then(function (j) { throw apiErr(r.status, j); }); })
      .then(function (j) {
        var list = (j.models || []).filter(function (m) {
          return /^models\/gemini-/.test(m.name) && (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0 &&
                 !/(tts|image|embedding|live|audio|robotics|computer-use|vision|learnlm)/i.test(m.name);
        }).map(function (m) { return [m.name.replace('models/', ''), (m.displayName || m.name.replace('models/', '')) + (/latest$/.test(m.name) ? ' (자동 최신)' : '')]; });
        list.sort(function (a, b) { return (/latest$/.test(b[0]) - /latest$/.test(a[0])) || a[0].localeCompare(b[0]); });
        if (list.length) fillModels(list, modelSel.value);
        if (!quiet) toast('모델 ' + list.length + '개를 불러왔어요');
      })
      .catch(function (e) { if (!quiet) toast(friendly(e)); });
  }

  // ---------- 오류 ----------
  function apiErr(status, j) {
    var er = (j && j.error) || {};
    var e = new Error(er.message || ('HTTP ' + status)); e.status = status; return e;
  }
  function friendly(e) {
    var s = e && e.status, m = (e && e.message) || '';
    if (s === 400 && /API key/i.test(m)) return 'API 키가 올바르지 않아요. 🔑에서 다시 확인해 주세요.';
    if (s === 400) return '요청을 처리할 수 없어요. (' + m.slice(0, 80) + ')';
    if (s === 401 || s === 403) return '이 키로는 사용할 수 없어요. 키가 맞는지, 사용 가능한 지역인지 확인해 주세요.';
    if (s === 404) return '선택한 모델을 찾을 수 없어요. 다른 모델을 골라 보세요.';
    if (s === 429) return '요청이 너무 많거나 무료 사용량을 넘었어요. 잠시 뒤에 다시 해 보세요.';
    if (s >= 500) return 'Google 서버가 바빠요. 잠시 뒤에 다시 해 보세요.';
    if (e && e.name === 'TypeError') return '인터넷 연결을 확인해 주세요.';
    return m || '알 수 없는 오류가 났어요.';
  }

  // ---------- 보내기 ----------
  function contents() {
    var out = [];
    msgs.filter(function (m) { return !m.error && m.text; }).slice(-24).forEach(function (m) {
      var role = m.role === 'user' ? 'user' : 'model', last = out[out.length - 1];
      if (last && last.role === role) last.parts[0].text += '\n' + m.text;      // 같은 역할이 이어지면 합침
      else out.push({ role: role, parts: [{ text: m.text }] });
    });
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  function setBusy(b) {
    busy = b; sendBtn.textContent = b ? '■ 멈춤' : '보내기';
    sendBtn.className = 'btn ' + (b ? 'pause' : 'primary');
  }

  function send() {
    if (busy) { if (ctrl) ctrl.abort(); return; }
    var text = input.value.trim(); if (!text) return;
    var key = store.get(K_KEY, '');
    if (!key) { openKey(); toast('먼저 Google API 키를 넣어 주세요'); return; }
    input.value = ''; autosize();
    msgs = msgs.filter(function (m) { return !m.error; });
    msgs.push({ role: 'user', text: text });
    var bot = { role: 'model', text: '' }; msgs.push(bot);
    var bi = msgs.length - 1;
    render(); setBusy(true);
    ctrl = new AbortController();

    var body = {
      systemInstruction: { parts: [{ text: store.get(K_SYS, '') || DEFAULT_SYS }] },
      contents: contents(),
      generationConfig: { temperature: 0.7 }
    };
    var model = modelSel.value || FALLBACK_MODELS[0][0];

    fetch(API + 'models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) { throw apiErr(res.status, j); });
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
      function line(l) {
        l = l.trim(); if (l.indexOf('data:') !== 0) return;
        var j = l.slice(5).trim(); if (!j || j === '[DONE]') return;
        try {
          var o = JSON.parse(j);
          var parts = (o.candidates && o.candidates[0] && o.candidates[0].content && o.candidates[0].content.parts) || [];
          var t = parts.map(function (p) { return p.text || ''; }).join('');
          if (t) { bot.text += t; paint(bi); }
          if (o.promptFeedback && o.promptFeedback.blockReason && !bot.text) bot.text = '이 질문에는 답할 수 없어요. 표현을 바꿔 보세요.';
        } catch (e) { /* 조각난 줄은 건너뜀 */ }
      }
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { if (buf) line(buf); return; }
          buf += dec.decode(r.value, { stream: true });
          var i; while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); }
          return pump();
        });
      }
      return pump();
    }).then(function () {
      if (!bot.text) bot.text = '(답변이 비어 있어요. 질문을 바꿔 보세요.)';
    }).catch(function (e) {
      if (e && e.name === 'AbortError') { if (!bot.text) bot.text = '(멈췄어요)'; return; }
      bot.error = true; bot.text = (bot.text ? bot.text + '\n\n' : '') + '⚠️ ' + friendly(e);
    }).then(function () {
      setBusy(false); ctrl = null; save(); render();
    });
  }

  sendBtn.onclick = send;
  input.addEventListener('keydown', function (e) {
    // Enter = 보내기, Shift+Enter = 줄바꿈 (한글 조합 중에는 무시)
    if (e.key === 'Enter' && !e.shiftKey && !isComposing(e) && !isNative) { e.preventDefault(); send(); }
  });
  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; }
  input.addEventListener('input', autosize);

  $('aiNew').onclick = function () {
    if (ctrl) ctrl.abort();
    msgs = []; save(); render(); toast('새 대화를 시작했어요');
  };

  // 빠른 질문 칩
  $('aiQuick').innerHTML = QUICK.map(function (q, i) { return '<button class="pill" data-q="' + i + '">' + q[0] + '</button>'; }).join('');
  $('aiQuick').onclick = function (e) {
    var b = e.target.closest('[data-q]'); if (!b) return;
    input.value = QUICK[+b.dataset.q][1]; autosize(); input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  // ---------- API 키 · 설정 ----------
  function openKey() {
    $('aiKey').value = store.get(K_KEY, '');
    $('aiKey').type = 'password';
    $('aiSys').value = store.get(K_SYS, '');
    $('aiSys').placeholder = DEFAULT_SYS;
    $('aiSet').classList.add('on');
  }
  function closeKey() { $('aiSet').classList.remove('on'); }
  $('aiKeyBtn').onclick = openKey;
  $('aiSetClose').onclick = closeKey;
  $('aiSet').onclick = function (e) { if (e.target.id === 'aiSet') closeKey(); };
  $('aiKeyEye').onclick = function () { var k = $('aiKey'); k.type = k.type === 'password' ? 'text' : 'password'; };
  $('aiKeySave').onclick = function () {
    var k = $('aiKey').value.trim();
    store.set(K_KEY, k); store.set(K_SYS, $('aiSys').value.trim());
    $('aiHint').hidden = !!k;
    if (!k) { toast('저장했어요 (키 없음)'); closeKey(); return; }
    closeKey(); toast('저장했어요. 모델을 불러오는 중…'); loadModels(false);
  };
  $('aiKeyDel').onclick = function () {
    store.set(K_KEY, ''); $('aiKey').value = ''; $('aiHint').hidden = false; fillModels(FALLBACK_MODELS); toast('API 키를 지웠어요');
  };
  $('aiKey').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !isComposing(e)) $('aiKeySave').click(); });

  document.addEventListener('tabchange', function (e) {
    if (e.detail !== 'ai') return;
    chat.scrollTop = chat.scrollHeight;
    if (!store.get(K_KEY, '')) $('aiHint').hidden = false; else $('aiHint').hidden = true;
  });

  render();
  if (store.get(K_KEY, '')) loadModels(true);
  else $('aiHint').hidden = false;
  $('aiHint').onclick = openKey;
})();
