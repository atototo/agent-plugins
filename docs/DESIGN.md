# 전체 설계 — v0.1.0

## 사용자 요구와 구현 결정

| 요구 | 결정 |
| --- | --- |
| 하나의 저장소에서 여러 플러그인 관리 | `plugins/<name>/plugin.json` + 실제 리소스, `catalog.json`의 순서 있는 목록 |
| 패키징 단위는 스킬이 아니라 플러그인 | 플러그인별 스킬·MCP·하네스 메타데이터를 하나의 버전으로 배포 |
| Codex, Claude Code, OpenCode 지원 | 서로 다른 native manifest/config를 독립 렌더러로 생성 |
| 설치를 한 번만 수행 | 단일 CLI가 대상 선택, 사전 검사, 등록, 설치, 기록을 수행 |
| 로컬 검증 후 GitHub에 업로드 | 개발자의 `npm run check`와 CI가 같은 코드를 실행 |
| 외부 도구 참고/활용 | `visual-explainer@0.11.0`을 lockfile로 고정해 번들링 |
| 불필요한 Playwright MCP 제외 | 실행 시 host-first 검증. Playwright 라이브러리는 개발 테스트용 |

## 디렉터리 책임

```text
catalog.json                     플러그인 목록과 카탈로그 메타데이터
plugins/eli5-visual/              하네스 독립적인 원본
  plugin.json                    패키지 정의
  skills/eli5-visual/             공통 편집 원칙과 렌더링/검증 지침
renderers/                       Codex / Claude / OpenCode 패키지 생성
  guidance/                      세션별 사용 지침(도구가 있다고 가정하지 않음)
runtime/launch.mjs               번들된 외부 MCP를 실행하는 작은 프로세스 래퍼
src/                            검증기, 설정 편집, 설치 상태·수명주기
bin/agent-plugins.mjs            단일 사용자 설치 명령
scripts/                        로컬 빌드, MCP/브라우저 smoke test
test/                           격리된 설치·충돌·실패·복구 테스트
dist/                           생성물: 세 하네스 패키지 + 해시 manifest
```

OpenCode 모듈은 빈 형식 맞추기용 플러그인이 아니다. 실제 `config` hook에서 자기
패키지의 `skills` 경로와 MCP 실행 명령을 추가한다. 외부 설정의 동일 MCP 키가
충돌하면 기존 값을 덮어쓰지 않고 오류를 낸다.

## 두 종류의 렌더링 시점

1. **개발/배포 시 패키지 렌더러:** 공통 정의를 세 하네스 형식으로 변환한다.
   개발자가 로컬에서 돌리고, CI가 다시 실행한다. 에이전트 응답마다 실행하지 않는다.
2. **플러그인 사용 시 HTML 렌더링:** 에이전트가 설명을 구성하고 HTML을 작성한다.
   외부 MCP가 파일을 저장하고, 사용 가능한 브라우저가 그 파일을 렌더링한다.

MCP 서버는 설명의 정확성이나 디자인 품질을 판정하지 않는다. 편집/검증 책임은
스킬에 남아 있다. HTML 기본 형식 검사와 실제 브라우저 시각 검사를 혼동하지 않는다.

## ELI5 Visual 원문에서 변경한 지점

사용자가 붙여 준 원문의 설명 목적, 사실 보존 목록, 초보자에게 필요한 맥락,
세로 문서 구성, 정보에 맞는 다이어그램 선택, 사실적인 제목, 과도한 반복 검수
금지, 프로젝트 수정 금지를 유지했다. 하네스 공통화를 위해 다음을 조정했다:

- 항상 설치된 Visualize가 있다는 가정을 제거했다.
- 공통 출력은 편집 가능한 self-contained HTML과 실제 파일 참조다.
- 실제 live Visualize가 있으면 그 계약을 다시 읽고 native inline 출력에 적용한다.
  특정 호스트의 content reference를 다른 하네스에 출력하지 않는다.
- 원문의 “파일 요청 때만 standalone HTML”은 사용자가 동의한 공통 HTML 전달
  정책으로 확장했다. native inline을 요청하면 기능 지원 여부를 확인한다.
- 브라우저 검증 수단은 고정하지 않지만, 수행한 검사/미실시 상태는 정확히 보고한다.
- upstream MCP는 프로세스당 출력 폴더 하나만 지원한다. 공통 경로에서는 작업별
  고유 basename으로 충돌을 피한다. 진짜 작업별 폴더 격리는 아직 제공하지 않는다.

## 빌드와 공급망

개발 의존성은 정확한 버전과 `package-lock.json` integrity로 고정한다. npm의
자동 lifecycle 실행을 비활성화한다. visual-explainer의 MCP 서버 의존성을 ESM으로
번들링하고, import.meta.url에 의존하는 quick renderer 및 필요한 리소스의 디렉터리
구조는 보존한다. 외부 라이선스 전문을 생성된 runtime notices에 포함한다.

완성된 패키지는 외부 npm 다운로드 없이 MCP를 시작할 수 있다(Node 필요).
설치기는 배포된 `dist`를 읽기만 하고, 사용자의 기계에서 소스 빌드를 하지 않는다.
해시는 손상/변경을 발견하는 장치이지 게시자의 신뢰를 인증하는 서명이 아니다.
신뢰한 npm 패키지나 배포 경로만 설치해야 한다.

## 설치 수명주기와 소유권

사전 검사 → 검증된 immutable snapshot 준비 → 하네스별 intent 기록 →
native 등록/설치 → 결과 확인 → receipt 기록 순서다.

스냅샷은 원본 번들 digest를 경로로 사용한다. native 마켓플레이스 이름에도 digest
접미사를 붙여 다른 릴리스·사용자 마켓플레이스와의 충돌을 구분한다. 설치할 때
카탈로그 이름만 바꾸고 스냅샷의 해시를 다시 계산해 보관한다.

native CLI들이 공통 transaction을 제공하지 않으므로 전역 원자성은 보장하지
않는다. intent/진행 상태를 먼저 기록하고 실패 시 이를 숨기지 않는다. 같은 명령의
재실행은 이미 등록된 소유 항목을 재사용하고 미완료 지점부터 이어간다. 불명확한
상태를 “성공”으로 간주하지 않는다. 강제 종료 후 남은 잠금은 죽은 PID만 해제 가능하다.

업데이트는 새 패키지를 먼저 등록한 후 이 설치기가 관리하는 이전 버전을 제거한다.
제거가 실패하면 두 버전이 잠시 등록될 수 있으므로 `status`와 오류를 보고하고
같은 update를 재시도한다. 기본 `install`은 다른 빌드의 무단 교체를 거부한다.

`update`의 기본 대상은 현재 번들과 카탈로그 이름이 같은 receipt의 **정확한
플러그인·하네스 조합**이다. 이름 목록과 하네스 목록의 모든 조합을 새로 만들지 않는다.
플러그인 이름과 `--harness`는 이 집합을 좁히는 선택 필터다. `all`도 새 설치를 허용하지 않는다.
OpenCode 설정 경로는 이전 digest의 receipt에서도 복원하며, 명시 경로와의 충돌을 거부한다.
기본 업데이트에 receipt가 없으면 스냅샷·상태 디렉터리 없이 종료한다. 명시 필터에
일치 항목이 없으면 오류다. 계획에는 기록된 버전과 적용 버전을 함께 표시한다.

`installing`/`failed` receipt는 같은 조합의 재시도에 포함한다. `removing` receipt는
설치를 되살리지 않도록 중단한다. 새 번들에서 빠진 관리 플러그인도 자동 제거하지 않고
선택 필터나 명시 제거를 요청한다. 업데이트는 네트워크에서 릴리스를 가져오지 않는다.
CLI 배포 버전과 플러그인 버전은 별개이며, 적용 단위는 실행 중인 패키지의 번들 digest다.

OpenCode JSONC는 전체 객체를 다시 직렬화하지 않고 배열 항목만 편집한다. 설정
변경 직전 내용을 대조하여 동시 수정을 발견하면 중단한다. 전체 설정을 백업으로
되돌리며 사용자의 새 수정을 지우는 방식은 사용하지 않는다.

제거는 소유권 receipt에 기재된 native selector/정확한 파일 URL만 대상으로 한다.
HTML, 버전 스냅샷, marketplace 등록은 남긴다. native cache 삭제는 각 하네스의
공식 uninstall 명령에 위임하고 Claude의 persistent data는 `--keep-data`로 보존한다.

## 다음 확장을 위한 경계

새 스킬 기반 플러그인은 `plugins/<name>`과 catalog 항목을 추가한다. MCP가
필요 없으면 `mcp: {}`로 설정한다. 새 MCP 제공자는 버전 고정, 번들링, 리소스 위치,
stdio smoke test를 갖춘 provider adapter를 추가한다. 임의의 upstream 명령을
무검증으로 실행하는 범용 wrapper는 만들지 않는다.

훅/에이전트/LSP는 공통 의미가 확인될 때 capability 단위로 확장한다. v0.1.0에서
이를 지원한다고 주장하거나 기능을 조용히 누락하지 않는다. GitHub 저장소는
`atototo/agent-plugins`로 확정했다. npm 패키지 이름·공개 라이선스·npm 소유자와
실제 세 하네스 실행 검증은 정식 배포 전 확인할 항목이다.
