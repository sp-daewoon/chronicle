/**
 * scripts/release-notes.mjs
 *
 * 릴리즈 노트(RELEASE_NOTES.md) 생성 스크립트이다.
 *
 * 역할 요약:
 *  CHANGELOG.md에서 특정 버전의 섹션을 추출하고, ADR 목록 및 커밋 목록을
 *  합성하여 GitHub 릴리즈 등에 사용할 수 있는 릴리즈 노트 마크다운을 생성한다.
 *
 * 공개 내보내기(exports):
 *  - sectionFor(changelog, version): CHANGELOG.md에서 특정 버전의 본문을 추출한다.
 *  - composeNotes({ version, changelogSection, adrs, commits }): 릴리즈 노트를 합성한다.
 *
 * CLI 사용 예:
 *  ```
 *  node scripts/release-notes.mjs --version 1.2.0
 *  echo '{"adrs":[{"number":1,"title":"결정","file":"0001-decision.md"}]}' \
 *    | node scripts/release-notes.mjs --version 1.2.0
 *  ```
 *
 * stdin JSON 인터페이스:
 *  chronicle 스킬이 ADR 목록·커밋 목록을 JSON으로 stdin에 전달할 수 있다.
 *  형식: `{ "adrs": [...], "commits": [...] }`
 *  stdin이 없거나 유효하지 않은 JSON이면 빈 배열로 폴백하므로 stdin 없이도 동작한다.
 *
 * 사용처:
 *  - chronicle 스킬의 `/release-notes` 커맨드에서 호출한다.
 *  - changelog-parse.mjs가 생성한 CHANGELOG.md를 읽어 재사용한다.
 *
 * 읽기 대상: cfg.changelog.path (기본: CHANGELOG.md), /dev/stdin (선택적 JSON).
 * 쓰기 대상: RELEASE_NOTES.md (프로젝트 루트).
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { readIfExists, writeFile } from './lib/fsutil.mjs';

/**
 * CHANGELOG.md 전체 텍스트에서 특정 버전의 섹션 본문을 추출한다.
 *
 * @param {string} changelog - CHANGELOG.md 전체 텍스트.
 * @param {string} version - 찾을 버전 문자열. 예: '1.2.0', '2.0.0-beta.1'.
 * @returns {string} 해당 버전 섹션의 본문 텍스트(trim 적용). 버전을 찾지 못하면 빈 문자열.
 *
 * 정규식 설명:
 *  `## \[${version}\][^\n]*\n([\s\S]*?)(?=\n## \[|$)`
 *   - `## \[${version}\]`: 버전 헤딩 시작. 버전 문자열의 `.`은 `\.`로 이스케이프한다.
 *     예: '1.2.0' → `1\.2\.0` (점이 임의 문자로 해석되지 않도록).
 *   - `[^\n]*`: 헤딩 줄의 나머지 부분(날짜 등). 예: `] - 2024-01-01`.
 *   - `\n`: 헤딩 줄 끝 개행.
 *   - `([\s\S]*?)`: 비탐욕 매칭으로 섹션 본문 전체를 캡처(캡처 그룹 1).
 *   - `(?=\n## \[|$)`: lookahead — 다음 버전 헤딩(`\n## [`) 또는 파일 끝(`$`)에서 멈춤.
 *     이를 통해 현재 버전 섹션만 정확히 캡처한다.
 *
 * 엣지 케이스:
 *  - 버전을 찾지 못하면(정규식 불일치) 빈 문자열을 반환한다.
 *  - changelog가 빈 문자열이면 항상 빈 문자열을 반환한다.
 */
export function sectionFor(changelog, version) {
  const re = new RegExp(
    // 버전 문자열의 점(.)을 정규식 이스케이프하여 리터럴 점으로 매칭한다.
    `## \\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`
  );
  const m = re.exec(changelog);
  return m ? m[1].trim() : ''; // 캡처 그룹 1이 섹션 본문. 없으면 빈 문자열.
}

/**
 * 변경 섹션·ADR 목록·커밋 목록을 합성하여 릴리즈 노트 마크다운을 구성한다.
 *
 * @param {object} options - 합성에 필요한 데이터 객체.
 * @param {string} options.version - 릴리즈 버전 문자열(현재는 노트 본문에 직접 포함되지 않지만
 *   호출자가 컨텍스트 추적 목적으로 전달한다).
 * @param {string} options.changelogSection - sectionFor()가 반환한 버전 섹션 본문.
 *   비어 있으면 '_No changelog entries._' 플레이스홀더 텍스트를 삽입한다.
 * @param {Array<{number, title, file}>} [options.adrs=[]] - ADR 항목 배열.
 *   각 항목은 number(정수), title(제목 문자열), file(파일명)을 가져야 한다.
 *   비어 있으면 ADR 섹션 자체를 생성하지 않는다.
 * @param {string[]} [options.commits=[]] - 커밋 문자열 배열.
 *   비어 있으면 커밋 섹션(접기 가능 <details>)을 생성하지 않는다.
 * @returns {string} 완성된 릴리즈 노트 마크다운 문자열. 항상 개행 1개로 끝난다.
 *
 * 출력 구조:
 *  ```
 *  ## What's Changed
 *
 *  <changelogSection 또는 _No changelog entries._>
 *
 *  ### New Architecture Decisions
 *  - ADR 0001: 제목 (`파일명.md`)
 *  ...
 *
 *  <details>
 *  <summary>Commits</summary>
 *
 *  - 커밋 메시지
 *  ...
 *
 *  </details>
 *  ```
 *
 * ADR 번호 포맷: String(a.number).padStart(4, '0') — 항상 4자리 제로 패딩.
 * 커밋 섹션은 <details>로 접혀 있어 GitHub 릴리즈 노트의 가독성을 높인다.
 *
 * 주의: 이 함수가 생성하는 영어 텍스트("What's Changed", "New Architecture Decisions",
 * "_No changelog entries._" 등)는 프로그램 출력이므로 변경하면 안 된다.
 */
export function composeNotes({ version, changelogSection, adrs = [], commits = [] }) {
  let out = `## What's Changed\n\n`;
  // 변경 섹션이 있으면 삽입, 없으면 플레이스홀더 텍스트를 사용한다.
  out += (changelogSection && changelogSection.length) ? changelogSection : '_No changelog entries._';
  out += '\n';
  if (adrs.length) {
    // ADR이 하나 이상 있을 때만 ADR 섹션을 생성한다.
    out += `\n### New Architecture Decisions\n`;
    for (const a of adrs) {
      // ADR 번호를 4자리로 패딩하고 제목과 파일명을 포함하는 항목 줄을 생성한다.
      out += `- ADR ${String(a.number).padStart(4, '0')}: ${a.title} (\`${a.file}\`)\n`;
    }
  }
  if (commits.length) {
    // 커밋이 하나 이상 있을 때만 접기 가능한 커밋 섹션을 생성한다.
    out += `\n<details>\n<summary>Commits</summary>\n\n`;
    for (const c of commits) out += `- ${c}\n`;
    out += `\n</details>\n`;
  }
  // 마지막 공백을 제거한 뒤 개행 1개로 끝맺는다.
  return out.trimEnd() + '\n';
}

/**
 * CLI 인수 배열을 파싱하여 옵션 객체로 반환한다.
 *
 * @param {string[]} argv - process.argv.slice(2)로 전달되는 인수 배열.
 * @returns {{ version: string|undefined, config: string|undefined }} 파싱된 옵션 객체.
 *   - version: --version 값. 필수 파라미터. 없으면 main()이 exit 1로 종료한다.
 *   - config: --config 값. 선택적. loadConfig()에 전달할 설정 파일 경로.
 */
function parseArgs(argv) {
  const a = { version: undefined, config: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--version') a.version = argv[++i];
    else if (argv[i] === '--config') a.config = argv[++i];
  }
  return a;
}

/**
 * CLI: reads CHANGELOG for the version section and writes RELEASE_NOTES.md.
 * ADR list / commit list are passed in by the skill via stdin JSON (optional).
 *
 * CLI 진입점: CHANGELOG.md에서 지정 버전 섹션을 읽고 RELEASE_NOTES.md를 기록한다.
 * ADR 목록 / 커밋 목록은 스킬이 stdin으로 JSON을 전달해 제공한다(선택적).
 *
 * @param {string[]} argv - process.argv.slice(2)로 전달되는 CLI 인수 배열.
 *
 * 동작 흐름:
 *  1. parseArgs()로 --version / --config 옵션을 파싱한다.
 *  2. --version이 없으면 stderr에 오류를 출력하고 exit 1로 종료한다.
 *  3. loadConfig()로 설정을 로드한다.
 *  4. readIfExists()로 CHANGELOG.md를 읽는다. 없으면 빈 문자열로 폴백한다.
 *  5. /dev/stdin을 통해 JSON 데이터를 읽는다:
 *     - stdin에 유효한 JSON이 있으면 파싱하여 adrs/commits 목록을 가져온다.
 *     - stdin이 없거나 비어 있거나 유효하지 않은 JSON이면 조용히 무시하고 빈 배열을 사용한다.
 *     - /dev/stdin은 Unix 계열에서 파이프 입력을 파일처럼 읽을 수 있는 특수 경로이다.
 *       `readIfExists('/dev/stdin')`이 null을 반환하면 pipe 입력이 없는 것으로 간주한다.
 *  6. composeNotes()로 릴리즈 노트를 합성한다.
 *  7. writeFile()로 RELEASE_NOTES.md를 기록하고 stdout에도 출력한다.
 *     stdout 출력은 스킬이 결과를 캡처해 추가 처리하는 데 사용된다.
 */
function main(argv) {
  const args = parseArgs(argv);
  if (!args.version) { process.stderr.write('--version required\n'); process.exit(1); }
  const cfg = loadConfig({ cwd: process.cwd(), path: args.config });
  const cl = readIfExists(join(process.cwd(), cfg.changelog.path)) ?? ''; // 없으면 빈 문자열.
  let extra = { adrs: [], commits: [] }; // stdin이 없을 때의 기본값.
  try {
    // /dev/stdin을 통해 파이프 입력 JSON을 읽는다.
    // 스킬이 ADR 목록과 커밋 목록을 JSON으로 파이프할 수 있다.
    const stdin = readIfExists('/dev/stdin');
    if (stdin && stdin.trim()) extra = { ...extra, ...JSON.parse(stdin) }; // 유효한 JSON이면 병합.
  } catch { /* no stdin */ } // stdin이 없거나 유효하지 않은 JSON이면 조용히 무시한다.
  const notes = composeNotes({
    version: args.version,
    changelogSection: sectionFor(cl, args.version), // CHANGELOG에서 해당 버전 섹션을 추출.
    adrs: extra.adrs,
    commits: extra.commits,
  });
  writeFile(join(process.cwd(), 'RELEASE_NOTES.md'), notes);
  process.stdout.write(notes); // 스킬이 캡처할 수 있도록 stdout에도 출력한다.
}

/**
 * 이 파일이 직접 실행될 때만 main()을 호출한다.
 * 다른 모듈에서 import 시에는 main()이 실행되지 않으므로 사이드이펙트가 없다.
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
