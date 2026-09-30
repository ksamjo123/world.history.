/* 런타임 시험.  node test.js   (jsdom 필요)
   구문 검사로는 못 잡는 실행 오류와 배치 오류를 잡는다. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const D = __dirname;

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? pass++ : (fail++, console.log('  ✗ ' + m + (extra ? '  → ' + extra : ''))); };

function boot({ url = 'https://x/', noMatchMedia = false } = {}) {
  const html = fs.readFileSync(path.join(D, 'index.html'), 'utf8')
    .replace('<link rel="stylesheet" href="style.css">', '')
    .replace(/<link href="https:\/\/fonts[^>]*>/g, '');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url });
  const w = dom.window;
  ['offsetWidth', 'clientWidth'].forEach(p =>
    Object.defineProperty(w.HTMLElement.prototype, p, { get() { return 1200; }, configurable: true }));
  ['offsetHeight', 'clientHeight', 'offsetTop'].forEach(p =>
    Object.defineProperty(w.HTMLElement.prototype, p, { get() { return 600; }, configurable: true }));
  w.HTMLElement.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1200, height: 600, right: 1200, bottom: 600 });
  w.HTMLCanvasElement.prototype.getContext = function () {
    return { font: '', measureText: t => ({ width: t.length * 11.5 }) };
  };
  if (noMatchMedia) w.matchMedia = undefined;
  const src = fs.readFileSync(path.join(D, 'data.js'), 'utf8') + '\n'
            + fs.readFileSync(path.join(D, 'app.js'), 'utf8') + '\n'
            + 'window.__t={get S(){return S},set S(v){S=v},refresh,layout,paint,curTier,applyFilter};';
  w.eval(src);
  return w;
}

console.log('── 1. 기동');
let w;
try { w = boot(); ok(true, ''); console.log('  ✓ 오류 없이 기동'); }
catch (e) { console.log('  ✗ 기동 실패: ' + e.message); process.exit(1); }
try { boot({ noMatchMedia: true }); console.log('  ✓ matchMedia 없는 환경에서도 기동'); pass++; }
catch (e) { console.log('  ✗ matchMedia 없을 때 실패: ' + e.message); fail++; }

const d = w.document, C = w.CHRONO;
const $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];

console.log('\n── 2. 렌더 결과');
const laneCount = C.lanes.length;
ok($$('.row').length === laneCount, '레인 행 수 불일치', $$('.row').length + '/' + laneCount);
const evTotal = C.lanes.filter(l => l.k === 'ev').reduce((s, l) => s + C[l.src].length, 0);
ok($$('.ev').length === evTotal, '사건 요소 수 불일치', $$('.ev').length + '/' + evTotal);
ok($$('.span').length === C.modes.length, '사조 수 불일치');
ok($$('.thres').length === C.thresholds.length, '문턱 수 불일치');
ok($$('.flow').length === C.flows.length, '흐름 수 불일치');
ok($$('.prow').length === C.people.length, '인물 행 수 불일치');
ok($$('.step').length === C.threads.reduce((s, t) => s + t.s.length, 0), '계보 단계 수 불일치');
console.log('  레인 ' + $$('.row').length + ' · 사건 ' + $$('.ev').length + ' · 인물 ' + $$('.prow').length);

console.log('\n── 3. 좌표 건전성');
const neg = $$('.ev,.span,.flow,.thres').filter(e => e.style.display !== 'none' && parseFloat(e.style.left) < 0);
ok(neg.length === 0, '음수 left 좌표', neg.length + '건');
const noTop = $$('.ev').filter(e => e.style.display !== 'none' && !e.style.top);
ok(noTop.length === 0, 'top 미설정 항목', noTop.length + '건');

console.log('\n── 4. 배율별 등급 필터');
[[0.5, 1], [1.0, 1], [1.5, 2], [2.5, 3], [4, 3]].forEach(([s, expectTier]) => {
  w.__t.S = s; w.__t.refresh();
  const shown = $$('.ev').filter(e => e.style.display !== 'none');
  const bad = shown.filter(e => {
    const lane = C.lanes.find(l => l.t === e.dataset.lane);
    const item = lane && C[lane.src].find(x => String(x.y) === e.dataset.yr && x.t === e.dataset.title);
    return item && (item.r || 2) > expectTier;
  });
  ok(bad.length === 0, '배율 ' + s + '에서 등급 초과 노출', bad.length + '건');
  ok(w.__t.curTier() === expectTier, '배율 ' + s + '의 등급 계산이 다름', w.__t.curTier() + '≠' + expectTier);
  ok(shown.length > 0, '배율 ' + s + '에서 보이는 항목이 없음');
});
w.__t.S = 1; w.__t.refresh();

console.log('\n── 5. 같은 줄 겹침 (배치 알고리즘)');
let overlap = 0;
$$('.row').forEach(row => {
  const items = [...row.querySelectorAll('.ev,.span,.flow,.thres')]
    .filter(e => e.style.display !== 'none')
    .map(e => ({ t: e.style.top, l: parseFloat(e.style.left) || 0, w: parseFloat(e.style.width) || 60 }));
  const byRow = {};
  items.forEach(i => (byRow[i.t] = byRow[i.t] || []).push(i));
  Object.values(byRow).forEach(arr => {
    arr.sort((a, b) => a.l - b.l);
    for (let i = 1; i < arr.length; i++) if (arr[i].l < arr[i - 1].l + 6) overlap++;
  });
});
ok(overlap === 0, '같은 줄에서 겹치는 항목', overlap + '건');

console.log('\n── 6. 상세 패널');
[['.ev', '사건'], ['.span', '사조'], ['.flow', '흐름'], ['.thres', '문턱']].forEach(([sel, name]) => {
  const el = $$(sel).find(e => e.style.display !== 'none') || $(sel);
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const open = $('#detail').classList.contains('open');
  const body = $('#d-body').textContent.trim();
  ok(open && body.length > 5, name + ' 상세 패널 미작동', open ? '본문 ' + body.length + '자' : '안 열림');
});
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
ok(!$('#detail').classList.contains('open'), 'Esc로 상세 패널이 닫히지 않음');

console.log('\n── 7. 탭');
['tl', 'th', 'pe', 'tr', 'hv'].forEach(k => {
  d.getElementById('tab-' + k).click();
  const v = d.getElementById({ tl: 'vtl', th: 'vth', pe: 'vpe', tr: 'vtr', hv: 'vhv' }[k]);
  ok(!v.hidden, '탭 ' + k + ' 전환 실패');
  const others = ['vtl', 'vth', 'vpe', 'vtr', 'vhv'].filter(x => x !== v.id);
  ok(others.every(x => d.getElementById(x).hidden), '탭 ' + k + '에서 다른 뷰가 남아 있음');
});
d.getElementById('tab-tl').click();

console.log('\n── 8. 검색');
const queries = ['칼빈', '칼뱅', '어거스틴', '전가', '일반은총', '오웬', '도르트', '아파르트헤이트', '측천무후'];
queries.forEach(q => {
  const f = d.getElementById('find');
  f.value = q;
  w.__t.applyFilter();
  const hits = $$('.hit').length;
  ok(hits > 0, '검색어 "' + q + '" 결과 없음');
});
d.getElementById('find').value = '';
w.__t.applyFilter();
ok($$('.dim').length === 0, '검색 해제 후에도 흐려진 항목이 남음');

console.log('\n── 9. 깊은 링크');
try {
  const w2 = boot({ url: 'https://x/?y=1517' });
  ok(w2.__t.S >= 1.5, '?y= 진입 시 배율이 오르지 않음', 'S=' + w2.__t.S);
  ok(w2.document.querySelectorAll('.ev').length > 0, '?y= 진입 시 렌더 실패');
} catch (e) { ok(false, '깊은 링크 기동 실패', e.message); }

console.log('\n── 10. 기본 배율에서 모든 레인이 읽히는가');
w.__t.S = 1; w.__t.refresh();
C.lanes.filter(l => l.k === 'ev').forEach(l => {
  const t1 = C[l.src].filter(e => e.r === 1).length;
  ok(t1 >= 4, '레인 「' + l.t + '」의 1급이 부족해 기본 배율에서 비어 보임', t1 + '개');
});
{
  const totalT1 = C.lanes.filter(l => l.k === 'ev').reduce((s, l) => s + C[l.src].filter(e => e.r === 1).length, 0);
  console.log('  1급 합계 ' + totalT1 + '개 · 레인당 평균 ' +
    (totalT1 / C.lanes.filter(l => l.k === 'ev').length).toFixed(1) + '개');
}

console.log('\n── 11. 배율별 화면 부담');
[[1, 400], [1.6, 700], [2.5, 1100], [4, 1400]].forEach(([s, cap]) => {
  w.__t.S = s; w.__t.refresh();
  const vis = [...d.querySelectorAll('.ev,.span,.flow,.thres')].filter(e => e.style.display !== 'none').length;
  ok(vis <= cap, '배율 ' + s + '에서 동시 표시 요소가 과다', vis + ' > ' + cap);
  console.log('  배율 ' + s + ' → 동시 표시 ' + vis + '개');
});
w.__t.S = 1; w.__t.refresh();

console.log('\n── 12. 쟁점·해석·연대주석 렌더');
const withX = [];
C.lanes.filter(l => l.k === 'ev').forEach(l => C[l.src].forEach(e => { if (e.x) withX.push([l.t, e]); }));
let xErr = 0;
withX.forEach(([lane, item]) => {
  const el = [...d.querySelectorAll('.ev')].find(e => e.dataset.title === item.t);
  if (!el) { xErr++; return; }
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const body = $('#d-body').innerHTML;
  if (!/쟁점|경계|견해 차이/.test(body)) xErr++;
  if (item.x.r && !body.includes('응답')) xErr++;
  if (item.i && !body.includes('개혁주의적 읽기')) xErr++;
  if (item.dt && !body.includes('연대에 관하여')) xErr++;
});
ok(xErr === 0, '쟁점·해석·연대주석 렌더 누락', xErr + '건 / ' + withX.length + '항목');
console.log('  쟁점 ' + withX.length + '개 항목의 패널 내용 검사 완료');

console.log('\n── 13. 문턱 해부 완전성');
let thErr = 0;
[...d.querySelectorAll('.thres')].forEach(el => {
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const b = $('#d-body').innerHTML;
  ['무너진 확실성', '균열', '피할 수 없는 질문', '새 대답', '치른 대가'].forEach(k => { if (!b.includes(k)) thErr++; });
});
ok(thErr === 0, '문턱 해부 단계 누락', thErr + '건');

console.log('\n── 14. 접근성');
ok($$('.ev[tabindex]').length === $$('.ev').length, 'tabIndex 미설정 항목 존재');
ok($$('.ev[aria-label]').length === $$('.ev').length, 'aria-label 미설정 항목 존재');
ok($$('nav button[role=tab]').length >= 5, '탭 role 누락');

console.log('\n' + (fail ? '✗ 실패 ' + fail + '건 · 통과 ' + pass + '건' : '✓ 전부 통과 (' + pass + '건)'));
process.exit(fail ? 1 : 0);
