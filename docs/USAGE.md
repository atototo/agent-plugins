# 설치·운영 가이드

[README로 돌아가기](../README.md)

소스로 준비하고 설치 계획을 확인하는 과정은 [README의 설치하기](../README.md#install)에 있다. 이 문서는 패키지 설치와 설치 후 운영, 경로 선택, 실패 복구를 다룬다.

<a id="package-install"></a>

## 빌드된 패키지로 설치하기

npm에는 아직 게시하지 않았다. 개발자가 `npm run pack:local`로 만든 tarball 또는 [성공한 GitHub Actions 실행](https://github.com/atototo/agent-plugins/actions/workflows/check.yml)의 artifact를 내려받아 풀면 `personal-agent-plugins-0.1.0.tgz`를 사용할 수 있다. 검증한 커밋의 신뢰할 수 있는 패키지를 선택한다.

**Node.js 22 이상과 사용할 하네스는 별도로 준비해야 한다.** 하네스 자체나 브라우저는 설치기가 대신 설치하지 않는다.

```bash
# tarball이 있는 디렉터리에서: 먼저 계획만 확인
npx --yes --package ./personal-agent-plugins-0.1.0.tgz \
  agent-plugins install eli5-visual --harness all --dry-run

# 실제 하네스 설정에 적용
npx --yes --package ./personal-agent-plugins-0.1.0.tgz \
  agent-plugins install eli5-visual --harness all --yes
```

패키지에는 빌드된 세 하네스용 파일이 들어 있다. 설치자는 렌더러를 다시 빌드하지 않는다. `npx --yes`는 npm 실행 확인을, 끝의 `--yes`는 설치기의 설정 변경 적용을 확인한다.

## 설치 후 사용하기

설치 뒤 새 세션을 시작한다. Claude Code에서는 지원되는 경우 `/reload-plugins`를
사용할 수 있다. 스킬은 보통 Codex의 `$eli5-visual`, Claude Code의
`/eli5-visual:eli5-visual`, OpenCode의 스킬 탐색 또는 자연어 요청으로 사용한다.

요청 예: “이 설계 문서를 처음 보는 사람에게 중요한 제약과 다음 할 일까지
빠뜨리지 않는 스크롤형 시각 설명으로 만들어줘.”

아래 명령은 소스 저장소 디렉터리에서 실행한다. tarball을 사용할 때는 같은 하위 명령을 앞 절의 `npx … agent-plugins` 뒤에 붙인다.

## 상태·업데이트·제거

```bash
node bin/agent-plugins.mjs list
node bin/agent-plugins.mjs status
node bin/agent-plugins.mjs doctor
node bin/agent-plugins.mjs update eli5-visual --harness all --yes
node bin/agent-plugins.mjs remove eli5-visual --harness all --yes
```

업데이트는 새 `dist/`를 만들거나 새 CLI 패키지를 받은 뒤 실행한다. 같은 빌드의
설치는 재실행해도 중복되지 않는다. 다른 빌드로 바꾸는 것은 `update`로 명시한다.
새 버전의 등록을 확인한 뒤 이 설치기가 관리하던 이전 버전만 제거한다.

`doctor`는 파일 해시와 등록 상태를 확인한다. **MCP 연결 성공이나 브라우저 도구
가용성을 보증하지 않는다.** 사용 중인 세션에서 확인해야 하는 사항을 명시한다.

중간 실패 시 하네스별 진행 상태가 기록된다. 같은 명령을 다시 실행해 이어가거나
`remove`로 관리 중인 등록을 제거할 수 있다. 세 외부 CLI에 걸친 완전한 원자적
설치/롤백을 보장하지 않는다. 성공한 하네스가 자동으로 되돌아가지는 않는다.
프로세스가 강제 종료되어 잠금이 남으면 `status`를 확인한 뒤 `unlock --yes`를
사용한다. 살아 있는 프로세스의 잠금은 해제하지 않는다.

제거는 HTML 결과물, 버전별 패키지 스냅샷, 네이티브 마켓플레이스 등록을 보존한다.
마켓플레이스 전체를 제거하면 다른 플러그인까지 지워질 수 있기 때문이다.
디스크 정리/자동 GC는 v0.1.0 범위에 포함하지 않는다.

## 저장 위치와 안전 장치

- 설치 기록·스냅샷: `~/.local/share/agent-plugins/` (`--state-dir`로 변경 가능).
- HTML: `~/.agent/diagrams/eli5-visual/`. 하네스 시작 전
  `AGENT_PLUGINS_OUTPUT_DIR`로 별도 전용 경로를 지정할 수 있다.
- OpenCode: 기존 `opencode.jsonc`/`opencode.json`을 사용한다. 둘 다 있거나 사용자
  지정 `OPENCODE_CONFIG`가 있으면 `--opencode-config`로 대상을 명확히 지정한다.
- 기존 설정·주석과 나중에 사용자가 추가한 항목은 보존한다. 관리하지 않는 플러그인,
  충돌하는 MCP 키, 심볼릭 링크, 손상된 JSONC는 덮어쓰지 않는다.
- npm lifecycle 스크립트에서 하네스를 설치하지 않는다. 브라우저 도구 설치·권한 변경,
  계정 로그인, 결과 공개도 자동으로 수행하지 않는다.
- MCP는 로컬 stdio 프로세스다. 단, 에이전트가 읽는 자료와 MCP 결과는 선택한 모델의
  제공자에게 전달될 수 있다. “로컬 MCP”가 “전체 작업이 오프라인”이라는 뜻은 아니다.

OpenCode 설정 루트는 `OPENCODE_CONFIG_DIR`와 `XDG_CONFIG_HOME`을 반영한다. 심볼릭 링크로 연결된 config/storage는 명시적인 실경로가 필요하다. 설정 내용 대조는 동시 수정 위험을 줄이지만 외부 프로그램과 공통 잠금을 쓰는 완전한 transaction은 아니다.

<a id="browser-check"></a>

## 개발자의 브라우저 검증 준비

브라우저 검증은 **개발자용** 선택 테스트다. 새 환경에서는 브라우저 바이너리를
한 번 준비해야 한다. 이는 플러그인 설치자의 필수 의존성이 아니다.

```bash
npx playwright install chromium
npm run test:browser
```

Linux에서는 Chromium용 시스템 라이브러리와 한글 폰트도 필요하다. CI는 일회용
runner에서 브라우저 의존성을 준비한다. 로컬 시스템 패키지는 이 프로젝트가 자동으로
설치하지 않는다. 실행 환경에서 라이브러리가 누락되면 화면 검증 미완료로 구분한다.

fixture를 MCP로 저장하고 실제 브라우저로 열어 검사한다. `.test-output/browser/`의 캡처는 별도로 열어 확인해야 한다. 자동 검사만으로 디자인 품질이나 원문 충실도를 판정하지 않는다. 환경별 준비 및 검수 기록은 [검증 문서](VALIDATION.md)에 있다.

## 네이티브 마켓플레이스와 지원 범위

직접 네이티브 마켓플레이스를 쓰려면 `dist/codex`, `dist/claude`가 각각 마켓플레이스
루트다. 개발자 전용 수동 경로이며, 평소에는 소유권·업데이트 추적이 있는 단일 CLI를
권장한다. 소스 GitHub 저장소의 루트는 마켓플레이스가 아니다. 네이티브 GitHub 등록을
제공하려면 생성된 해당 루트를 별도 배포 브랜치/레포에 게시해야 한다.

v0.1 네이티브 설치기는 Linux/macOS 계열을 대상으로 작성했으며 실제 자동 검증 환경은 Linux다. Windows의 npm `.cmd` shim 실행과 프로젝트 범위 설치는 아직 지원하지 않는다. npm 게시 전 패키지 이름·라이선스·npm 소유자를 확정해야 하며, 현재 `private: true`와 `UNLICENSED`를 유지한다.

