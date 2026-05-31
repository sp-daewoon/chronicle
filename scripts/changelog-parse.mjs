/**
 * scripts/changelog-parse.mjs
 *
 * CHANGELOG.md 파싱 및 조작 스크립트이다.
 *
 * 역할 요약:
 *  Keep a Changelog(https://keepachangelog.com/) 규약을 따르는 CHANGELOG.md 파일에 대해
 *  두 가지 핵심 연산을 제공한다:
 *   1. addEntry(content, type, text): [Unreleased] 섹션에 새 변경 항목을 추가한다.
 *   2. promote(content, version, date): [Unreleased] 섹션을 버전 릴리즈 섹션으로 승격하고
 *      빈 [Unreleased]를 새로 만든다.
 *
 * 공개 내보내기(exports):
 *  - EMPTY: 체인지로그가 아직 없을 때 사용할 최소 초기 템플릿 문자열.
 *  - addEntry(content, type, text): 변경 항목 추가 함수.
 *  - promote(content, version, date): 버전 릴리즈 승격 함수.
 *
 * CLI 사용 예:
 *  ```
 *  node scripts/changelog-parse.mjs add --type Fixed --text "버그 수정"
 *  node scripts/changelog-parse.mjs release --version 1.2.0 --date 2024-01-01
 *  node scripts/changelog-parse.mjs add --type Added --text "새 기능" --config ./my.json
 *  ```
 *
 * 사용처:
 *  - chronicle 스킬의 `/changelog add` 커맨드와 `/changelog release` 커맨드에서 호출한다.
 *  - release-notes.mjs가 sectionFor()를 통해 이 파일이 생성한 CHANGELOG.md를 읽는다.
 *
 * 읽기 대상: cfg.changelog.path (기본: CHANGELOG.md).
 * 쓰기 대상: cfg.changelog.path (동일 파일 갱신).
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { readIfExists, writeFile } from './lib/fsutil.mjs';

/**
 * CHANGELOG.md가 아직 없을 때 파일 초기화에 사용하는 최소 템플릿.
 *
 * Keep a Changelog 규약의 필수 구성 요소를 포함한다:
 *  - "# Changelog" 헤딩: 파일 제목.
 *  - 설명 줄: 이 파일의 목적과 따르는 규약을 명시.
 *  - "## [Unreleased]" 섹션: addEntry()가 새 항목을 삽입하는 대상 섹션.
 *
 * 주의: 이 문자열은 프로그램 출력(파일 내용)이므로 영어 그대로 유지해야 한다.
 * splitSections()가 `## ` 헤딩으로 파싱하므로 포맷을 변경하지 않는다.
 */
export const EMPTY = `# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
`;

/**
 * Keep a Changelog 규약에서 허용하는 변경 타입 목록.
 * addEntry()는 이 목록에 없는 타입을 거부하여 규약을 강제한다.
 *  - Added: 새로운 기능 추가.
 *  - Changed: 기존 기능의 변경.
 *  - Deprecated: 곧 제거될 기능.
 *  - Removed: 제거된 기능.
 *  - Fixed: 버그 수정.
 *  - Security: 보안 취약점 수정.
 */
const TYPES = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

/**
 * CHANGELOG.md 내용을 `## ` 헤딩 기준으로 머리부(head)와 섹션 배열로 분리한다.
 *
 * @param {string} content - CHANGELOG.md 전체 텍스트.
 * @returns {{ head: string, sections: Array<{header: string, body: string}> }}
 *   - head: 첫 번째 `## ` 헤딩 이전의 내용(파일 제목·설명 등).
 *   - sections: `## ` 헤딩 단위로 분리된 섹션 배열. 각 섹션은 header(헤딩 줄)와 body(본문)로 구성.
 *
 * 분리 알고리즘:
 *  1. `\n## ` 패턴의 첫 번째 발생 위치(idx)를 찾는다.
 *  2. idx까지가 head, 그 이후가 섹션 영역(rest)이다.
 *     head에 `\n`을 포함시키기 위해 `content.slice(0, idx + 1)`을 사용한다.
 *  3. rest를 `\n(?=## )`(lookahead) 패턴으로 분할해 섹션 배열을 만든다.
 *     lookahead를 사용하므로 구분자(`\n`)가 분할된 항목에 포함되지 않는다.
 *  4. 각 파트에서 첫 번째 개행 이전이 header, 이후가 body이다.
 *
 * 엣지 케이스:
 *  - `## ` 헤딩이 전혀 없으면 sections는 빈 배열이고 head가 전체 내용이 된다.
 *  - 섹션 본문이 없는 경우(헤딩 바로 다음 섹션이 이어지는 경우) body는 빈 문자열이 된다.
 *
 * 이 함수는 내부 헬퍼이므로 공개 내보내기에 포함되지 않는다.
 */
function splitSections(content) {
  // Returns { head, sections: [{header, body}] } split on "## " headings.
  const idx = content.indexOf('\n## ');
  if (idx === -1) return { head: content, sections: [] }; // 섹션 없음: 전체가 head.
  const head = content.slice(0, idx + 1); // 첫 ## 이전까지가 head. idx+1로 \n 포함.
  const rest = content.slice(idx + 1);
  // lookahead 분할: 각 ## 헤딩이 새 섹션의 시작이 된다.
  const parts = rest.split(/\n(?=## )/);
  const sections = parts.map((p) => {
    const nl = p.indexOf('\n');
    return nl === -1
      ? { header: p, body: '' }          // 헤딩만 있고 본문 없는 경우.
      : { header: p.slice(0, nl), body: p.slice(nl + 1) }; // 헤딩과 본문 분리.
  });
  return { head, sections };
}

/**
 * 분리된 head와 sections 배열을 다시 CHANGELOG.md 문자열로 재조합한다.
 *
 * @param {string} head - splitSections()가 반환한 머리부 문자열.
 * @param {Array<{header: string, body: string}>} sections - 섹션 배열.
 * @returns {string} 재조합된 CHANGELOG.md 전체 문자열. 항상 개행 1개로 끝난다.
 *
 * 재조합 방식:
 *  각 섹션을 `header + '\n' + body` 형태로 결합하고 `\n`으로 섹션 간 구분한다.
 *  마지막의 연속 개행은 단일 개행(`\n`)으로 정규화한다(.replace(/\n+$/, '\n')).
 *  이렇게 하면 addEntry()가 여러 번 호출되어도 파일 끝에 빈 줄이 누적되지 않는다.
 */
function rebuild(head, sections) {
  return head + sections.map((s) => s.header + '\n' + s.body).join('\n').replace(/\n+$/, '\n');
}

/**
 * CHANGELOG.md의 [Unreleased] 섹션에 새 변경 항목을 추가한다.
 *
 * @param {string} content - 현재 CHANGELOG.md 전체 텍스트. null/undefined이면 EMPTY로 대체.
 * @param {string} type - 변경 타입. TYPES 배열의 값 중 하나여야 한다.
 *   유효하지 않은 타입이면 즉시 Error를 던진다.
 * @param {string} text - 추가할 변경 항목 설명 문자열. 마크다운 `-` 불릿 뒤에 삽입된다.
 * @returns {string} 항목이 추가된 새 CHANGELOG.md 전체 텍스트.
 *
 * 삽입 알고리즘 (연대순 추가, chronological append):
 *
 *  1. splitSections()로 head와 sections를 분리한다.
 *  2. [Unreleased] 섹션을 찾는다. 없으면 빈 섹션을 만들어 sections 맨 앞에 추가한다.
 *     Keep a Changelog 규약에서 [Unreleased]는 항상 첫 번째 섹션이어야 한다.
 *  3. [Unreleased] 본문에 해당 type의 `### type` 소섹션이 있는지 확인한다.
 *
 *     ┌ 소섹션이 이미 있는 경우 (연대순 추가):
 *     │  정규식 `(### ${type}\n(?:- [^\n]*\n)*)` 로 기존 소섹션을 캡처한다.
 *     │  `$1- ${text}\n` 치환으로 소섹션의 마지막 항목 뒤에 새 항목을 추가한다.
 *     │  이 방식은 동일 타입 항목들이 항상 연속된 블록을 유지하게 한다.
 *     │
 *     └ 소섹션이 없는 경우 (새 소섹션 생성):
 *        기존 본문이 있으면 두 개의 빈 줄로 구분한다(Markdown 관례).
 *        기존 본문이 없으면 한 개의 빈 줄만 삽입한다.
 *        `### ${type}\n- ${text}\n` 형태로 새 소섹션을 추가한다.
 *
 *  4. rebuild()로 전체 내용을 재조합하여 반환한다.
 *
 * 엣지 케이스:
 *  - content가 null이면 EMPTY를 사용하므로 파일이 없는 상태에서도 안전하게 동작한다.
 *  - [Unreleased] 섹션 자체가 없으면 자동 생성하므로 비표준 파일도 처리한다.
 */
export function addEntry(content, type, text) {
  if (!TYPES.includes(type)) throw new Error(`invalid type: ${type}`); // 규약 외 타입 거부.
  const { head, sections } = splitSections(content || EMPTY);
  let unrel = sections.find((s) => /## \[Unreleased\]/.test(s.header));
  // [Unreleased] 섹션이 없으면 빈 섹션을 만들어 맨 앞에 삽입한다.
  if (!unrel) { unrel = { header: '## [Unreleased]', body: '' }; sections.unshift(unrel); }
  const subRe = new RegExp(`(### ${type}\n(?:- [^\n]*\n)*)`);
  if (subRe.test(unrel.body)) {
    // Append after the last existing item in the subsection (chronological order)
    // 기존 소섹션의 마지막 항목 바로 뒤에 새 항목을 삽입한다(연대순 유지).
    unrel.body = unrel.body.replace(subRe, `$1- ${text}\n`);
  } else {
    // New subsection: ensure exactly one blank line before the ### heading if prior content exists
    // 새 소섹션 추가: 기존 본문이 있으면 두 줄 공백으로 구분하고, 없으면 한 줄 공백.
    const trimmed = unrel.body.replace(/\n*$/, ''); // 기존 본문 끝 개행 제거 후 separator 제어.
    const separator = trimmed.length > 0 ? '\n\n' : '\n';
    unrel.body = trimmed + separator + `### ${type}\n- ${text}\n`;
  }
  return rebuild(head, sections);
}

/**
 * [Unreleased] 섹션을 특정 버전으로 승격(promote)하고 새 빈 [Unreleased]를 만든다.
 *
 * @param {string} content - 현재 CHANGELOG.md 전체 텍스트. null/undefined이면 EMPTY로 대체.
 * @param {string} version - 릴리즈 버전 문자열. 예: '1.2.0', '2.0.0-beta.1'.
 * @param {string} date - 릴리즈 날짜 문자열. ISO 형식 권장. 예: '2024-01-15'.
 * @returns {string} 버전 섹션이 추가된 새 CHANGELOG.md 전체 텍스트.
 *
 * 승격 알고리즘:
 *  1. splitSections()로 현재 내용을 분리한다.
 *  2. [Unreleased] 본문을 가져온다. 없으면 빈 문자열.
 *  3. 새 버전 섹션을 만든다: `## [1.2.0] - 2024-01-15`. 본문은 [Unreleased] 본문.
 *  4. 새 빈 [Unreleased] 섹션을 만든다.
 *  5. 최종 섹션 순서: [새 Unreleased, 새 버전, ...기존 버전들]
 *     Keep a Changelog 규약에서 최신 버전이 위에 오는 역순 정렬을 유지한다.
 *  6. rebuild()로 재조합하여 반환한다.
 *
 * 사용 시나리오:
 *  릴리즈 직전에 이 함수를 호출하면 개발 중에 누적된 [Unreleased] 항목들이
 *  릴리즈 버전 섹션으로 이동하고, [Unreleased]는 비워져 다음 개발 사이클을 준비한다.
 */
export function promote(content, version, date) {
  const { head, sections } = splitSections(content || EMPTY);
  const unrel = sections.find((s) => /## \[Unreleased\]/.test(s.header));
  const moved = unrel ? unrel.body.trimEnd() : ''; // [Unreleased] 본문을 버전 섹션으로 이동.
  const versioned = { header: `## [${version}] - ${date}`, body: moved + '\n' }; // 새 버전 섹션.
  const fresh = { header: '## [Unreleased]', body: '' }; // 다음 개발 사이클을 위한 빈 [Unreleased].
  // 기존 [Unreleased] 섹션을 제외한 나머지 버전 섹션들을 수집한다.
  const others = sections.filter((s) => !/## \[Unreleased\]/.test(s.header));
  // Keep a Changelog 규약: [Unreleased] → 최신 버전 → 이전 버전 순서.
  return rebuild(head, [fresh, versioned, ...others]);
}

/**
 * CLI 인수 배열을 파싱하여 옵션 객체로 반환한다.
 *
 * @param {string[]} argv - process.argv.slice(2)로 전달되는 인수 배열.
 * @returns {{ cmd, type, text, version, date, config }} 파싱된 옵션 객체.
 *   - cmd: 첫 번째 인수. 'add' 또는 'release' 중 하나여야 한다.
 *   - type: --type 값. addEntry()의 type 파라미터.
 *   - text: --text 값. addEntry()의 text 파라미터.
 *   - version: --version 값. promote()의 version 파라미터.
 *   - date: --date 값. promote()의 date 파라미터.
 *   - config: --config 값. loadConfig()에 전달할 설정 파일 경로.
 *
 * 파싱 방식: 선형 탐색. 값을 받는 플래그는 다음 인덱스(++i)로 값을 가져온다.
 */
function parseArgs(argv) {
  const a = { cmd: argv[0], type: undefined, text: undefined, version: undefined, date: undefined, config: undefined };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--type') a.type = argv[++i];
    else if (k === '--text') a.text = argv[++i];
    else if (k === '--version') a.version = argv[++i];
    else if (k === '--date') a.date = argv[++i];
    else if (k === '--config') a.config = argv[++i];
  }
  return a;
}

/**
 * CLI 진입점: 커맨드라인 인수를 파싱하고 CHANGELOG.md를 add 또는 release 커맨드로 조작한다.
 *
 * @param {string[]} argv - process.argv.slice(2)로 전달되는 CLI 인수 배열.
 *
 * 동작 흐름:
 *  1. parseArgs()로 커맨드와 옵션을 파싱한다.
 *  2. loadConfig()로 설정을 로드한다.
 *  3. readIfExists()로 CHANGELOG.md를 읽는다. 없으면 EMPTY를 기본값으로 사용한다.
 *  4. cmd에 따라 addEntry() 또는 promote()를 호출하여 새 내용을 생성한다.
 *  5. writeFile()로 CHANGELOG.md를 갱신한다.
 *  6. stderr에 갱신 완료 메시지를 출력한다.
 *
 * 알 수 없는 커맨드는 stderr에 사용법을 출력하고 exit code 1로 종료한다.
 */
function main(argv) {
  const args = parseArgs(argv);
  const cfg = loadConfig({ cwd: process.cwd(), path: args.config });
  const p = join(process.cwd(), cfg.changelog.path);
  const content = readIfExists(p) ?? EMPTY; // CHANGELOG.md가 없으면 최소 템플릿을 기본값으로 사용.
  let out;
  if (args.cmd === 'add') out = addEntry(content, args.type, args.text);
  else if (args.cmd === 'release') out = promote(content, args.version, args.date);
  else { process.stderr.write('usage: changelog-parse.mjs add|release ...\n'); process.exit(1); }
  writeFile(p, out);
  process.stderr.write(`updated ${cfg.changelog.path}\n`);
}

/**
 * 이 파일이 직접 실행될 때만 main()을 호출한다.
 * 다른 모듈에서 import 시에는 main()이 실행되지 않으므로 사이드이펙트가 없다.
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
