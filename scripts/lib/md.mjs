/**
 * scripts/lib/md.mjs
 *
 * 마크다운 파싱 유틸리티 모듈이다.
 *
 * 역할 요약:
 *  이 모듈은 마크다운 문서(주로 ADR 파일)에서 메타데이터와 본문을 분리하고,
 *  ADR 상태(Status)를 추출하며, 문자열을 URL-slug로 변환하는 순수 함수들을 제공한다.
 *  외부 의존성(라이브러리)이 전혀 없는 가장 가벼운 헬퍼 모듈이다.
 *
 * 공개 내보내기(exports):
 *  - parseFrontmatter(text): YAML 프론트매터를 파싱해 data 객체와 body 문자열을 반환한다.
 *  - extractAdrStatus(text): ADR 마크다운 전문(全文)에서 상태(Status)를 추출한다.
 *  - slugify(s): 문자열을 소문자 하이픈 슬러그(URL-safe identifier)로 변환한다.
 *
 * 사용처:
 *  - adr-index.mjs: ADR 파일마다 parseFrontmatter + extractAdrStatus를 호출해
 *                   인덱스 테이블 행(row)을 구성한다.
 *  - index-render.mjs: slugify를 사용해 마크다운 링크를 HTML 앵커로 변환하는 과정에
 *                      관련 패턴을 참고한다(직접 호출하지는 않음).
 *
 * 읽기 대상: 없음(함수에 텍스트를 직접 전달하는 방식).
 * 쓰기 대상: 없음(순수 변환 함수들의 집합).
 */

/**
 * YAML-style 프론트매터가 포함된 마크다운 텍스트를 파싱한다.
 *
 * @param {string} text - 파싱할 마크다운 전문(全文).
 * @returns {{ data: object, body: string }} 두 필드를 가진 객체:
 *   - data: 프론트매터의 키-값 쌍을 담은 객체. 프론트매터가 없으면 빈 객체 {}.
 *   - body: 프론트매터를 제외한 순수 마크다운 본문 문자열.
 *           프론트매터가 없으면 text 전체가 body로 반환된다.
 *
 * 파서 제약(의도적 단순화):
 *  - `key: value` 형태의 스칼라 단일 행만 지원한다. 중첩(nesting)·배열·블록 스칼라 미지원.
 *  - 키(key)는 영문자·숫자·하이픈·언더스코어([A-Za-z0-9_-])만 허용한다.
 *  - 값(value)의 앞뒤 작은따옴표·큰따옴표는 자동으로 제거한다.
 *    예: `status: "Accepted"` → data.status === 'Accepted'
 *
 * 정규식 설명 (`/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/`):
 *  - `^---\n` : 파일 맨 처음의 `---` 구분자로 시작.
 *  - `([\s\S]*?)` : 비탐욕 매칭으로 프론트매터 본문 캡처 (캡처 그룹 1).
 *  - `\n---\n?` : 닫는 `---` 구분자. 뒤 개행은 선택적이다.
 *  - `([\s\S]*)$` : 프론트매터 이후의 마크다운 본문 전체 캡처 (캡처 그룹 2).
 *
 * 엣지 케이스:
 *  - 프론트매터가 없는 파일: 정규식이 매칭되지 않으면 { data: {}, body: text }를 반환한다.
 *  - 빈 프론트매터(`---\n---`): data는 {}이고 body는 이후 내용이 된다.
 */
export function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text }; // 프론트매터가 없으면 body = 전문, data = 빈 객체.
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, ''); // 앞뒤 따옴표를 제거하여 순수 값만 저장.
  }
  return { data, body: m[2] };
}

/**
 * extractAdrStatus()가 인식하는 유효한 ADR 상태 목록.
 * Nygard 스타일 ADR 규약(https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
 * 에서 사용하는 상태 값들이다. 이 순서는 find()의 우선순위에 영향을 주지 않으며
 * 모두 동등하게 취급된다.
 */
const STATUSES = ['Proposed', 'Accepted', 'Deprecated', 'Superseded', 'Rejected'];

/**
 * ADR 마크다운 파일의 전문(全文)에서 상태(Status)를 추출한다.
 *
 * @param {string} text - ADR 마크다운 파일의 전체 텍스트.
 * @returns {string} 감지된 상태 문자열. 감지 실패 시 'Unknown'을 반환한다.
 *
 * 상태 추출 전략 (3단계 폴백):
 *
 *  1단계 — 프론트매터 우선:
 *     parseFrontmatter()로 data.status 키를 확인한다. 값이 있으면 즉시 반환한다.
 *     예: `status: Accepted` → 'Accepted' 반환.
 *
 *  2단계 — "## Status" 섹션 본문 파싱:
 *     프론트매터에 status 키가 없으면 `## Status` 헤딩 바로 아래 첫 번째 줄을 파싱한다.
 *     정규식: `/^##\s*Status\s*\n+([^\n#]+)/im`
 *       - `im` 플래그: 대소문자 무시 + 멀티라인 모드.
 *       - `[^\n#]+`: 헤딩(`#`)이나 개행 없이 이어지는 텍스트(실제 상태 서술).
 *     해당 줄에서 STATUSES 목록의 키워드를 대소문자 무시 검색한다.
 *     키워드가 있으면 해당 STATUSES 값을 반환하고, 없으면 해당 줄 자체를 반환한다.
 *     예: `## Status\nAccepted — 2024-01-01` → 'Accepted' 반환.
 *
 *  3단계 — 전문 키워드 검색(폴백):
 *     "## Status" 섹션도 없으면 파일 전체에서 STATUSES 키워드를 검색한다.
 *     첫 번째로 일치하는 키워드를 반환한다. 아무것도 없으면 'Unknown' 반환.
 *
 * 주의: 3단계까지 내려가면 오탐(false positive) 가능성이 높아진다.
 * chronicle은 2단계까지 잘 작성된 ADR을 가정하며, 3단계는 최후 수단이다.
 */
export function extractAdrStatus(text) {
  const { data, body } = parseFrontmatter(text);
  // 1단계: 프론트매터의 status 키가 있으면 즉시 반환한다.
  if (data.status) return data.status;
  // 2단계: "## Status" 헤딩 바로 아래 줄을 파싱한다.
  const sec = /^##\s*Status\s*\n+([^\n#]+)/im.exec(body);
  if (sec) {
    const line = sec[1].trim();
    // 해당 줄에서 공식 상태 키워드(대소문자 무시)를 찾아 반환한다.
    const hit = STATUSES.find((s) => new RegExp(s, 'i').test(line));
    return hit || line; // 키워드 없으면 줄 자체를 상태로 반환(비표준 ADR 대응).
  }
  // 3단계: 파일 전체에서 상태 키워드를 검색하는 마지막 폴백이다.
  const kw = STATUSES.find((s) => new RegExp(s, 'i').test(text));
  return kw || 'Unknown'; // 아무것도 찾지 못하면 'Unknown'을 반환한다.
}

/**
 * 임의의 문자열을 URL-safe 슬러그(소문자 + 하이픈)로 변환한다.
 *
 * @param {string} s - 변환할 원본 문자열. 예: 'My ADR Title (v2)', 'ADR-001: Decision'.
 * @returns {string} 소문자 하이픈 슬러그. 예: 'my-adr-title-v2', 'adr-001-decision'.
 *
 * 변환 단계:
 *  1. 전체를 소문자로 변환한다 (`toLowerCase()`).
 *  2. 영문 소문자·숫자·하이픈이 아닌 모든 문자(공백, 특수문자, 한글 등)를 하이픈으로 교체한다.
 *     정규식 `[^a-z0-9]+`: 연속된 비허용 문자를 한 개의 하이픈으로 묶어 처리한다.
 *  3. 슬러그의 앞뒤에 남은 불필요한 하이픈을 제거한다 (`^-+|-+$`).
 *     예: '--my-title--' → 'my-title'.
 *
 * 사용처 예:
 *  - index-render.mjs에서 마크다운 링크 텍스트를 HTML anchor href로 변환할 때 사용할 수 있다.
 *  - GitHub Flavored Markdown의 자동 앵커 생성 규칙과 유사하다.
 */
export function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // 허용되지 않는 문자(공백·특수문자 등)를 하이픈으로 교체.
    .replace(/^-+|-+$/g, '');    // 앞뒤 불필요한 하이픈을 제거.
}
