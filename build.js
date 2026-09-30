/* 정적 페이지 생성기
   node build.js            → 기본 주소로 생성
   node build.js <사이트주소> → 그 주소로 생성 (배포 후 한 번 다시 돌리면 됨) */

const fs = require('fs'), path = require('path');
global.window = {};
require('./data.js');
const C = window.CHRONO;

const SITE = (process.argv[2] || 'https://ksamjo123.github.io/world.history').replace(/\/$/, '');
const OUT = __dirname;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
/* 받침 여부로 조사를 고른다 */
function josa(w, withBatchim, without) {
  const c = w.trim().charCodeAt(w.trim().length - 1);
  if (c < 0xAC00 || c > 0xD7A3) return without;
  return (c - 0xAC00) % 28 ? withBatchim : without;
}
const clip = (s, n) => strip(s).length > n ? strip(s).slice(0, n - 1) + '…' : strip(s);

/* ---------- 슬러그 ---------- */
const DIA = { 'é': 'e', 'è': 'e', 'ë': 'e', 'ø': 'o', 'ü': 'u', 'ö': 'o', 'ä': 'a', 'ç': 'c', 'ñ': 'n', 'í': 'i', 'á': 'a', 'ó': 'o', 'ú': 'u', 'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u' };
function slug(s) {
  return s.split('/')[0].toLowerCase().replace(/[^\x00-\x7f]/g, c => DIA[c] || '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
}
const TH_SLUG = ['patristic-theology', 'scholasticism', 'reformation', 'rationalism', 'enlightenment', 'modern-theology', 'neo-orthodoxy'];
const TR_SLUG = ['grace-and-free-will', 'authority-of-scripture', 'faith-and-reason', 'church-and-state', 'trinity-and-christology'];

const used = {};
C.people.forEach(p => {
  let s = slug(p.o || p.n);
  if (used[s]) s += '-' + (++used[s]); else used[s] = 1;
  p.slug = s;
});
C.thresholds.forEach((t, i) => t.slug = TH_SLUG[i] || 'threshold-' + (i + 1));
C.threads.forEach((t, i) => t.slug = TR_SLUG[i] || 'thread-' + (i + 1));

/* ---------- 공통 껍데기 ---------- */
function page({ url, title, desc, h1, kind, dates, body, jsonld }) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="동기 연표">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}/${url}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=IBM+Plex+Sans+KR:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../doc.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<div class="top"><a href="../">동기 연표</a><span>사상과 사건 2000년</span></div>
<main>
<p class="kind">${esc(kind)}</p>
<h1>${h1}</h1>
${dates ? '<p class="dates">' + esc(dates) + '</p>' : ''}
${body}
</main>
<footer>이 문서는 <a href="../">동기 연표</a>의 일부입니다. 서기 1년부터 오늘까지 신학·철학·정치·과학과 이슬람·동아시아·한국에서 무엇이 동시에 일어났는지를 한 장에 놓고 비교합니다.</footer>
</body>
</html>`;
}

const rel = (title, items) => items.length
  ? `<div class="rel"><h2>${title}</h2><ul>${items.map(i =>
    `<li><a href="${i.href}">${esc(i.t)}</a>${i.s ? ' <small>' + esc(i.s) + '</small>' : ''}</li>`).join('')}</ul></div>`
  : '';

const mkdir = d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); };
['t', 's', 'p'].forEach(d => mkdir(path.join(OUT, d)));
const urls = [];
const write = (u, html) => { fs.writeFileSync(path.join(OUT, u), html); urls.push(u); };

/* ---------- 문턱 페이지 ---------- */
C.thresholds.forEach((t, i) => {
  const desc = `${t.a}–${t.b}년. ${clip(t.old, 60)} 이 확실성이 무너지고 "${clip(t.q, 50)}"라는 물음이 남았을 때 ${(n => n + josa(n, '이', '가'))(t.t.replace(/(이|가) 열리다$/, ''))} 시작됩니다.`;
  const near = C.threads.filter(x => x.s.some(s => s[0] >= t.a - 120 && s[0] <= t.b + 120))
    .map(x => ({ href: '../s/' + x.slug + '.html', t: x.t, s: '주제 계보' }));
  const ppl = C.people.filter(p => p.b >= t.a && p.a <= t.b)
    .slice(0, 8).map(p => ({ href: '../p/' + p.slug + '.html', t: p.n, s: p.a + '–' + p.b }));
  const others = C.thresholds.filter((_, j) => j !== i)
    .map(x => ({ href: x.slug + '.html', t: x.t, s: x.a + '–' + x.b }));

  write(`t/${t.slug}.html`, page({
    url: `t/${t.slug}.html`, title: `${t.t} — ${t.a}–${t.b} | 동기 연표`, desc,
    kind: '시대의 문턱', h1: esc(t.t), dates: `${t.a} – ${t.b}년`,
    body:
      `<p class="lede">사조는 누군가 새로운 생각을 해내서 열리지 않습니다. 낡은 답이 작동을 멈추고, 피할 수 없는 물음이 남고, 거기에 누군가 대답할 때 열립니다. 아래는 그 과정을 네 단계로 나눈 것입니다.</p>
<div class="st">무너진 확실성</div><div class="bk old">${esc(t.old)}</div>
<div class="st">균열</div><div class="bk crk">${t.cr.map(c => `<div class="cl"><b>${esc(c[0])}</b><span>${esc(c[1])}</span></div>`).join('')}</div>
<div class="st">피할 수 없는 질문</div><p class="qz">${esc(t.q)}</p>
<div class="st">새 대답 — 여기서 시대가 열린다</div><div class="bk ans">${esc(t.ans)}</div>
<div class="st">치른 대가</div><p class="cost">${esc(t.cost)}</p>
${t.i ? `<div class="st">개혁주의적 읽기</div><div class="bk rf">${esc(t.i)}</div>` : ''}
<a class="cta" href="../?y=${t.a}">연표에서 ${t.a}년 전후 보기 →</a>`
      + rel('이 시기의 인물', ppl) + rel('이어지는 주제', near) + rel('다른 문턱', others),
    jsonld: {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: t.t, description: desc, inLanguage: 'ko',
      about: { '@type': 'Thing', name: t.t }, isPartOf: { '@type': 'WebSite', name: '동기 연표', url: SITE }
    }
  }));
});

/* ---------- 주제 계보 페이지 ---------- */
C.threads.forEach((t, i) => {
  const desc = `${t.d} ${t.s[0][0]}년 ${t.s[0][1]}부터 ${t.s[t.s.length - 1][0]}년까지 ${t.s.length}단계로 따라갑니다.`;
  const others = C.threads.filter((_, j) => j !== i).map(x => ({ href: x.slug + '.html', t: x.t }));
  const ths = C.thresholds.filter(x => t.s.some(s => s[0] >= x.a - 120 && s[0] <= x.b + 120))
    .map(x => ({ href: '../t/' + x.slug + '.html', t: x.t, s: x.a + '–' + x.b }));

  write(`s/${t.slug}.html`, page({
    url: `s/${t.slug}.html`, title: `${t.t} — 계보로 읽기 | 동기 연표`, desc,
    kind: '주제 계보', h1: esc(t.t),
    dates: `${t.s[0][0]} – ${t.s[t.s.length - 1][0]}년 · ${t.s.length}단계`,
    body: `<p class="lede">${esc(t.d)} 연표가 같은 시대를 가로로 비교하는 읽기라면, 이 문서는 하나의 물음이 세기를 건너 어떻게 이어지는지를 세로로 따라가는 읽기입니다.</p>`
      + t.s.map(s => `<div class="step"><div class="sy">${s[0]}</div><div class="sb"><b>${esc(s[1])}</b><span>${esc(s[2])}</span></div></div>`).join('')
      + `<a class="cta" href="../?y=${t.s[0][0]}">연표에서 보기 →</a>`
      + rel('관련된 문턱', ths) + rel('다른 주제 계보', others),
    jsonld: {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: t.t, description: desc, inLanguage: 'ko',
      isPartOf: { '@type': 'WebSite', name: '동기 연표', url: SITE }
    }
  }));
});

/* ---------- 인물 페이지 ---------- */
const LANES = ['theology', 'philosophy', 'politics', 'science', 'islam', 'eastasia', 'korea', 'world'];
C.people.forEach(p => {
  const key = p.n.replace(/^(존|장|칼|이|알 )/, '').trim();
  const evs = [];
  LANES.forEach(k => C[k].forEach(e => {
    if ((e.t + ' ' + (e.n || '') + ' ' + (e.k || '')).includes(key) || (e.y >= p.a && e.y <= p.b && (e.t).includes(p.n)))
      evs.push({ y: e.y, t: e.t, n: e.n });
  }));
  const seen = new Set();
  const ev = evs.filter(e => !seen.has(e.y + e.t) && seen.add(e.y + e.t)).sort((a, b) => a.y - b.y).slice(0, 8);
  const ths = C.thresholds.filter(t => p.b >= t.a && p.a <= t.b)
    .map(t => ({ href: '../t/' + t.slug + '.html', t: t.t, s: t.a + '–' + t.b }));
  const trs = C.threads.filter(t => t.s.some(s => s[0] >= p.a && s[0] <= p.b))
    .map(t => ({ href: '../s/' + t.slug + '.html', t: t.t, s: '주제 계보' }));
  const desc = `${p.n}(${p.o}, ${p.a}–${p.b}). ${clip(p.d, 90)}`;

  write(`p/${p.slug}.html`, page({
    url: `p/${p.slug}.html`, title: `${p.n} (${p.a}–${p.b}) | 동기 연표`, desc,
    kind: '인물', h1: esc(p.n), dates: `${esc(p.o)} · ${p.a} – ${p.b}년`,
    body: `<p class="lede">${esc(p.d)}</p>`
      + (p.w && p.w.length ? `<h2>주요 저작</h2><ul class="works">${p.w.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '')
      + (ev.length ? `<h2>연표에서</h2><ul class="grid">${ev.map(e => `<li><b>${e.y} · ${esc(e.t)}</b>${e.n ? '<p>' + esc(e.n) + '</p>' : ''}</li>`).join('')}</ul>` : '')
      + `<a class="cta" href="../?y=${p.a}">연표에서 ${p.a}년 전후 보기 →</a>`
      + rel('생애가 걸친 문턱', ths) + rel('관련 주제', trs),
    jsonld: {
      '@context': 'https://schema.org', '@type': 'Person',
      name: p.n, alternateName: p.o, description: strip(p.d),
      birthDate: String(p.a), deathDate: String(p.b)
    }
  }));
});

/* ---------- 역사관 페이지 ---------- */
{
  const P = C.perspective;
  const sec = (title, arr) => `<h2>${esc(title)}</h2>` + arr.map(x =>
    `<div class="ax"><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('');
  const desc = '이 연표는 개혁주의 관점에서 엮였습니다. 섭리·언약·말씀의 규범성·일반은총·전적 타락·semper reformanda·영역 주권이라는 전제와, 스스로 경계하는 것들, 편을 들지 않는 영역, 서지 방침, 그리고 「성경」·「칼빈」처럼 어느 말을 택했고 왜 택했는지를 밝힙니다.';
  const html = page({
    url: 'perspective.html', title: '역사를 보는 자리 — 개혁주의 역사관 | 동기 연표', desc,
    kind: '관점 선언', h1: esc(P.t),
    dates: `전제 ${P.axioms.length} · 경계 ${P.guards.length} · 편들지 않는 것 ${P.limits.length} · 용어 ${P.terms.length}`,
    body: `<p class="lede">${esc(P.lede)}</p>` + sec('전제', P.axioms) +
      sec('스스로 경계하는 것', P.guards) + sec('편을 들지 않는 것', P.limits) +
      `<h2>연결이 주장하는 것</h2><p class="cost" style="margin:0 0 14px">${esc(P.links.lede)}</p>` +
      P.links.items.map(x => `<div class="ax"><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('') +
      `<h2>경계 표시를 읽는 법</h2><p class="cost" style="margin:0 0 14px">${esc(P.warn.lede)}</p>` +
      P.warn.items.map(x => `<div class="ax"><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('') +
      `<h2>정치사의 자리</h2><p class="cost" style="margin:0 0 14px">${esc(P.political.lede)}</p>` +
      P.political.items.map(x => `<div class="ax"><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('') +
      `<h2>쓰는 말</h2><p class="cost" style="margin:0 0 14px">${esc(P.termsLede)}</p>` +
      P.terms.map(t => `<div class="ax"><b>${esc(t[0])} <span style="font-weight:300;color:var(--ink-soft)">— ${esc(t[1])} 대신</span></b><span>${esc(t[2])}</span></div>`).join('') +
      `<p class="cost" style="margin-top:28px;border-top:1px solid var(--rule);padding-top:18px">${esc(P.close)}</p>` +
      `<h2>${esc(C.method.t)}</h2><p class="cost" style="margin:0 0 14px">${esc(C.method.lede)}</p>` +
      C.method.items.map(x => `<div class="ax"><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('') +
      `<a class="cta" href="./">연표로 →</a>` +
      rel('이 관점으로 읽은 문턱', C.thresholds.map(t => ({ href: 't/' + t.slug + '.html', t: t.t, s: t.a + '–' + t.b }))),
    jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: P.t, description: desc, inLanguage: 'ko' }
  }).replace(/\.\.\/doc\.css/, 'doc.css').replace(/href="\.\.\/"/g, 'href="./"');
  fs.writeFileSync(path.join(OUT, 'perspective.html'), html);
  urls.push('perspective.html');
}

/* ---------- 목차 ---------- */
const li = (href, t, s) => `<li><b><a href="${href}">${esc(t)}</a></b>${s ? '<p>' + esc(s) + '</p>' : ''}</li>`;
const indexHtml = page({
  url: 'read.html', title: '전체 문서 목차 | 동기 연표',
  desc: '시대의 문턱 7편, 주제 계보 5편, 인물 ' + C.people.length + '명. 서기 1년부터 오늘까지의 사상사를 문턱·주제·인물 세 갈래로 읽습니다.',
  kind: '목차', h1: '전체 문서',
  dates: `문턱 ${C.thresholds.length}편 · 계보 ${C.threads.length}편 · 인물 ${C.people.length}명`,
  body: `<p class="lede">연표는 같은 시대를 가로로 비교합니다. 아래 문서들은 그 연표를 세 방향으로 풀어 읽은 것입니다. 이 연표가 어느 자리에서 역사를 보는지는 <a href="perspective.html">역사를 보는 자리</a>에 밝혀 두었습니다.</p>
<h2>관점</h2><ul class="grid">${li('perspective.html', '역사를 보는 자리 — 개혁주의 역사관', '무엇을 전제하고, 무엇을 경계하며, 어디서 내부 이견이 갈리는가')}</ul>
<h2>시대의 문턱</h2><ul class="grid">${C.thresholds.map(t => li('t/' + t.slug + '.html', t.t, `${t.a}–${t.b} · ${clip(t.q, 60)}`)).join('')}</ul>
<h2>주제 계보</h2><ul class="grid">${C.threads.map(t => li('s/' + t.slug + '.html', t.t, clip(t.d, 70))).join('')}</ul>
<h2>인물</h2><ul class="grid">${[...C.people].sort((a, b) => a.a - b.a).map(p => li('p/' + p.slug + '.html', `${p.n} (${p.a}–${p.b})`, clip(p.d, 70))).join('')}</ul>`,
  jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: '전체 문서 목차', inLanguage: 'ko' }
}).replace(/\.\.\/doc\.css/, 'doc.css').replace(/href="\.\.\/"/g, 'href="./"');
fs.writeFileSync(path.join(OUT, 'read.html'), indexHtml);
urls.push('read.html');

/* ---------- sitemap · robots ---------- */
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  [''].concat(urls).map(u =>
    ` <url><loc>${SITE}/${u}</loc><lastmod>${today}</lastmod>` +
    `<priority>${u === '' ? '1.0' : u === 'read.html' ? '0.9' : '0.7'}</priority></url>`).join('\n') +
  `\n</urlset>\n`);

fs.writeFileSync(path.join(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log('주소:', SITE);
console.log('생성된 페이지:', urls.length + 1, '(목차 1 + 문턱 ' + C.thresholds.length +
  ' + 계보 ' + C.threads.length + ' + 인물 ' + C.people.length + ' + 연표 1)');
console.log('sitemap.xml, robots.txt 작성 완료');
