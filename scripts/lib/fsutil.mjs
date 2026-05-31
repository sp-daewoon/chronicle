/**
 * scripts/lib/fsutil.mjs
 *
 * chronicle 플러그인의 **파일시스템 유틸리티 모듈**이다.
 *
 * 역할 요약:
 *  이 모듈은 chronicle의 모든 스크립트에서 반복적으로 필요한 파일 읽기·쓰기·경로 보장·
 *  앵커 기반 교체 작업을 추상화하여 제공한다. Node.js 내장 'node:fs' 모듈 위의 얇은 래퍼층이다.
 *
 * 공개 내보내기(exports):
 *  - readIfExists(p): 파일이 있으면 내용을 반환하고 없으면 null을 반환한다.
 *  - ensureDir(p): 파일 경로의 부모 디렉터리가 없으면 재귀적으로 생성한다.
 *  - writeFile(p, content): 부모 디렉터리를 보장한 뒤 파일을 기록한다.
 *  - replaceAnchored(content, startMarker, endMarker, replacement): 마커 사이의 블록을
 *    교체하거나 마커가 없으면 파일 끝에 새 블록을 추가하는 멱등(idempotent) 교체 함수.
 *
 * 사용처:
 *  - adr-index.mjs: readIfExists로 인덱스 파일을 읽고 writeFile + replaceAnchored로 갱신.
 *  - changelog-parse.mjs: readIfExists로 CHANGELOG.md를 읽고 writeFile로 갱신.
 *  - release-notes.mjs: writeFile로 RELEASE_NOTES.md를 기록.
 *  - devlog-render.mjs: writeFile로 devlog HTML을 기록하고 replaceAnchored로 index.html 갱신.
 *  - index-render.mjs: writeFile로 INDEX.html을 기록.
 *
 * 읽기 대상: 경로로 전달된 임의의 파일.
 * 쓰기 대상: 경로로 전달된 임의의 파일(부모 디렉터리 자동 생성).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * 파일이 존재하면 UTF-8로 읽어 반환하고, 존재하지 않으면 null을 반환한다.
 *
 * @param {string} p - 읽을 파일의 절대 또는 상대 경로.
 * @returns {string|null} 파일 내용 문자열 또는 null.
 *
 * 사용 패턴:
 *  대부분의 스크립트에서 `?? EMPTY` 또는 `?? ''` 패턴과 함께 사용한다.
 *  예: `const content = readIfExists(p) ?? EMPTY;`
 *  이렇게 하면 파일이 없을 때 기본값을 제공하면서도 파일이 있을 때는 기존 내용을 보존한다.
 *
 * 주의:
 *  - /dev/stdin을 경로로 전달하면 파이프 입력을 읽을 수 있다. release-notes.mjs와
 *    devlog-render.mjs에서 스킬이 stdin으로 전달하는 JSON 데이터를 읽을 때 이 패턴을 사용한다.
 *  - existsSync가 false이면 readFileSync를 호출하지 않으므로 ENOENT 예외가 발생하지 않는다.
 */
export function readIfExists(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/**
 * 주어진 파일 경로의 부모 디렉터리를 재귀적으로 생성한다.
 *
 * @param {string} p - 기록할 파일의 절대 또는 상대 경로.
 *   이 함수는 파일 자체를 만들지 않고 부모 디렉터리만 생성한다.
 *
 * 동작:
 *  - dirname(p)로 부모 디렉터리 경로를 추출한다.
 *  - mkdirSync에 { recursive: true } 옵션을 전달하므로:
 *    * 이미 디렉터리가 존재해도 예외 없이 조용히 넘어간다.
 *    * 중간 경로가 없어도 한 번에 전체 경로를 생성한다.
 *    예: 'docs/devlog/2024-01-01.html' → 'docs/devlog/' 디렉터리 보장.
 *
 * writeFile()이 내부에서 호출하므로 직접 사용할 필요는 드물다.
 * 그러나 파일 생성 전 디렉터리만 먼저 보장해야 하는 경우 별도로 호출할 수 있다.
 */
export function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

/**
 * 부모 디렉터리를 보장한 뒤 파일에 내용을 기록한다.
 *
 * @param {string} p - 기록할 파일의 절대 또는 상대 경로.
 * @param {string} content - 파일에 기록할 문자열 내용(UTF-8).
 *
 * 동작:
 *  1. ensureDir(p)를 호출해 부모 디렉터리가 없으면 재귀 생성한다.
 *  2. writeFileSync로 파일을 동기적으로 기록한다(기존 파일이 있으면 덮어씀).
 *
 * 모든 chronicle 스크립트의 최종 출력은 이 함수를 통해 이루어진다.
 * writeFileSync이므로 프로세스가 종료되기 전 반드시 완료된다.
 */
export function writeFile(p, content) {
  ensureDir(p);
  writeFileSync(p, content);
}

/**
 * 문자열 내에서 시작 마커와 끝 마커 사이의 블록을 교체한다. 멱등(idempotent) 연산이다.
 *
 * @param {string} content - 교체 대상 파일의 전체 문자열 내용.
 * @param {string} startMarker - 교체 시작 위치를 나타내는 마커 문자열.
 *   예: `<!-- chronicle:adr-index -->`, `<!-- chronicle:devlog-list -->`
 * @param {string} endMarker - 교체 종료 위치를 나타내는 마커 문자열.
 *   예: `<!-- /chronicle:adr-index -->`, `<!-- /chronicle:devlog-list -->`
 * @param {string} replacement - 두 마커 사이에 삽입할 새 내용 문자열.
 * @returns {string} 교체(또는 추가)가 완료된 새 문자열.
 *
 * 알고리즘 (앵커 기반 멱등 교체):
 *  1. 완성된 블록을 구성한다: `${startMarker}\n${replacement}\n${endMarker}`
 *  2. startMarker와 endMarker를 정규식 특수문자 이스케이프(`escapeRe`)한 뒤,
 *     두 마커 사이의 모든 내용(`[\s\S]*?`)을 매칭하는 정규식을 생성한다.
 *  3. content에서 해당 정규식이 매칭되면(마커가 이미 존재하면):
 *     → `String.replace()`로 마커 사이 내용을 새 블록으로 교체한다. (업데이트)
 *  4. 매칭되지 않으면(마커가 아직 없으면):
 *     → content가 개행 없이 끝나면 개행 1개를 추가한 뒤 새 블록을 붙여넣는다. (초기화)
 *
 * 멱등성 보장:
 *  동일한 내용으로 여러 번 호출해도 결과가 같다. 마커 사이가 이미 동일한 내용이어도
 *  String.replace()가 새 블록으로 교체하므로 최종 결과는 동일하다.
 *
 * 사용 예 (adr-index.mjs):
 *  ```
 *  const updated = replaceAnchored(existing, START, END, table);
 *  writeFile(idxPath, updated);
 *  ```
 *  README.md에 `<!-- chronicle:adr-index -->` 마커가 있으면 마커 사이의 테이블만 갱신하고,
 *  마커가 없으면 파일 끝에 마커와 함께 테이블을 새로 추가한다.
 */
export function replaceAnchored(content, startMarker, endMarker, replacement) {
  // 삽입할 완성 블록: 시작 마커 + 개행 + 새 내용 + 개행 + 끝 마커.
  const block = `${startMarker}\n${replacement}\n${endMarker}`;
  // 마커를 정규식 특수문자 이스케이프 처리한 뒤 두 마커 사이 전체를 캡처하는 패턴 생성.
  const re = new RegExp(
    escapeRe(startMarker) + '[\\s\\S]*?' + escapeRe(endMarker)
  );
  // 마커가 이미 있으면 기존 블록을 새 블록으로 교체한다.
  if (re.test(content)) return content.replace(re, block);
  // 마커가 없으면 파일 끝에 새 블록을 추가한다. 파일이 개행으로 끝나지 않으면 먼저 개행을 삽입.
  const sep = content.endsWith('\n') ? '' : '\n';
  return content + sep + block + '\n';
}

/**
 * 정규식 특수문자를 이스케이프하여 문자열을 리터럴 패턴으로 사용할 수 있게 한다.
 *
 * @param {string} s - 이스케이프할 문자열.
 * @returns {string} 정규식 특수문자가 모두 백슬래시로 이스케이프된 문자열.
 *
 * 이스케이프 대상 문자: `. * + ? ^ $ { } ( ) | [ ] \`
 * 예: `'<!-- /chronicle:adr-index -->'` → `'<\\!-- \\/chronicle:adr-index -->'`
 *
 * replaceAnchored()가 마커를 `new RegExp(...)`로 컴파일할 때 내부적으로 사용한다.
 * HTML 주석 마커(`<!-- ... -->`)에는 `!`, `-`, `/` 같은 정규식 특수문자가 포함되므로
 * 반드시 이스케이프해야 의도한 대로 리터럴 매칭이 이루어진다.
 */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 특수문자 앞에 백슬래시를 삽입.
}
