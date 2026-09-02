const C = window.CHRONO;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const LW = 104;
let S = 1;

/* ---------- 연도 ↔ 픽셀 (구간별 비균등) ---------- */
function eraX() { let x = 0; return C.eras.map(e => { const o = { ...e, x }; x += e.w * S; return o; }); }
function xOf(y, E) {
  if (y <= 0) return 0;
  for (const e of E) if (y <= e.b) return e.x + (y - e.a) / (e.b - e.a) * e.w * S;
  const l = E[E.length - 1]; return l.x + l.w * S;
}
function yearAt(px) {
  const E = eraX();
  for (const e of E) if (px <= e.x + e.w * S) return Math.round(e.a + (px - e.x) / (e.w * S) * (e.b - e.a));
  return C.eras[C.eras.length - 1].b;
}
const totalW = () => C.eras.reduce((s, e) => s + e.w * S, 0);

/* ---------- 글자 폭 측정 (한 번만) ---------- */
const _mc = document.createElement('canvas').getContext('2d');
function textW(t, size, weight) {
  _mc.font = weight + ' ' + size + "px 'IBM Plex Sans KR', -apple-system, sans-serif";
  return _mc.measureText(t).width;
}
const PAD = { ev: 18, span: 20, flow: 44, th: 52 };

/* ---------- 상태 ---------- */
const rowsEl = $('rows'), rulerEl = $('ruler'), innerEl = $('inner'), tlEl = $('tl');
const head = $('head'), headyr = $('headyr');
let BANDS = [], TICKS = [], ROWS = [], rtrack = null, tickIv = null;
let levelMode = 'auto';            // 'auto' | 'all'
const CULL = 700;                  // 화면 밖 이 픽셀까지만 실제로 그린다

/* 배율이 오를수록 낮은 등급까지 보인다. 검색 중에는 전부 본다. */
function curTier() {
  if (levelMode === 'all') return 3;
  if ($('find').value.trim()) return 3;
  return S < 1.3 ? 1 : S < 2.2 ? 2 : 3;
}
const TIER_NAME = { 1: '핵심만', 2: '표준', 3: '전체' };

/* ---------- 1단계: DOM 생성 ---------- */
function buildTimeline() {
  BANDS = []; TICKS = []; ROWS = [];
  const E = eraX();

  rulerEl.innerHTML = '';
  const corner = document.createElement('div');
  corner.id = 'corner'; corner.textContent = '연도';
  rulerEl.appendChild(corner);
  rtrack = document.createElement('div');
  rtrack.id = 'rtrack';
  rulerEl.appendChild(rtrack);

  E.forEach(e => {
    const b = document.createElement('div');
    b.className = 'era-band';
    b.innerHTML = '<span class="era-name">' + esc(e.n) + '</span>';
    rtrack.appendChild(b);
    BANDS.push({ el: b, e });
    const ppy = (e.w * S) / (e.b - e.a);
    const iv = ppy >= 6 ? 10 : ppy >= 3 ? 25 : ppy >= 1.8 ? 50 : 100;
    const maj = iv <= 10 ? 5 : iv <= 25 ? 4 : 2;
    let i = 0;
    for (let y = e.a; y < e.b; y += iv, i++) {
      const t = document.createElement('div');
      const m = i % maj === 0;
      t.className = 'tick' + (m ? ' major' : '');
      if (m) t.innerHTML = '<span>' + y + '</span>';
      b.appendChild(t);
      TICKS.push({ el: t, e, y });
    }
  });
  tickIv = null;

  rowsEl.innerHTML = '';
  C.lanes.forEach((L, li) => {
    const data = C[L.src] || [];
    const row = document.createElement('div');
    row.className = 'row' + (L.hero ? ' hero' : (li % 2 ? ' alt' : ''));
    const lab = document.createElement('div');
    lab.className = 'rowlabel';
    lab.innerHTML = esc(L.t) + (L.s ? '<small>' + esc(L.s) + '</small>' : '');
    const track = document.createElement('div');
    track.className = 'track';

    const rowH = (L.k === 'flow' || L.k === 'th') ? 30 : 23;
    const items = [];

    data.forEach((d, idx) => {
      const el = document.createElement('div');
      let tw, txt;
      if (L.k === 'ev') {
        txt = d.t;
        el.className = 'ev'; el.style.color = L.c;
        tw = textW(txt, 11.5, 400) + PAD.ev;
        el.dataset.yr = d.y; el.dataset.body = d.n || ''; el.dataset.k = d.k || '';
        items.push({ el, k: 'ev', y: d.y, tw, r: d.r || 2 });
      } else {
        const isTh = L.k === 'th';
        txt = (isTh ? '◆ ' : '') + d.t;
        el.className = isTh ? 'thres' : (L.k === 'flow' ? 'flow' : 'span');
        if (L.k === 'span') el.style.background = L.c;
        tw = isTh ? textW(txt, 12, 500) + PAD.th
                  : textW(txt, 11.5, 400) + PAD[L.k === 'flow' ? 'flow' : 'span'];
        el.dataset.yr = d.a + '–' + d.b; el.dataset.body = d.n || ''; el.dataset.k = d.k || '';
        if (isTh) el.dataset.th = idx;
        items.push({ el, k: 'sp', a: d.a, b: d.b, tw, r: d.r || 2 });
      }
      el.textContent = txt;
      el.dataset.lane = L.t; el.dataset.color = L.c; el.dataset.title = txt;
      track.appendChild(el);
    });

    row.appendChild(lab); row.appendChild(track);
    rowsEl.appendChild(row);
    items.forEach(i => i.row = row);
    ROWS.push({ row, track, items, rowH });
  });
}

/* ---------- 2단계: 좌표만 갱신 (매 프레임 호출 가능) ---------- */
function layout() {
  const E = eraX(), W = totalW() + 40;
  innerEl.style.width = rulerEl.style.width = (W + LW) + 'px';
  rtrack.style.width = W + 'px';

  BANDS.forEach(({ el, e }) => {
    const o = E.find(x => x.a === e.a);
    el.style.left = o.x + 'px';
    el.style.width = (o.w * S) + 'px';
  });
  TICKS.forEach(({ el, e, y }) => {
    el.style.left = ((y - e.a) / (e.b - e.a) * e.w * S) + 'px';
  });

  const tier = curTier();
  ROWS.forEach(R => {
    const ends = []; let maxRow = 0;
    R.items.forEach(it => {
      if (it.r > tier) { it.on = false; return; }
      it.on = true;
      const x1 = it.k === 'ev' ? xOf(it.y, E) : xOf(it.a, E);
      let w = null, x2;
      if (it.k === 'ev') x2 = x1 + it.tw;
      else { w = Math.max(xOf(it.b, E) - x1, it.tw); x2 = x1 + w; }
      let r = 0; while (ends[r] !== undefined && ends[r] > x1 - 6) r++;
      ends[r] = x2; if (r > maxRow) maxRow = r;
      it.x = x1; it.w = w; it.x2 = x2; it.top = 4 + r * R.rowH;
    });
    const h = (8 + (maxRow + 1) * R.rowH) + 'px';
    R.row.style.height = R.track.style.height = h;
    R.track.style.width = W + 'px';
  });
  paint();

  head.style.height = (rulerEl.offsetHeight + rowsEl.offsetHeight) + 'px';
}

/* 화면에 보이는 범위만 DOM에 쓴다 */
function paint() {
  const L = tlEl.scrollLeft - CULL, R2 = tlEl.scrollLeft + tlEl.clientWidth + CULL;
  ROWS.forEach(R => R.items.forEach(it => {
    const vis = it.on && it.x2 > L && it.x < R2;
    if (!vis) { if (it.shown !== false) { it.el.style.display = 'none'; it.shown = false; } return; }
    if (it.shown === false) it.el.style.display = '';
    it.shown = true;
    it.el.style.left = it.x + 'px';
    it.el.style.top = it.top + 'px';
    if (it.w !== null) it.el.style.width = it.w + 'px';
  }));
  const t = curTier();
  $('zlab').textContent = '배율 ' + S.toFixed(1) + '× · ' + TIER_NAME[t];
}
let painting = false;
tlEl.addEventListener('scroll', () => {
  if (painting) return;
  painting = true;
  requestAnimationFrame(() => { paint(); painting = false; });
}, { passive: true });

/* 눈금 간격은 배율에 따라 달라지므로, 간격이 바뀔 때만 다시 만든다 */
function ivFor(e) {
  const ppy = (e.w * S) / (e.b - e.a);
  return ppy >= 6 ? 10 : ppy >= 3 ? 25 : ppy >= 1.8 ? 50 : 100;
}
function refresh() {
  const sig = C.eras.map(ivFor).join(',');
  if (sig !== tickIv) { buildTimeline(); tickIv = sig; }
  layout(); applyFilter();
}

/* ---------- 부드러운 확대 ---------- */
const center = y => { tlEl.scrollLeft = xOf(y, eraX()) + LW - tlEl.clientWidth / 2; };
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let anim = null;

function zoomTo(target, anchor) {
  target = Math.min(4, Math.max(0.45, target));
  if (Math.abs(target - S) < 0.001) return;
  if (anim) cancelAnimationFrame(anim);
  const from = S, t0 = performance.now(), dur = 320;
  const ease = x => 1 - Math.pow(1 - x, 3);

  if (reduced()) { S = target; refresh(); center(anchor); showScale(); return; }

  (function step(now) {
    const p = Math.min(1, (now - t0) / dur);
    S = from + (target - from) * ease(p);
    layout(); center(anchor); showScale();
    if (p < 1) anim = requestAnimationFrame(step);
    else { anim = null; S = target; refresh(); center(anchor); showScale(); }
  })(performance.now());
}
const showScale = () => {};
const anchorYear = () => yearAt(tlEl.scrollLeft + tlEl.clientWidth / 2 - LW);

$('zin').onclick = () => zoomTo(S * 1.6, anchorYear());
$('zout').onclick = () => zoomTo(S / 1.6, anchorYear());

/* 트랙패드·마우스 휠 확대 (Ctrl / ⌘ + 휠) */
tlEl.addEventListener('wheel', e => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const y = yearAt(tlEl.scrollLeft + e.clientX - tlEl.getBoundingClientRect().left - LW);
  S = Math.min(4, Math.max(0.45, S * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  refresh(); center(y); showScale();
}, { passive: false });

/* ---------- 세로 기준선 ---------- */
function moveHead(cx) {
  const r = innerEl.getBoundingClientRect(), px = cx - r.left - LW;
  if (px < 0) { head.style.display = 'none'; return; }
  head.style.display = 'block';
  head.style.left = (px + LW) + 'px';
  headyr.textContent = Math.max(0, yearAt(px)) + '년';
  headyr.style.left = (px > innerEl.offsetWidth - 90 ? -64 : 3) + 'px';
}
tlEl.addEventListener('pointermove', e => moveHead(e.clientX));
tlEl.addEventListener('pointerdown', e => moveHead(e.clientX));
tlEl.addEventListener('pointerleave', () => head.style.display = 'none');

/* ---------- 문턱 해부 ---------- */
function thresholdHTML(t) {
  return '<div class="st">무너진 확실성</div><div class="bk old">' + esc(t.old) + '</div>' +
    '<div class="st">균열</div><div class="bk crk">' +
    t.cr.map(c => '<div class="cl"><b>' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span></div>').join('') + '</div>' +
    '<div class="st">피할 수 없는 질문</div><div class="qz">' + esc(t.q) + '</div>' +
    '<div class="st">새 대답 — 여기서 시대가 열린다</div><div class="bk ans">' + esc(t.ans) + '</div>' +
    '<div class="st">치른 대가</div><div class="cost">' + esc(t.cost) + '</div>';
}

/* ---------- 카드 뷰 ---------- */
function drawThresholds() {
  $('vth').querySelector('.cards').innerHTML = C.thresholds.map(t =>
    '<div class="card"><h2>' + esc(t.t) + '</h2><div class="yr">' + t.a + ' – ' + t.b + '</div>' +
    thresholdHTML(t) + '</div>').join('');
}
function drawPeople() {
  const lane = id => (C.lanes.find(l => l.id === id) || {}).c || '#5E6158';
  $('vpe').querySelector('.cards').innerHTML = [...C.people].sort((a, b) => a.a - b.a).map(p =>
    '<div class="prow"><div class="pmeta"><b>' + esc(p.n) + '</b><small>' + p.a + '–' + p.b + '</small>' +
    '<div class="lifebar"><i style="left:' + (p.a / 2030 * 100).toFixed(1) + '%;width:' +
    Math.max(0.8, (p.b - p.a) / 2030 * 100).toFixed(1) + '%;background:' + lane(p.f) + '"></i></div></div>' +
    '<div class="pbody"><div class="o">' + esc(p.o) + '</div><div class="d">' + esc(p.d) + '</div>' +
    '<div class="w">' + p.w.map(esc).join(' · ') + '</div></div></div>').join('');
}
function drawThreads() {
  $('vtr').querySelector('.cards').innerHTML = C.threads.map(t =>
    '<div class="card"><h2>' + esc(t.t) + '</h2><p class="cost" style="margin:0 0 6px">' + esc(t.d) + '</p>' +
    t.s.map(s => '<div class="step"><div class="sy">' + s[0] + '</div><div class="sb"><b>' +
      esc(s[1]) + '</b><span>' + esc(s[2]) + '</span></div></div>').join('') + '</div>').join('');
}

/* ---------- 상세 패널 ---------- */
const det = $('detail');
document.addEventListener('click', e => {
  const t = e.target.closest('.ev,.span,.flow,.thres');
  if (!t) return;
  $('d-yr').textContent = t.dataset.yr;
  $('d-title').textContent = t.dataset.title;
  const body = $('d-body');
  if (t.dataset.th !== undefined) body.innerHTML = thresholdHTML(C.thresholds[+t.dataset.th]);
  else body.textContent = t.dataset.body || '—';
  const tag = $('d-tag');
  tag.textContent = t.dataset.lane; tag.style.background = t.dataset.color;
  det.classList.add('open');
});
$('close').onclick = () => det.classList.remove('open');

/* ---------- 검색 ---------- */
let MATCHES = [], mi = 0, flyAnim = null;

/* 관련도 점수: 제목 앞머리 > 제목 포함 > 설명 포함, 중요한 항목 우대 */
const norm = s => s.toLowerCase().replace(/[\s·『』「」()]/g, '');
function score(it, q) {
  const d = it.el.dataset;
  const t = d.title, b = d.body || '', k = d.k || '';
  const nq = norm(q), nt = norm(t), nk = norm(k), nb = norm(b);
  const ti = nt.indexOf(nq);
  let s;
  if (ti === 0) s = 100;
  else if (ti > 0) s = 72;
  else if (nq && nk.indexOf(nq) >= 0) s = 85;   // 이명은 제목에 준해 취급
  else if (nb.indexOf(nq) >= 0) s = 34;
  else return -1;
  s += (4 - (it.r || 2)) * 6;
  s -= Math.min(18, t.length / 3);
  return s;
}

function applyFilter() {
  const q = $('find').value.trim();
  const all = rowsEl.querySelectorAll('.ev,.span,.flow,.thres');
  all.forEach(n => n.classList.remove('focus'));
  if (!q) {
    all.forEach(n => n.classList.remove('dim', 'hit'));
    MATCHES = []; mi = 0;
    $('mlab').textContent = ''; $('mnext').hidden = true;
    return;
  }
  MATCHES = [];
  ROWS.forEach(R => R.items.forEach(it => {
    const s = score(it, q);
    it.el.classList.toggle('hit', s >= 0);
    it.el.classList.toggle('dim', s < 0);
    if (s >= 0) MATCHES.push({ it, s });
  }));
  MATCHES.sort((x, y) => y.s - x.s);
  MATCHES = MATCHES.map(m => m.it);
  mi = 0;
  $('mlab').textContent = MATCHES.length ? '1 / ' + MATCHES.length + '건' : '결과 없음';
  $('mnext').hidden = MATCHES.length < 2;
}

/* 목표 지점으로 배율과 스크롤을 함께 이동 */
function flyTo(toS, tx, ty, el) {
  if (flyAnim) cancelAnimationFrame(flyAnim);
  const fromS = S, fx = tlEl.scrollLeft, fy = tlEl.scrollTop;
  const t0 = performance.now(), dur = 460, ease = x => 1 - Math.pow(1 - x, 3);
  const done = () => {
    S = toS; layout();
    tlEl.scrollLeft = tx; tlEl.scrollTop = ty;
    el.classList.remove('focus'); void el.offsetWidth; el.classList.add('focus');
  };
  if (reduced()) { done(); return; }
  (function step(now) {
    const p = Math.min(1, (now - t0) / dur), e = ease(p);
    S = fromS + (toS - fromS) * e;
    layout();
    tlEl.scrollLeft = fx + (tx - fx) * e;
    tlEl.scrollTop = fy + (ty - fy) * e;
    if (p < 1) flyAnim = requestAnimationFrame(step);
    else { flyAnim = null; done(); }
  })(performance.now());
}

function focusMatch(i) {
  if (!MATCHES.length) return;
  mi = (i + MATCHES.length) % MATCHES.length;
  $('mlab').textContent = (mi + 1) + ' / ' + MATCHES.length + '건';
  const it = MATCHES[mi];
  const toS = Math.max(S, 1.6);

  // 목표 배율에서의 좌표를 먼저 구한 뒤 되돌린다
  const keep = S;
  S = toS; layout();
  const yr = it.k === 'ev' ? it.y : it.a;
  const maxX = Math.max(0, innerEl.offsetWidth - tlEl.clientWidth);
  const maxY = Math.max(0, innerEl.offsetHeight - tlEl.clientHeight);
  const tx = Math.max(0, Math.min(maxX, xOf(yr, eraX()) + LW - tlEl.clientWidth / 2));
  const ty = Math.max(0, Math.min(maxY, it.row.offsetTop + it.top - tlEl.clientHeight / 2 + 40));
  S = keep; layout();

  flyTo(toS, tx, ty, it.el);
}

let findTimer = null;
function onFind() {
  clearTimeout(findTimer);
  findTimer = setTimeout(() => {
    applyFilter(); layout();
    if (MATCHES.length) focusMatch(0);
  }, 200);
}
$('mnext').onclick = () => focusMatch(mi + 1);
$('find').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  clearTimeout(findTimer);
  if (!MATCHES.length) { applyFilter(); layout(); focusMatch(0); }
  else focusMatch(mi + 1);          // 엔터를 누를 때마다 다음 건으로
  $('find').blur();                 // 모바일 키보드를 내려 결과가 보이게
});

$('lvl').onclick = () => {
  levelMode = levelMode === 'auto' ? 'all' : 'auto';
  $('lvl').textContent = '밀도: ' + (levelMode === 'all' ? '전체 고정' : '자동');
  layout();
};
$('find').addEventListener('input', onFind);
$('clear').onclick = () => { $('find').value = ''; applyFilter(); layout(); };

/* ---------- 탭 ---------- */
const VIEWS = { tl: 'vtl', th: 'vth', pe: 'vpe', tr: 'vtr' };
function show(k) {
  Object.entries(VIEWS).forEach(([n, id]) => {
    $(id).hidden = n !== k;
    $('tab-' + n).setAttribute('aria-selected', n === k);
  });
  $('tools').hidden = k !== 'tl';
  det.classList.remove('open');
  location.hash = k;
}
Object.keys(VIEWS).forEach(k => $('tab-' + k).onclick = () => show(k));

/* ---------- 시작 ---------- */
document.title = C.meta.title + ' · ' + C.meta.sub;
buildTimeline(); tickIv = C.eras.map(ivFor).join(',');
layout();
drawThresholds(); drawPeople(); drawThreads();
show(VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'tl');
/* 다른 문서에서 ?y=연도 로 들어오면 그 지점을 열어 준다 */
(function deepLink() {
  const y = parseInt(new URLSearchParams(location.search).get('y'), 10);
  if (!isFinite(y)) { tlEl.scrollLeft = 0; return; }
  S = 1.6; refresh();
  tlEl.scrollLeft = Math.max(0, xOf(y, eraX()) + LW - tlEl.clientWidth / 2);
})();
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { const x = tlEl.scrollLeft; buildTimeline(); layout(); tlEl.scrollLeft = x; });
}
