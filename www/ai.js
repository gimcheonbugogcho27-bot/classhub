/* ===== AI 대화 (Google Gemini API) =====
   - API 키는 이 기기의 localStorage 에만 저장되고, Google(generativelanguage.googleapis.com)으로만 전송됩니다.
   - 키는 코드에 넣지 않습니다. 앱 안에서 직접 입력하세요. (https://aistudio.google.com/apikey) */
(function () {
  'use strict';
  var API = 'https://generativelanguage.googleapis.com/v1beta/';
  var K_KEY = 'ai.key', K_MODEL = 'ai.model', K_SYS = 'ai.sys', K_CHAT = 'ai.chat', K_CONVS = 'ai.convs', K_CUR = 'ai.cur', K_PROMPTS = 'ai.prompts';
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

  // 빌드할 때 GitHub Secret(GEMINI_API_KEY)이 config.js 로 들어오면 그 키를 쓰고, 키 입력 화면은 숨깁니다.
  var EMBED = String((window.APP_CONFIG && window.APP_CONFIG.geminiKey) || '').trim();
  function getKey() { return EMBED || store.get(K_KEY, ''); }

  // ---------- 대화 목록 (여러 대화를 저장해 두고 골라서 이어가기) ----------
  var convs = store.get(K_CONVS, []); if (!Array.isArray(convs)) convs = [];
  var curId = store.get(K_CUR, '');
  function titleOf(list) {
    var u = list.filter(function (m) { return m.role === 'user'; })[0];
    var t = u ? u.text.replace(/\s+/g, ' ').trim() : '새 대화';
    return t.length > 26 ? t.slice(0, 26) + '…' : t;
  }
  (function migrate() {                       // 예전 버전의 단일 대화를 목록으로 옮김
    var old = store.get(K_CHAT, []);
    if (Array.isArray(old) && old.length && !convs.length) {
      curId = 'c' + Date.now().toString(36);
      convs.push({ id: curId, title: titleOf(old), updated: Date.now(), msgs: old });
      store.set(K_CONVS, convs); store.set(K_CUR, curId);
    }
    if (store.get(K_CHAT, []).length) store.set(K_CHAT, []);
  })();
  function findConv(id) { return convs.filter(function (c) { return c.id === id; })[0]; }
  function cp(m) { var o = { role: m.role, text: m.text }; if (m.thumbs && m.thumbs.length) o.thumbs = m.thumbs; return o; }   // 저장용 사본 (사진은 작은 썸네일만)
  var msgs = (function () { var c = findConv(curId); return c ? c.msgs.map(cp) : []; })();
  var busy = false, ctrl = null;

  var chat = $('aiChat'), input = $('aiIn'), sendBtn = $('aiSend'), modelSel = $('aiModel');

  // ---------- 표 (| a | b | 줄 + |---|---| 줄) 을 HTML 표로 ----------
  function tables(h) {
    var L = h.split('\n'), out = [], i = 0;
    var isRow = function (l) { return l.indexOf('|') >= 0 && l.trim().length > 2; };
    var isSep = function (l) { return l.indexOf('|') >= 0 && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l); };
    var cells = function (l) { return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }); };
    while (i < L.length) {
      if (isRow(L[i]) && i + 1 < L.length && isSep(L[i + 1])) {
        var head = cells(L[i]), al = cells(L[i + 1]).map(function (c) { return /^:-*:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : 'left'; });
        var j = i + 2, rows = [];
        while (j < L.length && isRow(L[j]) && !isSep(L[j])) { rows.push(cells(L[j])); j++; }
        var st = function (k) { return ' style="text-align:' + (al[k] || 'left') + '"'; };
        out.push('<div class="tbl"><table><thead><tr>' + head.map(function (c, k) { return '<th' + st(k) + '>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
          rows.map(function (r) { return '<tr>' + head.map(function (_, k) { return '<td' + st(k) + '>' + (r[k] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
        i = j;
      } else { out.push(L[i]); i++; }
    }
    return out.join('\n');
  }

  // ---------- 글 꾸미기 (안전하게: 먼저 이스케이프) ----------
  function md(text) {
    var blocks = [];
    var h = esc(text).replace(/```[^\n`]*\n?([\s\S]*?)```/g, function (m, c) { blocks.push(c.replace(/\n$/, '')); return '\u0000' + (blocks.length - 1) + '\u0000'; });
    h = tables(h);
    h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>')
         .replace(/^\s*(?:-{3,}|\*{3,})\s*$/gm, '<hr>')
         .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
         .replace(/^#{1,6}\s*(.+)$/gm, '<b>$1</b>')
         .replace(/^\s*[*-]\s+(.+)$/gm, '• $1')
         .replace(/(https?:\/\/(?:(?!&quot;|&lt;|&gt;)[^\s<>"'`])+)/g, function (u) {
           var tail = (u.match(/[.,;:!?)\]]+$/) || [''])[0];
           var clean = tail ? u.slice(0, -tail.length) : u;
           return '<span class="lnk">' + clean + '</span><button class="mini-qr" data-qr="' + clean + '" title="이 주소로 QR 만들기">QR</button>' + tail;
         })
         .replace(/\n/g, '<br>');
    h = h.replace(/<br>(<div class="tbl">)/g, '$1').replace(/(<\/div>)<br>/g, '$1').replace(/<hr><br>/g, '<hr>');
    return h.replace(/\u0000(\d+)\u0000/g, function (m, i) { return '<pre><code>' + blocks[+i] + '</code></pre>'; });
  }

  function bubble(m, idx) {
    var d = document.createElement('div');
    d.className = 'msg ' + (m.role === 'user' ? 'user' : 'model') + (m.error ? ' err' : '');
    d.dataset.i = idx;
    var body = document.createElement('div'); body.className = 'body';
    if (m.role === 'user') body.textContent = m.text; else body.innerHTML = md(m.text || '…');
    if (m.thumbs && m.thumbs.length) {
      var im = document.createElement('div'); im.className = 'imgs';
      m.thumbs.forEach(function (t) { var i = document.createElement('img'); i.src = t; i.alt = '첨부 사진'; im.appendChild(i); });
      body.insertBefore(im, body.firstChild);
    }
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
    var keep = msgs.filter(function (m) { return !m.error && m.text; }).slice(-60).map(cp);
    if (!keep.length) return;
    var c = findConv(curId);
    if (!c) { curId = 'c' + Date.now().toString(36); c = { id: curId, title: '', updated: 0, msgs: [] }; convs.unshift(c); }
    c.msgs = keep; if (!c.custom) c.title = titleOf(keep); c.updated = Date.now();
    convs.sort(function (a, b) { return b.updated - a.updated; });
    if (convs.length > 50) convs = convs.slice(0, 50);
    store.set(K_CONVS, convs); store.set(K_CUR, curId);
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
    var key = getKey();
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
    if (s === 429) return '요청이 너무 많거나 무료 사용량을 넘었어요(429). 잠시 뒤에 다시 해 보세요.';
    if (s >= 500) return 'Google 서버가 계속 바빠요(' + s + '). 다른 모델까지 시도했지만 안 됐어요. 1~2분 뒤에 다시 해 보세요.';
    if (e && e.name === 'TypeError') return '인터넷 연결을 확인해 주세요.';
    return m || '알 수 없는 오류가 났어요.';
  }

  // ---------- 요청: 서버가 바쁘면(500·503·429) 한 번 더 시도하고, 그래도 안 되면 다른 모델로 넘어감 ----------
  var BACKUP_MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  var RETRY_MS = 1500;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function openStream(key, body, note) {
    var chain = [modelSel.value || FALLBACK_MODELS[0][0]].concat(BACKUP_MODELS).filter(function (m, i, a) { return a.indexOf(m) === i; });
    var i = 0, retried = false;
    function attempt() {
      var model = chain[i];
      return fetch(API + 'models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (res.ok) { if (i > 0) toast('서버가 바빠서 ' + model + ' 모델로 답했어요'); return res; }
        return res.json().catch(function () { return {}; }).then(function (j) { throw apiErr(res.status, j); });
      }).catch(function (e) {
        if (e && e.name === 'AbortError') throw e;
        var busy = e.status === 500 || e.status === 502 || e.status === 503 || e.status === 504 || e.status === 429;
        var missing = e.status === 404 && i > 0;
        if (busy && !retried) {
          retried = true; note('⏳ Google 서버가 바빠요. 다시 시도하는 중…');
          return sleep(RETRY_MS).then(attempt);
        }
        if ((busy || missing) && i < chain.length - 1) {
          i++; retried = false; note('⏳ 다른 모델(' + chain[i] + ')로 다시 시도하는 중…');
          return sleep(500).then(attempt);
        }
        throw e;
      });
    }
    return attempt();
  }

  // ---------- 보내기 ----------
  function contents() {
    var out = [];
    msgs.filter(function (m) { return !m.error && m.text; }).slice(-24).forEach(function (m) {
      var role = m.role === 'user' ? 'user' : 'model', last = out[out.length - 1];
      var parts = (m.fulls || []).map(function (f) { return { inlineData: { mimeType: 'image/jpeg', data: f } }; });   // 이번에 보낸 사진만 원본으로
      parts.push({ text: m.text });
      if (last && last.role === role) last.parts = last.parts.concat(parts);     // 같은 역할이 이어지면 합침
      else out.push({ role: role, parts: parts });
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
    var text = input.value.trim(); if (!text && !atts.length) return;
    if (!text) text = '이 사진을 설명해 줘.';
    var key = getKey();
    if (!key) { openKey(); toast('먼저 Google API 키를 넣어 주세요'); return; }
    input.value = ''; autosize();
    msgs = msgs.filter(function (m) { return !m.error; });
    var um = { role: 'user', text: text };
    if (atts.length) { um.thumbs = atts.map(function (a) { return a.thumb; }); um.fulls = atts.map(function (a) { return a.full; }); }
    atts = []; drawAtt();
    msgs.push(um);
    var bot = { role: 'model', text: '' }; msgs.push(bot);
    var bi = msgs.length - 1;
    save(); render(); setBusy(true);
    ctrl = new AbortController();

    var body = {
      systemInstruction: { parts: [{ text: store.get(K_SYS, '') || DEFAULT_SYS }] },
      contents: contents(),
      generationConfig: { temperature: 0.7 }
    };

    var note = false;
    function setNote(t) { bot.text = t; note = true; paint(bi); }
    openStream(key, body, setNote).then(function (res) {
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
      function line(l) {
        l = l.trim(); if (l.indexOf('data:') !== 0) return;
        var j = l.slice(5).trim(); if (!j || j === '[DONE]') return;
        try {
          var o = JSON.parse(j);
          var parts = (o.candidates && o.candidates[0] && o.candidates[0].content && o.candidates[0].content.parts) || [];
          var t = parts.map(function (p) { return p.text || ''; }).join('');
          if (t) { if (note) { bot.text = ''; note = false; } bot.text += t; paint(bi); }
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
      if (note) { bot.text = ''; note = false; }
      if (!bot.text) bot.text = '(답변이 비어 있어요. 질문을 바꿔 보세요.)';
    }).catch(function (e) {
      if (note) { bot.text = ''; note = false; }
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

  function newChat() {
    if (busy) { toast('답변 중이에요. ■ 멈춤을 누른 뒤에 해 주세요'); return false; }
    save(); curId = ''; msgs = []; store.set(K_CUR, ''); render(); return true;
  }
  $('aiNew').onclick = function () { if (newChat()) toast('새 대화를 시작했어요'); };


  // ---------- 사진 첨부 (최대 3장, 긴 변 1280px JPEG 로 줄여서 전송) ----------
  var atts = [];
  function drawAtt() {
    var box = $('aiAtt'); box.innerHTML = ''; box.hidden = !atts.length;
    atts.forEach(function (a, i) {
      var w = document.createElement('div'); w.className = 'att';
      var im = document.createElement('img'); im.src = a.thumb; im.alt = '첨부 사진';
      var x = document.createElement('button'); x.textContent = '✕'; x.title = '빼기'; x.dataset.rm = i;
      w.appendChild(im); w.appendChild(x); box.appendChild(w);
    });
  }
  function shrink(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        function jpg(max, q) {
          var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          return c.toDataURL('image/jpeg', q);
        }
        var full = jpg(1280, .85), thumb = jpg(160, .6);
        URL.revokeObjectURL(url);
        res({ full: full.split(',')[1], thumb: thumb });
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('열 수 없는 사진')); };
      img.src = url;
    });
  }
  $('aiPhoto').onclick = function () {
    if (atts.length >= 3) { toast('사진은 한 번에 3장까지 보낼 수 있어요'); return; }
    $('aiFile').click();
  };
  $('aiFile').onchange = function () {
    var files = Array.prototype.slice.call(this.files || []).slice(0, 3 - atts.length); this.value = '';
    Promise.all(files.map(function (f) { return shrink(f).catch(function () { return null; }); })).then(function (r) {
      var ok = r.filter(Boolean); atts = atts.concat(ok); drawAtt();
      if (ok.length < files.length) toast('열 수 없는 사진이 있어요 (JPG·PNG 권장)');
    });
  };
  $('aiAtt').onclick = function (e) { var b = e.target.closest('[data-rm]'); if (b) { atts.splice(+b.dataset.rm, 1); drawAtt(); } };

  // ---------- 내 질문 (자주 쓰는 질문 저장) ----------
  var prompts = store.get(K_PROMPTS, []); if (!Array.isArray(prompts)) prompts = [];
  function drawPrompts() {
    var ul = $('aiPromptList'); ul.innerHTML = '';
    if (!prompts.length) { ul.innerHTML = '<div class="empty">저장된 질문이 아직 없어요</div>'; return; }
    prompts.forEach(function (p) {
      var li = document.createElement('li'); li.dataset.id = p.id;
      var t = document.createElement('div'); t.className = 't'; t.textContent = p.text;
      var del = document.createElement('button'); del.className = 'del'; del.dataset.del = p.id; del.textContent = '✕'; del.title = '삭제';
      li.appendChild(t); li.appendChild(del); ul.appendChild(li);
    });
  }
  function openPrompts() { $('aiPromptNew').value = input.value; drawPrompts(); $('aiPrompts').classList.add('on'); }
  function closePrompts() { $('aiPrompts').classList.remove('on'); }
  $('aiPromptBtn').onclick = openPrompts;
  $('aiPromptClose').onclick = closePrompts;
  $('aiPrompts').onclick = function (e) { if (e.target.id === 'aiPrompts') closePrompts(); };
  $('aiPromptSave').onclick = function () {
    var t = $('aiPromptNew').value.trim(); if (!t) { toast('저장할 질문을 적어 주세요'); return; }
    prompts = prompts.filter(function (p) { return p.text !== t; });
    prompts.unshift({ id: 'p' + Date.now().toString(36), text: t });
    prompts = prompts.slice(0, 50); store.set(K_PROMPTS, prompts);
    $('aiPromptNew').value = ''; drawPrompts(); toast('질문을 저장했어요');
  };
  $('aiPromptList').onclick = function (e) {
    var d = e.target.closest('[data-del]');
    if (d) { prompts = prompts.filter(function (p) { return p.id !== d.dataset.del; }); store.set(K_PROMPTS, prompts); drawPrompts(); return; }
    var li = e.target.closest('li[data-id]'); if (!li) return;
    var p = prompts.filter(function (x) { return x.id === li.dataset.id; })[0]; if (!p) return;
    input.value = p.text; autosize(); closePrompts(); input.focus();
  };

  // ---------- 대화 내보내기 · 인쇄 ----------
  function curTitle() { var c = findConv(curId); return (c && c.title) || titleOf(msgs); }
  function transcript() {
    var out = [curTitle(), new Date().toLocaleString('ko-KR'), ''];
    msgs.filter(function (m) { return !m.error && m.text; }).forEach(function (m) {
      out.push(m.role === 'user' ? '[나]' : '[AI]');
      if (m.thumbs && m.thumbs.length) out.push('(사진 ' + m.thumbs.length + '장 첨부)');
      out.push(m.text, '');
    });
    return out.join('\n');
  }
  function fileBase() { return ('AI대화_' + curTitle()).replace(/[\\/:*?"<>|\s…]+/g, '_').slice(0, 40).replace(/[._]+$/, ''); }
  function saveFile(name, mime, text) {
    if (isNative) {
      var FS = plug('Filesystem'), Share = plug('Share');
      var nm = Date.now() + '_' + name;
      return FS.writeFile({ path: 'ClassHub/' + nm, data: text, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true })
        .then(function () { toast('문서/ClassHub 폴더에 저장했어요'); })
        .catch(function () {
          return FS.writeFile({ path: nm, data: text, directory: 'CACHE', encoding: 'utf8' })
            .then(function (r) { return Share.share({ title: name, files: [r.uri] }); })
            .catch(function () { toast('저장에 실패했어요'); });
        });
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: mime + ';charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    toast('파일로 저장했어요'); return Promise.resolve();
  }
  function hasChat() { if (!msgs.some(function (m) { return !m.error && m.text; })) { toast('저장할 대화가 아직 없어요'); return false; } return true; }
  $('aiExport').onclick = function () { if (hasChat()) saveFile(fileBase() + '.txt', 'text/plain', transcript()); };

  function printHtml() {
    var h = '<h1>' + esc(curTitle()) + '</h1><div class="pdate">' + esc(new Date().toLocaleString('ko-KR')) + '</div>';
    msgs.filter(function (m) { return !m.error && m.text; }).forEach(function (m) {
      h += '<div class="pm ' + (m.role === 'user' ? 'u' : 'a') + '"><b>' + (m.role === 'user' ? '나' : 'AI') + '</b>';
      (m.thumbs || []).forEach(function (t) { h += '<img src="' + t + '" alt="">'; });
      h += '<div>' + (m.role === 'user' ? esc(m.text).replace(/\n/g, '<br>') : md(m.text).replace(/<button[^>]*>QR<\/button>/g, '')) + '</div></div>';
    });
    return h;
  }
  $('aiPrint').onclick = function () {
    if (!hasChat()) return;
    if (isNative) {          // 안드로이드 앱에는 인쇄 창이 없어서, 인쇄용 HTML 파일로 저장/공유
      saveFile(fileBase() + '.html', 'text/html', '<!DOCTYPE html><meta charset="utf-8"><title>' + esc(curTitle()) + '</title><style>table{border-collapse:collapse;margin:6px 0}th,td{border:1px solid #999;padding:4px 8px}th{background:#eee}body{font-family:sans-serif;max-width:700px;margin:auto;line-height:1.6}.pm{margin:14px 0;padding:10px 14px;border:1px solid #ccc;border-radius:10px}.pm img{max-height:120px;margin:4px}</style>' + printHtml());
      return;
    }
    $('printArea').innerHTML = printHtml();
    window.print();
  };
  window.addEventListener('afterprint', function () { $('printArea').innerHTML = ''; });

  // ---------- 대화 목록 창 ----------
  var armed = '';                              // 삭제 확인을 기다리는 대화
  function fmtDate(t) {
    var d = new Date(t), p = function (n) { return String(n).padStart(2, '0'); };
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  var renaming = '';                           // 제목 수정 중인 대화
  function snippet(c, q) {                     // 검색어가 들어 있는 메시지 한 토막
    for (var i = 0; i < c.msgs.length; i++) {
      var t = c.msgs[i].text, k = t.toLowerCase().indexOf(q);
      if (k >= 0) { var a = Math.max(0, k - 12); return (a ? '…' : '') + t.slice(a, k + q.length + 24).replace(/[*`#]/g, '').replace(/\s+/g, ' ') + '…'; }
    }
    return '';
  }
  function drawList() {
    var ul = $('aiConvs'); ul.innerHTML = '';
    var q = $('aiSearch').value.trim().toLowerCase();
    var list = !q ? convs : convs.filter(function (c) {
      return (c.title || '').toLowerCase().indexOf(q) >= 0 || c.msgs.some(function (m) { return m.text.toLowerCase().indexOf(q) >= 0; });
    });
    if (!list.length) { ul.innerHTML = '<div class="empty">' + (q ? '찾는 대화가 없어요' : '저장된 대화가 아직 없어요') + '</div>'; return; }
    list.forEach(function (c) {
      var li = document.createElement('li'); li.dataset.id = c.id; if (c.id === curId) li.className = 'cur';
      var t = document.createElement('div'); t.className = 't';
      if (renaming === c.id) {
        var inp = document.createElement('input'); inp.className = 'field ren'; inp.value = c.title || ''; inp.maxLength = 40; inp.placeholder = '대화 제목';
        t.appendChild(inp);
      } else {
        var b = document.createElement('b'); b.textContent = c.title || '새 대화';
        var sm = document.createElement('small');
        sm.textContent = (q && snippet(c, q)) || (fmtDate(c.updated) + ' · 메시지 ' + c.msgs.length + '개');
        t.appendChild(b); t.appendChild(sm);
      }
      var ed = document.createElement('button'); ed.className = 'del edit';
      if (renaming === c.id) { ed.dataset.renOk = c.id; ed.textContent = '✔'; ed.title = '제목 저장'; }
      else { ed.dataset.ren = c.id; ed.textContent = '✎'; ed.title = '제목 고치기'; }
      var del = document.createElement('button'); del.className = 'del'; del.dataset.del = c.id;
      del.textContent = armed === c.id ? '삭제할까요?' : '✕'; del.title = '삭제';
      if (armed === c.id) del.classList.add('armed');
      li.appendChild(t); li.appendChild(ed); li.appendChild(del); ul.appendChild(li);
      if (renaming === c.id) setTimeout(function () { inp.focus(); inp.select(); }, 0);
    });
  }
  function commitRename(id) {
    var c = findConv(id), inp = $('aiConvs').querySelector('.ren');
    if (c && inp) { var v = inp.value.trim(); c.custom = !!v; c.title = v || titleOf(c.msgs); store.set(K_CONVS, convs); }
    renaming = ''; drawList();
  }
  $('aiSearch').addEventListener('input', drawList);
  $('aiConvs').addEventListener('keydown', function (e) {
    if (!e.target.classList.contains('ren')) return;
    if (e.key === 'Enter' && !isComposing(e)) { e.preventDefault(); commitRename(renaming); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); renaming = ''; drawList(); }
  });
  function openList() { armed = ''; renaming = ''; $('aiSearch').value = ''; drawList(); $('aiList').classList.add('on'); }
  function closeList() { $('aiList').classList.remove('on'); }
  $('aiListBtn').onclick = openList;
  $('aiListClose').onclick = closeList;
  $('aiList').onclick = function (e) { if (e.target.id === 'aiList') closeList(); };
  $('aiListNew').onclick = function () { if (newChat()) { closeList(); toast('새 대화를 시작했어요'); } };
  $('aiConvs').onclick = function (e) {
    if (e.target.closest('.ren')) return;
    var ro = e.target.closest('[data-ren-ok]'); if (ro) { commitRename(ro.dataset.renOk); return; }
    var rn = e.target.closest('[data-ren]'); if (rn) { renaming = rn.dataset.ren; armed = ''; drawList(); return; }
    var d = e.target.closest('[data-del]');
    if (d) {                                   // ✕ 한 번 = 확인, 한 번 더 = 삭제
      var id = d.dataset.del;
      if (armed !== id) { armed = id; renaming = ''; drawList(); return; }
      convs = convs.filter(function (c) { return c.id !== id; });
      store.set(K_CONVS, convs); armed = '';
      if (id === curId) { curId = ''; msgs = []; store.set(K_CUR, ''); render(); }
      drawList(); return;
    }
    var li = e.target.closest('li[data-id]'); if (!li) return;
    if (busy) { toast('답변 중이에요. ■ 멈춤을 누른 뒤에 해 주세요'); return; }
    var c = findConv(li.dataset.id); if (!c) return;
    save(); curId = c.id; store.set(K_CUR, curId);
    msgs = c.msgs.map(cp);
    render(); closeList();
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
    if (EMBED) return;
    $('aiKey').value = getKey();
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
    $('aiHint').hidden = !!getKey();
  });

  if (EMBED) { $('aiKeyBtn').hidden = true; $('aiHint').hidden = true; }
  render();
  if (getKey()) loadModels(true);
  else $('aiHint').hidden = false;
  $('aiHint').onclick = openKey;
})();
