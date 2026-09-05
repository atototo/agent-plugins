# Agent Plugins

[atototo/agent-plugins](https://github.com/atototo/agent-plugins)

하나의 저장소에서 여러 **플러그인**을 관리하고, 한 번의 설치 명령으로
Codex · Claude Code · OpenCode 중 원하는 하네스에 연결하는 로컬 우선 프로젝트다.

첫 플러그인은 **ELI5 Visual**이다. 사용자가 작성한 설명·편집 원칙을 중심으로
`visual-explainer@0.11.0` MCP를 번들링한다. Playwright MCP는 설치하지 않는다.
실행 환경의 브라우저를 우선 사용하고, 실제 HTML을 렌더링한 화면으로 검증한다.

현재 상태: 초기 개발용 v0.1.0. npm에는 아직 게시하지 않았으며, npm 이름은
작업용이다. Codex 형식 검사, 설치 어댑터 자동 테스트, 실제 MCP 실행 테스트를
구분해서 제공한다. **어댑터 모형 테스트는 세 하네스의 실제 설치 검증이 아니다.**

## 개발 시작

Node.js 22 이상이 필요하다. 처음 시작한다면:

```bash
git clone https://github.com/atototo/agent-plugins.git
cd agent-plugins
npm ci
npm run check
```

`check`는 로컬 빌드 → 패키지 무결성 검사 → 설치/설정 테스트 → 실제 MCP
프로토콜 테스트를 실행한다. 사용자 하네스 설정을 수정하지 않는다.

브라우저 검증은 **개발자용** 선택 테스트다. 새 환경에서는 브라우저 바이너리를
한 번 준비해야 한다. 이는 플러그인 설치자의 필수 의존성이 아니다.

```bash
npx playwright install chromium
npm run test:browser
```

Linux에서는 Chromium용 시스템 라이브러리와 한글 폰트도 필요하다. CI는 일회용
runner에서 브라우저 의존성을 준비한다. 로컬 시스템 패키지는 이 프로젝트가 자동으로
설치하지 않는다. 실행 환경에서 라이브러리가 누락되면 화면 검증 미완료로 구분한다.

## 설치: 명령은 한 번

먼저 변경 계획만 확인한다:

```bash
node bin/agent-plugins.mjs install eli5-visual --harness all --dry-run
```

사용할 하네스를 모두 설치해 두고 실제 설정을 적용한다:

```bash
node bin/agent-plugins.mjs install eli5-visual --harness all --yes
```

원하는 하네스만 선택할 수도 있다:

```bash
node bin/agent-plugins.mjs install eli5-visual --harness codex,opencode --yes
```

대화형 터미널에서 `--harness`를 생략하면 하네스 선택을 묻는다. `all`은 세 하네스를
명시적으로 선택한다는 뜻이며, 설치되지 않은 하네스를 조용히 건너뛰지 않는다.
Codex/Claude CLI가 없으면 설정 변경 전에 실패한다. 하네스 자체는 설치하지 않는다.
현재 설치기는 Codex CLI **0.153.4 이상**, Claude Code **2.1.212 이상**을 요구한다.
Claude는 데이터 보존을 위해 `plugin uninstall --keep-data` 지원도 확인한다.

설치 범위는 **user/global**이다. 프로젝트 설정은 수정하지 않는다. Codex/Claude는
공식 마켓플레이스·플러그인 명령을 사용한다. OpenCode는 global JSON/JSONC의
`plugin` 배열에 실제 플러그인 모듈을 등록한다. 그 모듈이 스킬 경로와 MCP 설정을
추가한다. OpenCode 실행 파일은 설치 등록의 선행조건이 아니지만, 실제 로딩은
OpenCode에서 별도로 확인해야 한다.

설치 뒤 새 세션을 시작한다. Claude Code에서는 지원되는 경우 `/reload-plugins`를
사용할 수 있다. 스킬은 보통 Codex의 `$eli5-visual`, Claude Code의
`/eli5-visual:eli5-visual`, OpenCode의 스킬 탐색 또는 자연어 요청으로 사용한다.

요청 예: “이 설계 문서를 처음 보는 사람에게 중요한 제약과 다음 할 일까지
빠뜨리지 않는 스크롤형 시각 설명으로 만들어줘.”

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

## 배포 준비

```bash
npm run pack:local
```

생성된 `.tgz`에는 빌드 완료된 세 하네스용 패키지가 포함된다. 사용자는 렌더러를
직접 빌드할 필요가 없다. 예를 들어 로컬 tarball은 다음 한 명령으로 사용할 수 있다:

```bash
npx --yes --package ./personal-agent-plugins-0.1.0.tgz agent-plugins install eli5-visual --harness all --yes
```

GitHub Actions는 같은 검증을 수행하고 수동 실행 시 배포용 tarball을 artifact로
제공한다. 이 workflow는 npm에 자동 게시하지 않는다. npm에 게시하기 전
패키지 이름·라이선스를 결정하고 `private: true`를 해제해야 한다.
공개 저장소와 오픈소스 라이선스 부여는 별개이므로 현재 자체 코드는 `UNLICENSED`다.
외부 코드의 라이선스는 별도로 유지한다.

직접 네이티브 마켓플레이스를 쓰려면 `dist/codex`, `dist/claude`가 각각 마켓플레이스
루트다. 개발자 전용 수동 경로이며, 평소에는 소유권·업데이트 추적이 있는 단일 CLI를
권장한다. 소스 GitHub 저장소의 루트는 마켓플레이스가 아니다. 네이티브 GitHub 등록을
제공하려면 생성된 해당 루트를 별도 배포 브랜치/레포에 게시해야 한다.

## 확장과 범위

[전체 설계](docs/DESIGN.md), [조사 근거](docs/RESEARCH.md),
[검증 범위](docs/VALIDATION.md)를 참고한다.

v0.1.0은 **skills + 로컬 MCP**를 담는 플러그인을 지원한다. 훅·에이전트·LSP의
범용 변환, 프로젝트 범위 설치, 자동 브라우저 설치, 공개 registry, 자동 게시,
Windows 네이티브 명령 실행은 아직 보장하지 않는다. 지원하지 않는 필드는 빌드에서
오류로 처리하며 기능을 조용히 버리지 않는다.
