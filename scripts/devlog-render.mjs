/**
 * scripts/devlog-render.mjs
 *
 * 개발 로그(devlog) HTML 파일 생성 및 인덱스 갱신 스크립트이다.
 *
 * 역할 요약:
 *  chronicle 스킬의 `/devlog` 커맨드가 호출하는 스크립트로, 특정 날짜의 개발 활동을
 *  정형화된 HTML 파일로 렌더링하고 인덱스(index.html)를 자동 갱신한다.
 *  같은 날 여러 번 실행해도 파일이 덮어쓰여지지 않으며 -2, -3 ... 접미사로 자동 순번이 붙는다.
 *
 * 공개 내보내기(exports):
 *  - nextDevlogPath(existing, date): 중복되지 않는 다음 devlog 파일명을 계산한다.
 *  - renderDevlogHtml({ title, date, sections }): devlog HTML 파일 내용을 생성한다.
 *
 * CLI 사용 예:
 *  ```
 *  node scripts/devlog-render.mjs --date 2024-01-15
 *  echo '{"title":"오늘 작업","sections":[{"heading":"요약","html":"<p>...</p>"}]}' \
 *    | node scripts/devlog-render.mjs --date 2024-01-15
 *  ```
 *
 * stdin JSON 인터페이스:
 *  chronicle 스킬이 devlog 내용을 JSON으로 stdin에 전달할 수 있다.
 *  형식: `{ "title": "제목", "sections": [{ "heading": "섹션명", "html": "<p>...</p>" }] }`
 *  stdin이 없거나 유효하지 않은 JSON이면 빈 내용으로 폴백하므로 stdin 없이도 동작한다.
 *
 * 사용처:
 *  - chronicle 스킬의 `/devlog` 커맨드에서 --date와 함께 호출한다.
 *
 * 읽기 대상: cfg.devlog.dir 내의 기존 HTML 파일 목록, /dev/stdin (선택적 JSON).
 * 쓰기 대상: cfg.devlog.dir/{date}.html (또는 {date}-2.html 등), cfg.devlog.dir/index.html.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { readIfExists, writeFile, replaceAnchored } from './lib/fsutil.mjs';

/**
 * devlog 인덱스(index.html)에서 devlog 목록 블록을 감싸는 HTML 마커 쌍.
 * replaceAnchored()가 이 두 마커 사이의 <ul> 목록을 멱등적으로 교체한다.
 */
const IDX_START = '<!-- chronicle:devlog-list -->';
const IDX_END = '<!-- /chronicle:devlog-list -->';

/**
 * 동일 날짜의 devlog 파일이 이미 존재할 때 중복되지 않는 다음 파일명을 계산한다.
 *
 * @param {string[]} existing - devlog 디렉터리에 이미 존재하는 HTML 파일명 배열.
 *   예: ['2024-01-15.html', '2024-01-15-2.html', '2024-01-16.html']
 * @param {string} date - devlog 날짜 문자열. ISO 형식 권장. 예: '2024-01-15'.
 * @returns {string} 중복되지 않는 새 devlog 파일명. 예: '2024-01-15-3.html'.
 *
 * 순번 부여 알고리즘 (-2/-3/-N 접미사 방식):
 *  1. `${date}.html`이 existing에 없으면 → 기본 파일명(`${date}.html`)을 반환한다.
 *  2. 이미 있으면 n=2부터 시작하여 `${date}-${n}.html`이 없을 때까지 n을 증가시킨다.
 *     예: 2024-01-15.html, 2024-01-15-2.html이 있으면 → 2024-01-15-3.html을 반환.
 *
 * 이 방식은 같은 날 여러 번 /devlog를 실행해도 기존 파일을 덮어쓰지 않음을 보장한다.
 * magicJar의 개발일지 정책("덮어쓰기 금지, 누적")과 일치하는 설계다.
 */
export function nextDevlogPath(existing, date) {
  if (!existing.includes(`${date}.html`)) return `${date}.html`; // 기본 파일명이 사용 가능하면 바로 반환.
  let n = 2;
  // -2, -3, -4 ... 순서로 사용 가능한 번호를 찾는다.
  while (existing.includes(`${date}-${n}.html`)) n++;
  return `${date}-${n}.html`; // 사용 가능한 첫 번째 순번 파일명을 반환.
}

/**
 * HTML 특수문자를 이스케이프하여 XSS 및 HTML 파싱 오류를 방지한다.
 *
 * @param {string} s - 이스케이프할 문자열.
 * @returns {string} &, <, >가 각각 &amp;, &lt;, &gt;로 교체된 안전한 문자열.
 *
 * renderDevlogHtml()이 <title>과 <h1>, <h2> 등에 동적 데이터를 삽입할 때
 * 반드시 이 함수를 통해 이스케이프한다. 섹션 본문(s.html)은 이미 HTML이므로
 * 이스케이프하지 않고 직접 삽입한다(호출자가 안전한 HTML을 제공한다고 가정).
 */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * devlog 데이터를 완성된 HTML 파일 내용으로 렌더링한다.
 *
 * @param {object} options - 렌더링에 필요한 데이터 객체.
 * @param {string} options.title - devlog 제목. <title> 태그와 <h1> 헤딩에 사용된다.
 *   HTML 특수문자가 자동으로 이스케이프된다.
 * @param {string} options.date - devlog 날짜 문자열. <em> 태그로 강조 표시된다.
 *   HTML 특수문자가 자동으로 이스케이프된다.
 * @param {Array<{heading: string, html: string}>} options.sections - 섹션 배열.
 *   각 섹션은 heading(헤딩 텍스트, 이스케이프됨)과 html(본문 HTML, 그대로 삽입)을 가진다.
 * @returns {string} 완성된 HTML 문서 문자열. 항상 개행 1개로 끝난다.
 *
 * HTML 구조:
 *  - <!doctype html>: HTML5 DOCTYPE.
 *  - <meta charset="utf-8">: UTF-8 인코딩 선언.
 *  - <meta name="viewport">: 모바일 반응형 뷰포트 설정.
 *  - <title>: "제목 — 날짜" 형식의 브라우저 탭 제목.
 *  - 인라인 <style>: 가독성 높은 최소 CSS. 외부 파일 의존성이 없어 이식성이 뛰어나다.
 *    * 최대 너비 820px, 가운데 정렬, 시스템 폰트 스택.
 *    * <h1>에 아래쪽 구분선, <h2>에 회색 색상, <code>에 배경색.
 *  - 섹션: 각 sections 항목을 <section><h2>헤딩</h2>본문HTML</section>으로 렌더링.
 *
 * 주의: s.html은 이미 HTML 마크업이므로 esc() 없이 그대로 삽입한다.
 * 호출자(chronicle 스킬)가 안전한 HTML만 제공한다고 가정한다.
 */
export function renderDevlogHtml({ title, date, sections }) {
  // 각 섹션을 <section><h2>헤딩</h2>본문</section> 형태로 변환한다.
  const body = sections.map((s) =>
    `  <section>\n    <h2>${esc(s.heading)}</h2>\n    ${s.html}\n  </section>`
  ).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(date)}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
  h1 { border-bottom: 2px solid #eee; padding-bottom: .4rem; }
  section { margin: 1.5rem 0; }
  h2 { color: #444; font-size: 1.15rem; }
  code { background: #f4f4f4; padding: .1rem .3rem; border-radius: 3px; }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p><em>${esc(date)}</em></p>
${body}
</body>
</html>
`;
}

/**
 * devlog 목록 HTML을 포함한 인덱스(index.html) 파일 내용을 생성한다.
 *
 * @param {string[]} files - devlog 디렉터리의 모든 HTML 파일명 배열(index.html 제외).
 * @returns {string} 완성된 index.html 문자열.
 *
 * 렌더링 방식:
 *  1. files를 역순 정렬(최신 날짜가 위에 오도록)하여 <li><a> 목록을 만든다.
 *     각 항목의 href는 파일명 그대로, 표시 텍스트는 .html 확장자를 제거한 날짜 문자열.
 *  2. 기본 index.html 쉘(shell)을 만든다. 이 쉘에는 IDX_START/IDX_END 마커가 포함된다.
 *  3. replaceAnchored()로 마커 사이에 목록을 삽입한다.
 *     단순히 문자열을 합치는 것이 아닌 replaceAnchored를 사용하므로
 *     인덱스 파일을 직접 편집한 경우에도 마커 사이만 갱신된다.
 *
 * 이 함수는 내부 헬퍼이므로 공개 내보내기에 포함되지 않는다.
 */
function renderIndex(files) {
  // 역순 정렬하여 최신 devlog가 목록 상단에 오도록 한다.
  const items = files.sort().reverse()
    .map((f) => `  <li><a href="${f}">${f.replace(/\.html$/, '')}</a></li>`).join('\n');
  const list = `<ul>\n${items}\n</ul>`;
  // 기본 index.html 쉘. IDX_START/IDX_END 마커 사이에 목록이 삽입된다.
  const shell = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Devlog Index</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem}</style>
</head><body>
<h1>Devlog</h1>
${IDX_START}
${IDX_END}
</body></html>
`;
  // replaceAnchored로 쉘의 마커 사이에 목록을 삽입한다(멱등 연산).
  return replaceAnchored(shell, IDX_START, IDX_END, list);
}

/**
 * CLI 진입점: --date와 stdin JSON을 읽어 devlog HTML과 index.html을 생성한다.
 *
 * @param {string[]} argv - process.argv.slice(2)로 전달되는 CLI 인수 배열.
 *
 * 동작 흐름:
 *  1. --date와 --config 인수를 파싱한다.
 *  2. --date가 없으면 stderr에 오류를 출력하고 exit 1로 종료한다.
 *  3. loadConfig()로 설정을 로드한다.
 *  4. /dev/stdin을 통해 JSON 데이터를 읽는다:
 *     - stdin에 유효한 JSON이 있으면 파싱하여 title과 sections를 가져온다.
 *     - stdin이 없거나 유효하지 않은 JSON이면 빈 객체({})로 폴백한다.
 *     - /dev/stdin은 Unix의 특수 경로로, 파이프 입력을 파일처럼 읽을 수 있다.
 *  5. devlog 디렉터리의 기존 HTML 파일 목록을 읽는다(index.html 제외).
 *     디렉터리가 없으면 빈 배열로 폴백한다.
 *  6. nextDevlogPath()로 중복 없는 새 파일명을 계산한다.
 *  7. renderDevlogHtml()로 새 devlog HTML을 생성하고 writeFile()로 저장한다.
 *  8. renderIndex()로 index.html을 갱신하고 writeFile()로 저장한다.
 *     기존 HTML 목록([...existing, fname])에 새 파일명을 추가해 인덱스를 갱신한다.
 *  9. stderr에 기록된 파일 경로를 출력한다.
 */
function main(argv) {
  let config, date;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') config = argv[++i];
    else if (argv[i] === '--date') date = argv[++i];
  }
  if (!date) { process.stderr.write('--date YYYY-MM-DD required\n'); process.exit(1); }
  const cfg = loadConfig({ cwd: process.cwd(), path: config });
  let data = {};
  try {
    // /dev/stdin을 통해 chronicle 스킬이 전달하는 JSON 데이터를 읽는다.
    // JSON에는 title(제목)과 sections(섹션 배열)이 포함된다.
    const stdin = readIfExists('/dev/stdin');
    if (stdin && stdin.trim()) data = JSON.parse(stdin); // 유효한 JSON이면 파싱.
  } catch { /* no stdin or invalid JSON — fall back to empty */ } // stdin 없거나 JSON 오류 시 빈 객체 유지.
  const dir = join(process.cwd(), cfg.devlog.dir);
  let existing = [];
  // 디렉터리가 없거나 읽을 수 없으면 예외를 잡아 빈 배열로 폴백한다(우아한 실패).
  try { existing = readdirSync(dir).filter((f) => /\.html$/.test(f) && f !== 'index.html'); } catch {}
  const fname = nextDevlogPath(existing, date); // 중복 없는 새 파일명 계산.
  // 새 devlog HTML을 생성하고 저장한다. title이 없으면 'Devlog'를, sections가 없으면 []를 사용.
  writeFile(join(dir, fname), renderDevlogHtml({ title: data.title || 'Devlog', date, sections: data.sections || [] }));
  // 기존 목록에 새 파일을 추가하여 index.html을 갱신한다.
  writeFile(join(dir, 'index.html'), renderIndex([...existing, fname]));
  process.stderr.write(`wrote ${cfg.devlog.dir}/${fname}\n`);
}

/**
 * 이 파일이 직접 실행될 때만 main()을 호출한다.
 * 다른 모듈에서 import 시에는 main()이 실행되지 않으므로 사이드이펙트가 없다.
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
