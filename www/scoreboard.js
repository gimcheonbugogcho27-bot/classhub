/* 점수판 — 점수판을 여러 개 만들어 한 화면에 동시에 띄우고, 점수를 올리고 내립니다. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var root = $('sbGrid'); if (!root) return;
  var kv = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  var COLORS = ['#7c9cff', '#34d399', '#fbbf24', '#fb7185', '#38bdf8', '#c084fc'];
  var uid = function () { return 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); };
  var S = kv.get('sb.v1', null);
  function teams(n, label) { var a = []; for (var i = 1; i <= n; i++) a.push({ n: i + label, s: 0 }); return a; }
  if (!S || !Array.isArray(S.boards)) S = { boards: [{ id: uid(), title: '모둠 점수', color: COLORS[0], step: 1, sort: false, items: teams(6, '모둠') }] };
  var big = null;                                                   // 크게 보기 중인 점수판 id
  function save() { kv.set('sb.v1', S); }
  function find(id) { return S.boards.filter(function (b) { return b.id === id; })[0]; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(cls, text, act, label) { var b = el('button', cls, text); b.type = 'button'; b.dataset.act = act; if (label) b.setAttribute('aria-label', label); return b; }

  function render() {
    root.textContent = '';
    S.boards.forEach(function (b) {
      var card = el('div', 'sbcard glass' + (big === b.id ? ' big' : '')); card.dataset.id = b.id; card.style.setProperty('--sbc', b.color);
      var head = el('div', 'sbhead');
      var ti = el('input'); ti.type = 'text'; ti.className = 'sbtitle'; ti.value = b.title; ti.maxLength = 24; ti.dataset.k = 'title'; ti.setAttribute('aria-label', '점수판 이름'); head.appendChild(ti);
      var step = el('select', 'pill sbstep'); step.dataset.k = 'step'; step.setAttribute('aria-label', '한 번에 오르내릴 점수');
      [1, 2, 5, 10].forEach(function (n) { var o = el('option', '', '±' + n); o.value = n; if (b.step === n) o.selected = true; step.appendChild(o); });
      head.appendChild(step);
      head.appendChild(btn('pill' + (b.sort ? ' sel' : ''), '🏆 순위', 'sort', '점수 높은 순으로 보기'));
      head.appendChild(btn('pill', big === b.id ? '✕ 닫기' : '⛶ 크게', 'big', '크게 보기'));
      head.appendChild(btn('pill', '🎨', 'color', '색 바꾸기'));
      head.appendChild(btn('pill', '↺', 'reset', '점수 모두 0으로'));
      head.appendChild(btn('pill minus', '🗑', 'del', '점수판 삭제'));
      card.appendChild(head);
      var list = el('div', 'sbitems');
      var order = b.items.map(function (it, i) { return { it: it, i: i }; });
      var max = Math.max.apply(null, b.items.map(function (x) { return x.s; }).concat([0]));
      if (b.sort) order.sort(function (a, c) { return c.it.s - a.it.s || a.i - c.i; });
      order.forEach(function (o) {
        var row = el('div', 'sbrow' + (max > 0 && o.it.s === max ? ' lead' : '')); row.dataset.i = o.i;
        var nm = el('input'); nm.type = 'text'; nm.className = 'sbname'; nm.value = o.it.n; nm.maxLength = 16; nm.dataset.k = 'name'; nm.setAttribute('aria-label', '이름'); row.appendChild(nm);
        row.appendChild(btn('sbm', '−', 'dec', o.it.n + ' 점수 내리기'));
        var sc = el('button', 'sbscore num', String(o.it.s)); sc.type = 'button'; sc.dataset.act = 'edit'; sc.setAttribute('aria-label', '점수 직접 입력'); row.appendChild(sc);
        row.appendChild(btn('sbp', '+', 'inc', o.it.n + ' 점수 올리기'));
        row.appendChild(btn('sbx', '×', 'rm', o.it.n + ' 삭제'));
        list.appendChild(row);
      });
      card.appendChild(list);
      var foot = el('div', 'sbfoot');
      foot.appendChild(btn('pill plus', '+ 항목 추가', 'add'));
      card.appendChild(foot);
      root.appendChild(card);
    });
    document.body.classList.toggle('sbbig', !!big);
  }

  function boardOf(t) { var c = t.closest('.sbcard'); return c ? find(c.dataset.id) : null; }
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t) return; var b = boardOf(t); if (!b) return;
    var act = t.dataset.act, row = t.closest('.sbrow'), it = row ? b.items[+row.dataset.i] : null;
    if (act === 'inc' && it) it.s += b.step;
    else if (act === 'dec' && it) it.s -= b.step;
    else if (act === 'edit' && it) { var v = prompt((it.n || '항목') + ' 점수를 직접 입력하세요', it.s); if (v === null) return; var n = parseInt(v, 10); if (!isNaN(n)) it.s = Math.max(-9999, Math.min(99999, n)); }
    else if (act === 'rm' && it) { if (!confirm(it.n + ' 항목을 삭제할까요?')) return; b.items.splice(+row.dataset.i, 1); }
    else if (act === 'add') b.items.push({ n: (b.items.length + 1) + '번', s: 0 });
    else if (act === 'sort') b.sort = !b.sort;
    else if (act === 'big') big = big === b.id ? null : b.id;
    else if (act === 'color') b.color = COLORS[(COLORS.indexOf(b.color) + 1) % COLORS.length];
    else if (act === 'reset') { if (!confirm('"' + b.title + '" 점수를 모두 0으로 되돌릴까요?')) return; b.items.forEach(function (x) { x.s = 0; }); }
    else if (act === 'del') { if (!confirm('"' + b.title + '" 점수판을 삭제할까요?')) return; S.boards.splice(S.boards.indexOf(b), 1); if (big === b.id) big = null; }
    save(); render();
  });
  // 이름·제목은 글자를 칠 때마다 바로 저장하고, 화면을 다시 그리지 않아요 (그래야 칸이 안 풀리고, 바로 다음 버튼이 눌려요)
  root.addEventListener('input', function (e) {
    var t = e.target, b = boardOf(t); if (!b) return;
    if (t.dataset.k === 'title') { b.title = t.value; save(); }
    else if (t.dataset.k === 'name') { var row = t.closest('.sbrow'); b.items[+row.dataset.i].n = t.value; save(); }
  });
  root.addEventListener('change', function (e) {
    var t = e.target, b = boardOf(t); if (!b) return;
    if (t.dataset.k === 'step') { b.step = +t.value || 1; save(); }
    else if (t.dataset.k === 'title') { b.title = t.value.trim() || '점수판'; t.value = b.title; save(); }
    else if (t.dataset.k === 'name') { var row = t.closest('.sbrow'), it = b.items[+row.dataset.i]; it.n = t.value.trim() || '이름'; t.value = it.n; save(); }
  });
  var justFocus = false;
  root.addEventListener('mousedown', function (e) { var t = e.target; justFocus = !!(t.dataset && (t.dataset.k === 'name' || t.dataset.k === 'title') && document.activeElement !== t); });
  root.addEventListener('mouseup', function (e) { if (justFocus) { e.preventDefault(); justFocus = false; try { e.target.select(); } catch (x) {} } });   // 눌러서 들어가면 전체 선택 → 바로 새 이름 입력
  root.addEventListener('focusin', function (e) { var t = e.target; if (t.dataset && (t.dataset.k === 'name' || t.dataset.k === 'title')) setTimeout(function () { try { t.select(); } catch (x) {} }, 0); });   // Tab으로 들어와도 전체 선택
  root.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset && (e.target.dataset.k === 'name' || e.target.dataset.k === 'title') && !e.isComposing) e.target.blur(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && big) { big = null; render(); } });

  function add(kind) {
    var n = S.boards.length;
    var tpl = kind === 'team' ? { title: '모둠 점수', items: teams(6, '모둠') }
      : kind === 'vs' ? { title: '대결', items: [{ n: '청팀', s: 0 }, { n: '백팀', s: 0 }] }
      : { title: '새 점수판', items: [{ n: '1번', s: 0 }, { n: '2번', s: 0 }, { n: '3번', s: 0 }] };
    S.boards.push({ id: uid(), title: tpl.title, color: COLORS[n % COLORS.length], step: 1, sort: false, items: tpl.items });
    save(); render();
    if (root.lastChild && root.lastChild.scrollIntoView) root.lastChild.scrollIntoView({ block: 'nearest' });
  }
  $('sbAddTeam').onclick = function () { add('team'); };
  $('sbAddVs').onclick = function () { add('vs'); };
  $('sbAddBlank').onclick = function () { add('blank'); };
  render();
})();
