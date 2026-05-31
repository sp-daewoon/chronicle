# chronicle — 설계 문서

- **날짜**: 2026-05-31
- **상태**: Approved (사용자 승인 2026-05-31)
- **저장소**: `sp-daewoon/chronicle` (신규 public, MIT)
- **유형**: Claude Code plugin (marketplace 배포)

## 1. 배경 & 목적

magicJar 프로젝트를 운영하며 다듬어온 **프로젝트 문서화 lifecycle** 노하우를 범용 도구로 추출한다. 결정(ADR) → 변경(CHANGELOG) → 배포(release) → 일지(devlog) → 길잡이(index·CLAUDE.md)로 이어지는 운영 문서 흐름을 하나의 plugin으로 묶어, 누구나 `/plugin install` 한 줄로 자신의 프로젝트에 적용할 수 있게 한다.

**핵심 제약 (사용자 결정)**
- **완전 범용 (config 주입형)**: magicJar 특화 요소(KIS, ADR 0xxx 번호 규칙, 7 에이전트, 슬롯 채번, baseline 사이클, gradle/gh 결합) **흔적 0**. 모든 동작은 설정/자동 감지로 프로젝트에 적응.
- **구현 접근 B**: 각 skill = SKILL.md 지침 + 결정론적 작업은 **외부 의존성 0 Node native 헬퍼**. `${CLAUDE_PLUGIN_ROOT}/scripts/*.mjs`로 호출.
- **단일 plugin · 6 skill 번들**: skillsmp.com이 SKILL.md 단위로 스크래핑하므로 6개가 각각 독립 인덱싱된다.

## 2. 정체성

프로젝트의 **결정 → 변경 → 배포 → 일지 → 길잡이** 문서화 lifecycle을 자동화하는 Claude Code plugin. `chronicle`(연대기) — 모든 기록을 시간축으로 남긴다는 의미.

## 3. 저장소 구조

```
chronicle/
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest (name, version(semver), skills/commands 경로)
│   └── marketplace.json     # self-marketplace (이 repo 자체가 marketplace, source: ".")
├── skills/
│   ├── adr/SKILL.md
│   ├── changelog/SKILL.md
│   ├── release/SKILL.md
│   ├── devlog/SKILL.md
│   ├── index/SKILL.md
│   └── claude-md/SKILL.md
├── commands/                # 슬래시 진입점 6개 (/chronicle:adr 등)
│   ├── adr.md  changelog.md  release.md
│   └── devlog.md  index.md  claude-md.md
├── scripts/                 # Node 18+ native, npm 의존 0
│   ├── lib/
│   │   ├── config.mjs       # chronicle.config.json 로드 + 자동 감지 + 기본값
│   │   ├── fsutil.mjs       # 파일 IO 공통
│   │   └── md.mjs           # 마크다운/frontmatter 파싱 공통
│   ├── adr-index.mjs        # ADR 디렉토리 스캔 → 번호·상태·날짜 파싱 → 목차 생성
│   ├── changelog-parse.mjs  # CHANGELOG 섹션 파싱 / 항목 추가 / 버전 승격
│   ├── release-notes.mjs    # CHANGELOG diff + ADR + 커밋 → release 노트 합성
│   ├── devlog-render.mjs    # 세션 데이터 → 날짜별 HTML + index.html 갱신
│   └── index-render.mjs     # ADR·릴리즈·changelog 파싱 → 단일 진입점 INDEX 생성
├── templates/
│   ├── chronicle.config.json   # 기본 설정 템플릿 (주석 포함)
│   ├── adr-template.md         # Nygard 형식 ADR 템플릿
│   ├── devlog.html.tmpl        # 인라인 CSS, 외부 의존 0
│   └── index.html.tmpl
├── docs/
│   ├── specs/                  # 본 설계 문서 + 향후 spec
│   └── workflows/              # 6개 워크플로별 상세 가이드
├── examples/                   # 적용 예시 (선택, 범용 샘플 프로젝트)
├── LICENSE                     # MIT
├── README.md                   # 배지·소개·install·skill 표·config·등재 안내
└── CHANGELOG.md                # dogfooding — chronicle 자신도 chronicle로 관리
```

> ⚠️ `.claude-plugin/` 안에는 **manifest 파일만**. `skills/`·`commands/`·`scripts/`는 모두 repo 루트.

## 4. 범용화 메커니즘 — config 주입 + 자동 감지

프로젝트 루트의 `chronicle.config.json`(선택):

```json
{
  "adr":       { "dir": "docs/adr", "format": "nygard", "numberWidth": 4, "indexFile": "docs/adr/README.md" },
  "changelog": { "path": "CHANGELOG.md", "format": "keepachangelog" },
  "devlog":    { "dir": "docs/devlog", "format": "html", "sections": ["요약", "변경 사항", "주요 결정", "다음 작업"] },
  "index":     { "output": "docs/INDEX.html", "sources": ["adr", "changelog", "releases"] },
  "release":   { "provider": "github", "tagPrefix": "v", "readmeTable": true }
}
```

**config 부재 시 동작 (진입장벽 0 원칙)**
- skill이 프로젝트를 스캔: 기존 `CHANGELOG.md`, `docs/adr` / `doc/adr` / `adr/`, `docs/devlog` 위치 자동 탐지.
- 발견되면 그 위치를, 없으면 합리적 기본값 사용.
- 첫 실행 시 감지 결과를 보여주고 `chronicle.config.json` 생성을 **제안**(강제 X).

`scripts/lib/config.mjs`가 로드·감지·기본값 병합을 단일 책임으로 담당한다.

## 5. 6개 skill 동작 정의

각 skill은 SKILL.md(LLM 지침) + 필요한 경우 Node 헬퍼 호출로 구성.

### 5.1 adr
- **무엇**: 아키텍처 결정 기록 작성·관리.
- **동작**: 새 ADR 생성(다음 번호 자동 채번, 템플릿 채움) / 상태 전이(Proposed → Accepted → Deprecated → Superseded by NNNN) / 목차(README) 자동 재생성.
- **헬퍼**: `adr-index.mjs` — ADR 디렉토리를 스캔해 번호·제목·상태·날짜를 파싱하고 목차 마크다운을 출력. (frontmatter 또는 `## Status` 또는 제목 키워드에서 상태 추론)

### 5.2 changelog
- **무엇**: Keep a Changelog 규약 기반 변경 이력.
- **동작**: `[Unreleased]`에 항목 추가(Added/Changed/Fixed/...) / 릴리즈 시 `[Unreleased]` → `[x.y.z] - date` 승격 + 새 `[Unreleased]` 슬롯 생성 / 비교 링크 갱신.
- **헬퍼**: `changelog-parse.mjs` — 섹션 파싱, 항목 삽입, 버전 승격, 멱등 갱신.

### 5.3 release
- **무엇**: 태그 + 릴리즈 노트 합성 + README 릴리즈 표 갱신.
- **동작**: 직전 태그 이후 CHANGELOG diff + 신규 ADR + 커밋 요약을 모아 풍부한 릴리즈 노트 합성. `gh` CLI가 있으면 `gh release create`, 없으면 노트 파일(`RELEASE_NOTES.md`)만 생성. README 내 `<!-- chronicle:releases -->` 앵커 기반 표 갱신(멱등).
- **헬퍼**: `release-notes.mjs`. `gh`는 **선택적 의존** — 부재 시 graceful fallback.

### 5.4 devlog
- **무엇**: 세션별 개발일지.
- **동작**: 현재 세션 작업을 표준 섹션(config 지정)으로 정리해 `devlog/YYYY-MM-DD[-N].html` 생성(같은 날 재호출 시 `-2`, `-3` 시퀀스, **덮어쓰기 금지**). `index.html` 최신순 누적 갱신.
- **헬퍼**: `devlog-render.mjs` — 인라인 CSS HTML 렌더(외부 의존 0), index 누적.

### 5.5 index
- **무엇**: 프로젝트 단일 진입점(navigation hub).
- **동작**: ADR·릴리즈·CHANGELOG·devlog를 파싱해 의도별 내비게이션 INDEX 생성(`.md` 또는 시각화 `.html`). config `sources`로 포함 대상 선택.
- **헬퍼**: `index-render.mjs`.

### 5.6 claude-md
- **무엇**: `CLAUDE.md` 지속 갱신 (기본 `/init`과 차별 = 유지보수).
- **동작**: 아키텍처/규약/명령 변경을 감지해 해당 섹션만 갱신, 문서가 늘어지지 않게 정리. 신규 생성이 아니라 **기존 문서의 점진 유지보수**에 초점.
- **헬퍼**: 없음 (LLM-driven). 기존 CLAUDE.md를 읽고 섹션 단위 편집.

## 6. 헬퍼 스크립트 원칙

- **Node 18+ native만**: `node:fs`, `node:path` 등 표준 모듈. **npm 의존성 0** (package.json은 없거나 `dependencies: {}`).
- **호출**: SKILL.md에서 `node "${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs" <args>`.
- **공통 인터페이스**: `--config <path>`(생략 시 자동 감지), `--dry-run`, JSON stdin/stdout. 부수효과(파일 쓰기)는 명시적 플래그 또는 기본 동작으로 구분.
- **결정론적**: 같은 입력 → 같은 출력. LLM이 매번 파싱/렌더하는 비용·편차 제거.
- **`gh` CLI**: release skill에서만 선택적. 부재 감지 시 노트 파일 생성으로 우회.

## 7. 설치 & 배포

- repo 자체가 marketplace: `.claude-plugin/marketplace.json`의 plugin source가 `"."`.
- 사용자 흐름:
  ```
  /plugin marketplace add sp-daewoon/chronicle
  /plugin install chronicle@chronicle
  ```
- `plugin.json`에 explicit semver. 릴리즈는 chronicle 스스로 관리(dogfooding) → `git tag` + GitHub Release.

## 8. skillsmp.com 등재

- skillsmp.com은 **수동 제출 폼이 없고 GitHub 자동 스크래핑** 방식.
- 충족 조건: ① public repo ② 표준 `SKILL.md`(frontmatter `name`/`description`) ③ **⭐2개 이상**.
- README에 "skillsmp 등재 원리 + star 안내" 섹션 포함. 별도 신청 절차 불필요.

## 9. README 구성

1. 배지 헤더(license, plugin, skillsmp) + 한 줄 소개
2. (데모 스크린샷/GIF 자리)
3. Quick install (2줄 명령)
4. 6 skill 소개 표 (skill · 슬래시 · 한 줄 설명)
5. 워크플로별 사용법 (각 skill 짧은 예시)
6. config 레퍼런스 (`chronicle.config.json` 필드 설명 + 자동 감지 동작)
7. marketplace / skillsmp.com 등재 안내
8. 기여 가이드 + MIT 라이선스

## 10. 단위 경계 (isolation & clarity)

| 단위 | 책임 | 의존 |
|---|---|---|
| `scripts/lib/config.mjs` | 설정 로드·감지·병합 | node:fs |
| `scripts/lib/md.mjs` | 마크다운·frontmatter 파싱 | (없음) |
| `scripts/lib/fsutil.mjs` | 파일 IO·멱등 앵커 치환 | node:fs |
| `scripts/*-*.mjs` (5개) | 워크플로별 결정론적 작업 | lib/* |
| `skills/*/SKILL.md` (6개) | LLM 지침 + 헬퍼 호출 시점 | scripts/* |
| `commands/*.md` (6개) | 슬래시 진입점 | skills/* |

각 헬퍼는 stdin/stdout JSON으로 격리 → 단독 테스트 가능.

## 11. 비범위 (YAGNI)

- magicJar baseline 4-sub-agent 병렬 사이클 (특정 운영 형태 — 제외)
- CHANGELOG 슬롯 채번 anchor (다중 에이전트 충돌 회피용 — 범용 불필요, 단순 `[Unreleased]` 방식)
- gradle/Spring 결합 (release는 provider 추상화)
- 설정 파일 강제 (자동 감지로 대체)

## 12. 검증 전략 (R-last)

- 헬퍼별 Node native 테스트(`node --test`): 입력 fixture → 출력 스냅샷.
- 통합: `examples/` 샘플 프로젝트에 6 skill 시나리오 dry-run.
- `claude plugin validate .`로 manifest 검증.
- 로컬 install 스모크: `/plugin marketplace add ./chronicle` → `/plugin install` → 각 슬래시 동작.
