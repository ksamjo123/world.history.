# 동기 연표 (Synchronological Chart)

서기 1년부터 현재까지, 신학·철학·정치·과학과 이슬람·동아시아·한국에서
무엇이 동시에 일어났는지를 한 장에 놓고 비교하는 정적 웹사이트.

## 파일 구조

    index.html   화면 뼈대와 탭
    style.css    모든 스타일
    app.js       렌더러 (여기는 손댈 일이 거의 없음)
    data.js      >>> 내용은 전부 여기에 있음 <<<

내용을 추가·수정할 때는 **data.js만** 고치면 된다.
app.js는 data.js를 읽어서 그리기만 한다.

## data.js 구조

    window.CHRONO = {
      eras       구간별 시간 축 배율   {a:시작, b:끝, w:픽셀폭, n:이름}
      lanes      연표의 가로 레인 정의  {id, t:이름, c:색, k:종류, src:데이터키}
      modes      사조 (기간)          {a, b, t:이름, n:설명}
      thresholds 시대의 문턱          {a, b, t, old, cr:[[연도,사건]], q, ans, cost}
      flows      영향 흐름 (기간)      {a, b, t, n}
      theology   신학·교회사 (사건)    {y:연도, t:제목, n:설명, r:등급, k:이명}
      philosophy / politics / science / islam / eastasia / korea / world
                 위와 같은 형식의 사건 배열
      people     인물                 {n:이름, o:원어, a:출생, b:사망, f:영역, d:설명, w:[저작]}
      threads    주제 계보            {t:제목, d:설명, s:[[연도, 제목, 설명]]}
    }

### 사건 하나 추가하기

theology 배열에 한 줄 넣으면 끝. 연도순 정렬은 필요 없다.

    {"y":1647,"t":"오웬 『죽음의 죽음』","n":"제한속죄의 가장 정교한 변호.",
     "r":2,"k":"Owen 제한속죄 DeathOfDeath"}

`r`(등급)은 배율에 따른 표시 층. 1 = 항상 보임, 2 = 1.3배부터, 3 = 2.2배부터.
생략하면 2로 처리된다.

`k`(이명)는 검색 전용 보조 키워드. 다른 한글 표기, 원어, 별칭을 공백으로
나열하면 그 말로도 찾힌다. 검색 시 제목에 준하는 점수를 받는다.

### 레인 하나 추가하기

1. data.js에 새 배열을 만든다:  `"music": [{"y":1685,"t":"바흐 출생","n":"..."}]`
2. lanes에 한 줄 추가:  `{"id":"music","t":"음악","s":"","c":"#7B4650","k":"ev","src":"music"}`

k(종류)는 넷 중 하나: `ev` 시점 사건 · `span` 기간 · `th` 문턱 · `flow` 영향 화살표

## 정적 페이지 생성

    node build.js https://내주소

문턱·계보·인물을 각각 진짜 HTML 문서로 뽑고 sitemap.xml, robots.txt를
만든다. data.js를 고친 뒤 한 번 돌리면 문서도 같이 갱신된다.
주소를 안 주면 example.github.io 자리표시자가 들어가므로,
배포 주소가 정해지면 그 주소로 한 번 다시 돌릴 것.
(index.html 안의 example.github.io도 같이 바꿔야 한다.)

생성물: read.html(목차), t/*.html(문턱), s/*.html(계보), p/*.html(인물)

## 띄우기

정적 파일이라 서버가 필요 없다. GitHub Pages, Netlify, Cloudflare Pages
어디든 이 폴더를 그대로 올리면 주소가 나온다. 빌드 과정 없음.

로컬에서 열 때도 index.html을 브라우저로 바로 열면 된다
(data.js를 script 태그로 읽으므로 file:// 에서도 동작한다).
