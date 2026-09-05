# 검증 수준과 게시 전 확인

테스트 이름과 실제 사용자 경험을 구분한다.

## 이번 로컬 실행 결과 — 2026-09-05

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
확인이 필요하다. Codex도 실제 사용자 설정을 변경하지 않았으므로 native 설치
완료라고 보고하지 않는다. CI workflow 파일을 만들었다고 CI 실행이 성공한 것은 아니다.

v0.1.0 native installer는 Linux/macOS 계열을 대상으로 작성했다. 이 작업에서
실행한 환경은 Linux다. Windows의 npm `.cmd` shim 실행은 아직 지원하지 않는다.
코드의 symlink 거부 정책 때문에 symlink로 연결된 config/storage는 명시적인 실경로가
필요하다. 설정 파일 CAS는 동시 수정 위험을 줄이지만 외부 프로그램과 공통 lock을
공유하지 않으므로 OS 수준의 완전한 transaction을 보장하지 않는다.
