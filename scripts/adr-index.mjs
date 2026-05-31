/**
 * scripts/adr-index.mjs
 *
 * ADR(Architecture Decision Record) 인덱스 생성 스크립트이다.
 *
 * 역할 요약:
 *  ADR 디렉터리(기본: docs/adr/)의 모든 마크다운 파일을 스캔하여 번호·제목·상태·날짜를
 *  추출한 뒤 마크다운 테이블로 렌더링한다. 그 결과를 README.md의 마커 사이에 멱등적으로
 *  삽입하거나 stdout으로 출력한다.
 *
 * 공개 내보내기(exports):
 *  - buildAdrIndex({ cwd, cfg }): ADR 디렉터리를 스캔하여 행(row) 배열을 반환한다.
 *  - renderTable(rows, cfg): 행 배열을 마크다운 테이블 문자열로 렌더링한다.
 *
 * CLI 사용 예:
 *  ```
 *  node scripts/adr-index.mjs --write             # README.md 인덱스 갱신
 *  node scripts/adr-index.mjs                     # stdout에 테이블 출력
 *  node scripts/adr-index.mjs --config ./my.json  # 설정 파일 명시
 *  ```
 *
 * 사용처:
 *  - chronicle 스킬(skills/adr/)의 `/adr-index` 커맨드에서 --write 옵션으로 호출한다.
 *  - index-render.mjs가 buildAdrIndex를 import해 프로젝트 인덱스 HTML 생성 시 재사용한다.
 *
 * 읽기 대상: cfg.adr.dir 내의 모든 .md 파일.
 * 쓰기 대상: cfg.adr.indexFile (README.md) — --write 플래그 사용 시에만.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { extractAdrStatus, parseFrontmatter } from './lib/md.mjs';
import { readIfExists, writeFile, replaceAnchored } from './lib/fsutil.mjs';

/**
 * ADR 인덱스를 README.md에 삽입할 때 사용하는 HTML 마커 쌍.
 * replaceAnchored()가 이 두 마커 사이의 내용을 멱등적으로 교체한다.
 * chronicle 플러그인이 생성한 블록임을 명시하는 컨벤션이다.
 */
const START = '<!-- chronicle:adr-index -->';
const END = '<!-- /chronicle:adr-index -->';

/**
 * ADR 디렉터리를 스캔하여 인덱스 테이블에 필요한 행(row) 데이터를 구축한다.
 *
 * @param {object} options - 옵션 객체.
 * @param {string} [options.cwd=process.cwd()] - 프로젝트 루트 디렉터리.
 * @param {object} options.cfg - loadConfig()가 반환한 설정 객체.
 *   cfg.adr.dir 경로를 ADR 파일 탐색 기준으로 사용한다.
 * @returns {Array<{number: number, file: string, title: string, status: string, date: string}>}
 *   번호 오름차순으로 정렬된 ADR 행 배열. 디렉터리가 없거나 비어 있으면 빈 배열 [].
 *
 * 파일 필터링 규칙:
 *  - 파일명 패턴: `/^(\d+)[-_](.+)\.md$/`
 *    * 앞부분이 숫자(ADR 번호)이고 하이픈 또는 언더스코어로 구분된 이름.
 *    * 예: `0001-initial-decision.md`, `42_refactoring.md`
 *  - README로 시작하는 파일(대소문자 무시)은 인덱스 파일 자체이므로 건너뛴다.
 *    정규식 `/^readme$/i`로 m[2](번호 제외 이름) 부분을 검사한다.
 *
 * 제목(title) 추출 전략:
 *  1. 마크다운 전문에서 `# 제목` 형식의 첫 번째 H1 헤딩을 추출한다.
 *  2. H1 헤딩이 없으면 파일명의 번호-이후 부분에서 하이픈/언더스코어를 공백으로 변환한다.
 *  3. 추출된 제목에서 `숫자. ` 또는 `숫자) ` 패턴의 번호 접두사를 제거한다.
 *     예: `# 0001. Initial Decision` → 'Initial Decision'
 *
 * 상태(status) 추출: extractAdrStatus()에 위임한다 (3단계 폴백 전략).
 * 날짜(date): 프론트매터의 date 키 값. 없으면 빈 문자열.
 *
 * 정렬: parseInt(m[1], 10)으로 파싱한 정수 번호를 기준으로 오름차순 정렬한다.
 * 문자열 정렬이 아닌 정수 정렬이므로 0010이 0009 다음에 올바르게 위치한다.
 */
export function buildAdrIndex({ cwd = process.cwd(), cfg }) {
  const dir = join(cwd, cfg.adr.dir);
  let files = [];
  // 디렉터리가 없거나 읽을 수 없으면 예외를 잡아 빈 배열을 반환한다(우아한 실패).
  try { files = readdirSync(dir); } catch { return []; }
  const rows = [];
  for (const f of files) {
    // ADR 파일명 패턴 검사: 숫자 + 구분자 + 이름.md 형식이어야 한다.
    const m = /^(\d+)[-_](.+)\.md$/.exec(f);
    // 패턴에 맞지 않거나 README 파일이면 건너뛴다(인덱스 파일 자신을 포함시키지 않음).
    if (!m || /^readme$/i.test(m[2])) continue;
    const text = readFileSync(join(dir, f), 'utf8');
    const { data } = parseFrontmatter(text);
    // H1 헤딩을 제목으로 사용하고, 없으면 파일명에서 이름 부분을 가공해 제목을 만든다.
    const titleMatch = /^#\s*(.+)$/m.exec(text);
    const rawTitle = (titleMatch ? titleMatch[1] : m[2].replace(/[-_]/g, ' ')).trim();
    rows.push({
      number: parseInt(m[1], 10),          // 정수 번호(정렬 기준).
      file: f,                              // 파일명(마크다운 링크 href로 사용).
      title: rawTitle.replace(/^\d+[.)]\s*/, ''), // 번호 접두사(예: "0001. ")를 제거한 순수 제목.
      status: extractAdrStatus(text),       // 3단계 폴백 전략으로 상태를 추출한다.
      date: data.date || '',                // 프론트매터 date 키. 없으면 빈 문자열.
    });
  }
  // 번호 오름차순으로 정렬한다(문자열 비교가 아닌 정수 비교로 순서 보장).
  rows.sort((a, b) => a.number - b.number);
  return rows;
}

/**
 * ADR 행 배열을 마크다운 테이블 문자열로 렌더링한다.
 *
 * @param {Array<{number, file, title, status, date}>} rows - buildAdrIndex()가 반환한 행 배열.
 * @param {object} cfg - loadConfig()가 반환한 설정 객체.
 *   cfg.adr.numberWidth: 번호를 몇 자리로 패딩할지 결정한다(기본 4).
 * @returns {string} 마크다운 테이블 문자열.
 *   ADR이 없어도 헤더 행은 항상 포함된다(빈 테이블 방지).
 *
 * 테이블 포맷:
 *  ```
 *  | No. | Title | Status | Date |
 *  | --- | --- | --- | --- |
 *  | 0001 | [제목](파일명.md) | Accepted | 2024-01-01 |
 *  ```
 *
 * numberWidth 적용:
 *  String(r.number).padStart(width, '0')로 번호를 고정 자릿수로 패딩한다.
 *  width=4이면 1 → '0001', 100 → '0100' 형태가 된다.
 *  마크다운 링크는 `[제목](파일명.md)` 형식으로 ADR 파일에 직접 연결된다.
 */
export function renderTable(rows, cfg) {
  const width = cfg.adr.numberWidth || 4; // 번호 패딩 자릿수. 설정이 없으면 기본값 4.
  const head = '| No. | Title | Status | Date |\n| --- | --- | --- | --- |';
  const body = rows.map((r) =>
    // 각 행: 패딩된 번호 | 마크다운 링크 제목 | 상태 | 날짜
    `| ${String(r.number).padStart(width, '0')} | [${r.title}](${r.file}) | ${r.status} | ${r.date} |`
  ).join('\n');
  // ADR이 있으면 헤더 + 본문, 없으면 헤더만 반환한다.
  return rows.length ? `${head}\n${body}` : `${head}`;
}

/**
 * CLI 진입점: 커맨드라인 인수를 파싱하고 ADR 인덱스를 빌드해 출력하거나 파일에 기록한다.
 *
 * @param {string[]} argv - process.argv.slice(2)로 전달되는 CLI 인수 배열.
 *
 * 동작 흐름:
 *  1. parseArgs()로 --write / --config 인수를 파싱한다.
 *  2. loadConfig()로 설정을 로드한다.
 *  3. buildAdrIndex()로 ADR 행 배열을 구축하고 renderTable()로 마크다운 테이블을 생성한다.
 *  4. --write 플래그:
 *     - true이면: 인덱스 파일(cfg.adr.indexFile)을 읽거나 기본 헤더로 초기화한 뒤
 *                 replaceAnchored()로 마커 사이의 테이블을 갱신하고 writeFile()로 저장한다.
 *     - false이면: 테이블을 stdout으로 출력한다(파일 변경 없음, 미리보기용).
 *  5. stderr에 기록 결과를 출력한다(stdout은 데이터 전용, 메시지는 stderr).
 *
 * 초기화 기본값 (인덱스 파일이 아직 없을 때):
 *  `# Architecture Decision Records\n\n<!-- chronicle:adr-index -->\n<!-- /chronicle:adr-index -->\n`
 *  이 형태로 파일을 만들면 다음 실행부터는 마커 사이의 테이블만 업데이트된다.
 */
function main(argv) {
  const args = parseArgs(argv);
  const cfg = loadConfig({ cwd: process.cwd(), path: args.config });
  const rows = buildAdrIndex({ cwd: process.cwd(), cfg });
  const table = renderTable(rows, cfg);
  if (args.write) {
    const idxPath = join(process.cwd(), cfg.adr.indexFile);
    // 기존 인덱스 파일을 읽는다. 없으면 마커가 포함된 기본 헤더로 초기화한다.
    const existing = readIfExists(idxPath) ?? `# Architecture Decision Records\n\n${START}\n${END}\n`;
    writeFile(idxPath, replaceAnchored(existing, START, END, table));
    process.stderr.write(`wrote ${cfg.adr.indexFile} (${rows.length} ADRs)\n`);
  } else {
    // --write 없이 실행하면 테이블을 stdout으로만 출력한다(파일 변경 없음).
    process.stdout.write(table + '\n');
  }
}

/**
 * CLI 인수 배열을 파싱하여 옵션 객체로 반환한다.
 *
 * @param {string[]} argv - process.argv.slice(2)로 전달되는 인수 배열.
 * @returns {{ write: boolean, config: string|undefined }} 파싱된 옵션 객체.
 *   - write: --write 플래그가 있으면 true. 없으면 false.
 *   - config: --config <경로>가 있으면 해당 경로 문자열. 없으면 undefined.
 *
 * 파싱 방식: 단순 선형 탐색. `--config`처럼 값을 받는 플래그는 다음 인덱스(++i)로 값을 가져온다.
 * 알 수 없는 인수는 조용히 무시한다.
 */
function parseArgs(argv) {
  const a = { write: false, config: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--write') a.write = true;
    else if (argv[i] === '--config') a.config = argv[++i]; // 다음 인수가 설정 파일 경로.
  }
  return a;
}

/**
 * 이 파일이 직접 실행될 때(Node.js ESM 모듈의 "main 모듈" 감지 패턴)만 main()을 호출한다.
 * `import { buildAdrIndex } from './adr-index.mjs'`처럼 다른 모듈에서 import할 때는
 * main()이 실행되지 않으므로 사이드이펙트가 없다.
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
