# 검증 수준과 게시 전 확인

테스트 이름과 실제 사용자 경험을 구분한다.

## 사용자 실환경 확인과 npm 배포 준비 — 2026-09-07

- 사용자가 다른 환경에서 Codex·Claude Code·OpenCode 모두 테스트했고 잘 동작한다고
  보고했다. 이는 사용자 확인이며, 에이전트가 해당 환경을 직접 실행한 결과가 아니다.
  하네스별 버전·OS·업데이트/제거 세부 로그는 받지 않았으므로 범위를 추정하지 않는다.
- npm 계정 `atototo` 로그인 확인 후 패키지 이름을 `@atototo/agent-plugins`,
  배포 버전을 `0.1.1`로 설정했다. 카탈로그 이름 `agent-plugins`와 기존 설치 기록
  경로는 유지해 소스 설치에서 npm 업데이트로 전환할 수 있게 한다.
- 자체 코드·스킬에 MIT LICENSE를 추가하고 각 하네스 번들에도 동봉한다.
  외부 라이선스 고지는 별도로 유지한다. 초기 배포 이후에도 자동 배경 업데이트는 없다.
- `npm run check`: 기존 회귀와 새 npm 파일 목록 검사까지 **33개** 테스트 통과.
  배포 archive에 실행 코드·세 하네스 번들·MIT 및 외부 라이선스 고지가 포함되며,
  `.npmrc`, `.test-output`, 개발용 테스트·스크립트가 제외됨을 확인했다.
- 독립된 임시 디렉터리와 새 npm 캐시에서 실제 tarball을 `npx --package`로 실행했다.
  기존 소스 번들 `82a015becb28`로 설치한 OpenCode 테스트 기록을 npm 배포 번들
  `6b5094d63543`으로 갱신하면서 카탈로그와 저장된 설정 경로를 이어 썼다.
  반복 업데이트의 중복 방지와 제거 후 기존 설정·주석 보존도 통과했다.
  이 검사는 임시 OpenCode 설정 대상이며 실제 OpenCode 모델 부팅 검사가 아니다.
- Chromium fixture의 1200px·390px 자동 검사도 재통과했고 페이지 오류는 0이었다.
- 개발 의존성까지 포함한 `npm audit`는 `visual-explainer → pptxgenjs → image-size`의
  high 경고 3개를 보고했다. [ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)와
  [JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) 이미지 파서의 무한 루프 문제다.
  `npm audit --omit=dev`는 0건이었고, HTML MCP에 연결된 번들 의존성 목록에는
  `pptxgenjs`와 `image-size`가 없었다. 보존한 upstream 원본에는 PPTX export 스크립트가
  있지만 해당 라이브러리는 배포하지 않으며 이 플러그인의 MCP 도구로 노출하지 않는다.
  개발 의존성 경고가 해결된 것은 아니며 upstream PPTX 도구에 신뢰하지 않는 이미지를
  넣는 용도는 검증 범위 밖이다.

## 실제 Codex 설치·사용 검사 — 2026-09-06

Codex CLI **0.153.4**, Linux, 기존 ChatGPT 로그인으로 검사했다. 별도 API 키를
만들거나 모델을 바꾸지 않았다. 이 절은 아래의 이전 mock 검사와 별개다.

- `install` → 새 app-server 세션에서 스킬 발견 → 실제 MCP 도구 호출 성공.
  발견된 스킬 이름은 `eli5-visual:eli5-visual`이다.
- v0.1.0에서 하네스에 지정한 `AGENT_PLUGINS_OUTPUT_DIR`가 MCP에 전달되지
  않아 기본 경로로 저장되는 문제를 재현했다.
- 가상 Report API 원문을 실제 모델에 주어 HTML 생성을 확인했다. 생성 후
  파일 검사 중 `bwrap` namespace 오류가 발생했고, 제한 시간 내 최종 답변을
  완료하지 못했다. 따라서 이 실행을 전체 사용자 경험 통과로 보지 않는다.
- 검사하는 쪽에서 생성된 HTML을 직접 읽고 Chromium으로 1200px·390px 화면을
  확인했다. 주요 원문 사실이 보존됐고 가로 넘침·페이지 오류는 없었다.
  이는 모델 자신이 화면 검증·최종 전달까지 성공했다는 뜻이 아니다.
- 테스트 전용 v0.1.1 번들로 실제 `update`를 실행해 이전 등록 제거와 새
  버전의 스킬·MCP 로딩을 확인했다. 해당 번들은 제품 소스를 바꾸지 않은
  업데이트 검사 fixture이며 아래 개선판과는 다른 digest다.
- 테스트용 등록과 해당 네이티브 캐시를 제거한 뒤 기존 플러그인 식별자·버전·
  활성 상태, 마켓플레이스 목록, `config.toml` SHA-256이 이전과 일치했다.
  테스트 결과 HTML과 진단 로그는 보존했다.

## Codex 개선판 v0.1.1

이 버전은 출력 경로 전달, 호출 명령 문서, 검증 차단 시 결과 전달 지침을
보완한다. 스킬 작성 지침에 따라 차단 원인을 해결하지 못하는 동일 경로 재시도는
중단하고, 저장 도구가 반환한 경로와 실제 완료·미완료 검사를 구분해서 전달한다.
권한이나 커널 설정을 변경하는 우회는 추가하지 않았다.

- `npm run check`: 자동 테스트 **32개**, 번들 검증, 실제 MCP 검사 통과.
- Codex plugin validator와 skill validator 통과.
- 새 번들 `82a015becb28`을 실제 Codex에 등록하고, 새 app-server에서 스킬
  v0.1.1과 MCP 로딩을 확인했다. 환경변수에 공백·한글이 포함된 절대 경로를
  지정했을 때 해당 폴더에 저장됐고, 변수를 없앤 새 프로세스에서는 기본 경로에
  저장됐다. 반환 경로와 실제 파일 내용을 대조했다. 외부 MCP의 기본 파비콘
  추가 외에는 제출한 fixture 내용이 유지됐다.
- 실제 기본 모델에 도서관 반납함과 책장 정리의 차이를 짧은 HTML 설명으로
  요청했다. 모델이 갱신된 스킬 참고 문서를 읽고, MCP로 저장하고, 저장된 HTML을
  다시 읽었다. 브라우저 도구 탐색 중 `bwrap` 오류가 한 번 발생한 뒤 동일한
  실패 명령을 반복하지 않고 HTML 링크와 화면 검사 미완료 사유를 최종 전달했다.
  프로세스는 제한 시간 안에 exit 0으로 종료했고 링크 대상 파일도 존재했다.
- 위 행동 검사는 **짧은 설명 한 사례**다. 이번에는 저장 파일 읽기가 성공했으므로
  파일 읽기까지 차단되는 경우의 최종 전달 행동은 별도 재검증이 남아 있다.
  모델이 실제 화면까지 검사했다거나 모든 긴 원문에서 같은 행동을 보장하지 않는다.
- `npm run test:browser`의 기존 fixture 검사도 1200px·390px에서 재통과했고
  페이지 오류는 0이었다. 이번 새 모델 출력의 시각 품질 검수와는 구분한다.
- 실제 검사 후 테스트용 등록과 네이티브 캐시만 제거했다. 기존 플러그인 식별자·
  버전·활성 상태, 마켓플레이스 목록, `config.toml` SHA-256 일치를 확인했다.
  HTML·로그·설치기 스냅샷은 보존했다. 실제 Codex 검사는 CI 자동 검사에 포함되지 않는다.
- 이 검사 당시 npm 패키지는 미게시 개발판 v0.1.0이었다. 위 v0.1.1은 포함된
  `eli5-visual` 플러그인의 버전이며 npm 게시를 수행한 것이 아니다.

## 설치기 업데이트 검증 — 2026-09-06

- `npm run check` 통과: 기존 19개와 신규 업데이트 회귀 테스트 13개, 총 **32개** 성공.
- 인자 없는 업데이트, 여러 플러그인의 서로 다른 설치 조합 유지, `all`/선택 필터,
  저장된 OpenCode 경로 재사용, 미설치 상태의 무변경 종료, CLI 적용 확인 절차 검증.
- 다른 카탈로그 보존, 사라진 플러그인의 자동 삭제 거부, 부분 실패·이전 버전 제거 실패
  재시도, 제거 중인 항목의 재설치 차단 확인.
- Codex/Claude 등록은 test double, OpenCode 설정 편집과 CLI 실행은 임시 디렉터리에서 검증했다.
  사용자 하네스 설정은 변경하지 않았으며, 실제 세 하네스의 end-to-end 검증은 여전히 남아 있다.
- 실제 MCP 검사 재통과. Chromium fixture의 1200px·390px 자동 검사도 재통과했고 page error는 0이다.
  이번 변경은 설치기·문서 대상이므로 새 시각 품질 검수로 주장하지 않는다.
- `npm pack --ignore-scripts`로 만든 tarball을 `npx --package <파일>`로 실행해
  `update --dry-run`과 `update --yes`가 설치 기록이 없는 임시 경로를 만들지 않고 종료함을 확인했다.
- npm 게시나 실제 하네스 설치는 수행하지 않았다. 패키지 이름·버전·공개 제한은 유지한다.

## 초기 플러그인 검증 — 2026-09-05

- Node.js 22.23.0 / Linux에서 `npm run check` 통과: 자동 테스트 19개 모두 성공.
- 같은 소스로 재빌드한 번들의 digest 일치, 다른 경로로 옮긴 패키지의 실제 MCP 실행 성공.
- MCP 연결, 도구·리소스 목록, full/quick HTML 저장, 출력 경로 이탈 거부 확인.
- 생성된 Codex 패키지와 스킬은 로컬 공식 validator 통과.
- 실제 Chromium에서 1200px·390px fixture 렌더링 성공. 가로 넘침 없음, page error 0.
- 데스크톱·모바일 캡처를 직접 열어 한글 표시, 섹션 순서, 연결선, 글자 잘림을 확인했다.
  이는 고정 fixture의 검수이며, 에이전트가 생성하는 모든 설명에 대한 품질 보장은 아니다.

처음 브라우저 실행은 OS 공유 라이브러리 누락으로 실패했다. 시스템 패키지를
설치하지 않고 `.test-output/sysroot`에 필요한 라이브러리·폰트를 추출한 뒤,
해당 검사 프로세스에만 아래 환경을 적용해 통과했다:

```bash
LD_LIBRARY_PATH="$PWD/.test-output/sysroot/usr/lib/x86_64-linux-gnu" \
FONTCONFIG_FILE="$PWD/.test-output/fonts.conf" \
PLAYWRIGHT_BROWSERS_PATH="$PWD/.test-output/playwright" \
npm run test:browser
```

이 환경별 우회 파일·브라우저 바이너리·캡처는 Git 및 npm 배포에서 제외된다.
새 개발 환경에서는 README의 브라우저 의존성 준비가 별도로 필요하다.

## 검사별 경계

| 검사 | 증명하는 것 | 증명하지 않는 것 |
| --- | --- | --- |
| `npm run validate` | 번들 inventory, SHA-256, native manifest identity/version | 발행자의 신뢰, 세션 권한 |
| `npm test` | 설정 보존, 소유권, 중복 설치, 업데이트, 실패 재시도, 경로 차단 | 실제 Claude/OpenCode CLI의 설치 승인 |
| OpenCode module test | 실제 생성 모듈을 import하여 config hook 실행 | OpenCode 전체 부팅과 스킬 선택 |
| `npm run test:mcp` | 번들된 외부 MCP 실행, handshake/tools/resources, HTML 생성, traversal 차단 | 화면의 미적 품질, 원문 충실도 |
| `npm run test:browser` | fixture HTML을 MCP로 저장한 뒤 실제 브라우저 렌더링과 overflow 검사 | 모델이 어떤 원문이든 완전하게 설명한다는 보장 |
| Codex skill/plugin validator | 로컬 공식 가이드의 schema와 naming 요건 | native 설치·로드·도구 호출 전체 흐름 |

게시 전 실제 하네스별로 다음 시나리오를 확인해야 한다:

1. 기존 설정이 있는 사용자 계정에서 dry-run → install → 새 세션 시작.
2. 스킬 발견과 MCP 도구 연결 확인.
3. 짧은 개념 설명과 긴 원문 브리프를 각각 요청.
4. 원문 중요 사실, HTML 전달, 실제 화면 검수 여부 확인.
5. update → 중복 활성화가 없는지 → remove → 기존 플러그인/HTML 보존 확인.

현재 로컬에서 Claude Code/OpenCode CLI가 없어 native end-to-end 설치는 별도
확인이 필요하다. Codex의 실제 검사 범위는 위 기록을 따른다. 로컬 검사가
통과했다고 아직 push하지 않은 변경의 GitHub Actions까지 통과한 것은 아니다.

v0.1.0 native installer는 Linux/macOS 계열을 대상으로 작성했다. 이 작업에서
실행한 환경은 Linux다. Windows의 npm `.cmd` shim 실행은 아직 지원하지 않는다.
코드의 symlink 거부 정책 때문에 symlink로 연결된 config/storage는 명시적인 실경로가
필요하다. 설정 파일 CAS는 동시 수정 위험을 줄이지만 외부 프로그램과 공통 lock을
공유하지 않으므로 OS 수준의 완전한 transaction을 보장하지 않는다.
