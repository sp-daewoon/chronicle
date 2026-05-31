/**
 * scripts/lib/config.mjs
 *
 * chronicle 플러그인의 **설정 로딩 모듈**이다.
 *
 * 역할 요약:
 *  1. chronicle.config.json 파일이 존재하면 그 값을 파싱하여 DEFAULTS와 깊은(deep) 병합 후 반환한다.
 *  2. 설정 파일이 없으면 현재 디렉터리를 탐색하여 잘 알려진 문서 디렉터리(docs/adr, docs/devlog,
 *     CHANGELOG.md 등)를 자동 감지하고, 발견한 경로로 DEFAULTS를 보완한다.
 *
 * 공개 내보내기(exports):
 *  - DEFAULTS: 플러그인 전체가 공유하는 기본 설정 객체. 각 스크립트가 참조하는 기준값이다.
 *  - loadConfig(options): chronicle 설정을 로드하여 최종 병합된 설정 객체를 반환하는 핵심 함수.
 *
 * 사용처:
 *  - adr-index.mjs, changelog-parse.mjs, release-notes.mjs, devlog-render.mjs,
 *    index-render.mjs 등 모든 스크립트가 맨 처음 loadConfig()를 호출해 설정을 얻는다.
 *  - chronicle 스킬(skills/ 디렉터리의 슬래시 커맨드)도 이 모듈을 간접 의존한다.
 *
 * 읽기 대상: chronicle.config.json (선택적), 파일시스템 디렉터리/파일 존재 여부.
 * 쓰기 대상: 없음(읽기 전용 모듈).
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 플러그인 전체 기본 설정값 (Default Configuration Object).
 *
 * 각 섹션의 의미:
 *  - adr: ADR(Architecture Decision Record) 파일의 기본 저장 경로, 파일명 포맷, 번호 자릿수,
 *          인덱스 파일 경로를 정의한다. numberWidth=4이면 번호를 0001처럼 네 자리로 패딩한다.
 *  - changelog: CHANGELOG.md 파일의 기본 경로와 포맷(keepachangelog 규약)을 정의한다.
 *  - devlog: 개발 로그 HTML 파일을 저장할 디렉터리, 출력 포맷, 기본 섹션 목록을 정의한다.
 *            sections 배열은 HTML 파일 내에 생성할 <section> 헤딩 목록이다.
 *  - index: 프로젝트 인덱스 파일의 출력 경로와 수집 대상 소스 목록을 정의한다.
 *           sources 배열의 각 항목은 buildIndexModel()이 처리하는 데이터 원천이다.
 *  - release: 릴리즈 노트 생성에 사용할 VCS 제공자, 태그 접두사, README 테이블 갱신 여부를 정의한다.
 */
export const DEFAULTS = {
  adr: { dir: 'docs/adr', format: 'nygard', numberWidth: 4, indexFile: 'docs/adr/README.md' },
  changelog: { path: 'CHANGELOG.md', format: 'keepachangelog' },
  devlog: { dir: 'docs/devlog', format: 'html', sections: ['Summary', 'Changes', 'Decisions', 'Next'] },
  index: { output: 'docs/INDEX.html', sources: ['adr', 'changelog', 'releases'] },
  release: { provider: 'github', tagPrefix: 'v', readmeTable: true },
};

/**
 * 주어진 경로가 디렉터리인지 확인한다.
 *
 * @param {string} p - 검사할 파일시스템 경로.
 * @returns {boolean} 경로가 존재하고 디렉터리이면 true, 그 외(파일이거나 경로 없음) false.
 *
 * 주의: statSync가 예외를 던질 수 있으므로(경로 없을 때 ENOENT 등) try/catch로 감싸
 * 호출자가 예외를 처리하지 않아도 되도록 설계되어 있다.
 */
function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

/**
 * 두 설정 객체를 재귀적으로 깊은 병합(deep merge)한다.
 *
 * @param {object|Array} base - 기준이 되는 기본값 객체(DEFAULTS 또는 이전 단계 병합 결과).
 * @param {object|Array} over - 덮어쓸 사용자 정의 값 객체(chronicle.config.json 파싱 결과 등).
 * @returns {object|Array} base와 over를 재귀 병합한 새 객체. 원본은 변경되지 않는다.
 *
 * 알고리즘 설명:
 *  - base가 배열이면 스프레드로 얕은 복사한 뒤 over의 항목을 덮어쓴다.
 *  - base가 객체이면 Object.keys(over)를 순회하면서:
 *      * base[k]와 over[k] 모두 순수 객체(non-array, non-null)이면 → 재귀 깊은 병합.
 *      * 그 외(기본 값, 배열, null 등)이면 → over[k]로 단순 대입(얕은 덮어쓰기).
 *
 * 엣지 케이스:
 *  - over가 null/undefined이면 Object.keys(over || {})가 빈 배열을 반환하므로
 *    base의 복사본을 그대로 반환한다. 즉 over가 없어도 안전하다.
 *  - 배열 항목은 재귀 병합 대상이 아니다. 배열 자체를 over 값으로 통째 교체한다.
 *    예: over.devlog.sections = ['A','B']이면 DEFAULTS의 sections 배열 전체를 교체한다.
 */
function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
        base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      // base[k]와 over[k] 모두 순수 객체인 경우: 하위 키를 재귀적으로 병합한다.
      out[k] = deepMerge(base[k], over[k]);
    } else {
      // 기본 타입, 배열, 또는 한쪽이 객체가 아닌 경우: over 값으로 단순 교체한다.
      out[k] = over[k];
    }
  }
  return out;
}

/**
 * 명시적 설정 파일 없이도 프로젝트 구조를 탐색해 잘 알려진 문서 위치를 자동 감지한다.
 *
 * @param {string} cwd - 탐색 기준이 되는 현재 작업 디렉터리.
 * @returns {{ over: object, found: object }} 두 개의 객체를 반환한다.
 *   - over: 감지된 경로 정보를 담은 부분 설정 객체. deepMerge의 override 인수로 사용된다.
 *   - found: 각 섹션(adr, devlog, changelog)이 감지되었는지를 나타내는 boolean 맵.
 *            loadConfig()가 cfg.detected에 저장해 호출자가 어느 자원이 자동 감지됐는지 알 수 있게 한다.
 *
 * 탐색 순서(우선순위):
 *  - ADR 디렉터리: 'docs/adr' → 'doc/adr' → 'adr' 순서로 첫 번째 존재하는 디렉터리를 사용.
 *  - devlog 디렉터리: 'docs/devlog' → 'devlog' 순서로 첫 번째 존재하는 디렉터리를 사용.
 *  - 체인지로그 파일: 'CHANGELOG.md' → 'changelog.md' 순서로 첫 번째 존재하는 파일을 사용.
 *    대소문자 구분이 없는 OS에서도 명시적 순서를 유지하기 위해 순차 탐색한다.
 *
 * 이 함수는 chronicle.config.json이 존재하지 않을 때만 호출되며,
 * 사용자가 최소한의 설정으로도 chronicle을 바로 사용할 수 있게 한다("제로 설정" 경험).
 */
function detect(cwd) {
  const found = {};
  const over = {};
  // ADR 디렉터리 후보를 순서대로 탐색한다. 첫 번째로 존재하는 디렉터리에서 멈춘다.
  for (const cand of ['docs/adr', 'doc/adr', 'adr']) {
    if (isDir(join(cwd, cand))) { over.adr = { dir: cand, indexFile: join(cand, 'README.md') }; found.adr = true; break; }
  }
  // devlog 디렉터리 후보를 순서대로 탐색한다.
  for (const cand of ['docs/devlog', 'devlog']) {
    if (isDir(join(cwd, cand))) { over.devlog = { dir: cand }; found.devlog = true; break; }
  }
  // 체인지로그 파일 후보를 순서대로 탐색한다.
  for (const cand of ['CHANGELOG.md', 'changelog.md']) {
    if (existsSync(join(cwd, cand))) { over.changelog = { path: cand }; found.changelog = true; break; }
  }
  return { over, found };
}

/**
 * chronicle 설정을 로드하여 최종 병합된 설정 객체를 반환한다.
 *
 * @param {object} [options={}] - 옵션 객체.
 * @param {string} [options.cwd=process.cwd()] - 설정 파일 및 프로젝트 루트로 사용할 디렉터리.
 * @param {string} [options.path] - chronicle.config.json 경로를 직접 지정할 때 사용한다.
 *   지정하지 않으면 cwd + '/chronicle.config.json'을 기본으로 사용한다.
 * @returns {object} 병합이 완료된 최종 설정 객체. 항상 DEFAULTS의 모든 키를 포함한다.
 *   추가 메타 필드:
 *   - cfg.detected: 어느 자원이 자동 감지됐는지 나타내는 boolean 맵. 명시적 설정 파일이
 *                   있을 때는 빈 객체 {}가 된다(명시적 설정이 우선이므로 감지가 불필요함).
 *   - cfg._source: 실제로 로드된 설정 파일의 절대 경로. 없으면 null.
 *
 * 동작 흐름:
 *  1. 명시적 경로(options.path) 또는 기본 경로(cwd/chronicle.config.json)에 파일이 있으면
 *     JSON 파싱 후 DEFAULTS와 깊은 병합을 수행하고 반환한다.
 *  2. 파일이 없으면 detect()로 자동 탐색하고 발견한 경로로 DEFAULTS를 보완해 반환한다.
 *
 * 모든 스크립트(adr-index, changelog-parse, release-notes, devlog-render, index-render)는
 * 이 함수를 맨 처음 호출해 cfg 객체를 얻으며, 그 이후의 모든 경로 계산은 cfg를 기준으로 한다.
 */
export function loadConfig({ cwd = process.cwd(), path } = {}) {
  // 명시적으로 경로를 지정했거나, 기본 위치(cwd/chronicle.config.json)에 파일이 있으면 파일 로드.
  const explicit = path || join(cwd, 'chronicle.config.json');
  if (existsSync(explicit)) {
    const user = JSON.parse(readFileSync(explicit, 'utf8'));
    const cfg = deepMerge(DEFAULTS, user); // 사용자 설정으로 기본값을 깊은 병합한다.
    cfg.detected = {};      // 명시적 파일 사용 시에는 자동 감지가 필요 없으므로 빈 맵.
    cfg._source = explicit; // 로드된 파일의 절대 경로를 기록해 디버깅을 돕는다.
    return cfg;
  }
  // 설정 파일이 없는 경우: 파일시스템을 탐색해 잘 알려진 경로를 자동 감지한다.
  const { over, found } = detect(cwd);
  const cfg = deepMerge(DEFAULTS, over); // 감지된 경로로 기본값을 보완한다.
  cfg.detected = found; // 어느 자원이 자동 감지됐는지 기록한다.
  cfg._source = null;   // 설정 파일이 없으므로 null.
  return cfg;
}
