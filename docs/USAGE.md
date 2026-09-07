# 설치·운영 가이드

[README로 돌아가기](../README.md)

소스로 준비하고 설치 계획을 확인하는 과정은 [README의 설치하기](../README.md#install)에 있다. 이 문서는 패키지 설치와 설치 후 운영, 경로 선택, 실패 복구를 다룬다.

<a id="package-install"></a>

## 빌드된 패키지로 설치하기

npm 배포 이름은 `@atototo/agent-plugins`다. clone이나 로컬 빌드 없이 실행한다:

```bash
npx --yes @atototo/agent-plugins@latest install eli5-visual --harness all --dry-run
npx --yes @atototo/agent-plugins@latest install eli5-visual --harness all --yes
```

개발자가 `npm run pack:local`로 만든 tarball 또는 [성공한 GitHub Actions 실행](https://github.com/atototo/agent-plugins/actions/workflows/check.yml)의 artifact도 사용할 수 있다. v0.1.1 파일명은 `atototo-agent-plugins-0.1.1.tgz`다. 검증한 커밋의 신뢰할 수 있는 패키지를 선택한다.

**Node.js 22 이상과 사용할 하네스는 별도로 준비해야 한다.** 하네스 자체나 브라우저는 설치기가 대신 설치하지 않는다.

```bash
# tarball이 있는 디렉터리에서: 먼저 계획만 확인
npx --yes --package ./atototo-agent-plugins-0.1.1.tgz \
  agent-plugins install eli5-visual --harness all --dry-run

# 실제 하네스 설정에 적용
npx --yes --package ./atototo-agent-plugins-0.1.1.tgz \
  agent-plugins install eli5-visual --harness all --yes
```

패키지에는 빌드된 세 하네스용 파일이 들어 있다. 설치자는 렌더러를 다시 빌드하지 않는다. `npx --yes`는 npm 실행 확인을, 끝의 `--yes`는 설치기의 설정 변경 적용을 확인한다.

## 설치 후 사용하기

설치 뒤 새 세션을 시작한다. Claude Code에서는 지원되는 경우 `/reload-plugins`를
사용할 수 있다. Codex에서는 `$eli5-visual:eli5-visual`로 호출한다
(Codex CLI 0.153.4 실제 설치에서 확인한 `플러그인:스킬` 이름). Claude Code에서는
`/eli5-visual:eli5-visual`, OpenCode에서는 스킬 탐색 또는 자연어 요청으로 사용한다.

요청 예: “이 설계 문서를 처음 보는 사람에게 중요한 제약과 다음 할 일까지
빠뜨리지 않는 스크롤형 시각 설명으로 만들어줘.”

아래 명령은 소스 저장소 디렉터리에서 실행한다. tarball을 사용할 때는 같은 하위 명령을 앞 절의 `npx … agent-plugins` 뒤에 붙인다.

## 상태 확인

```bash
node bin/agent-plugins.mjs list
node bin/agent-plugins.mjs status
node bin/agent-plugins.mjs doctor
```

`doctor`는 파일 해시와 등록 상태를 확인한다. **MCP 연결 성공이나 브라우저 도구
가용성을 보증하지 않는다.** 사용 중인 세션에서 확인해야 하는 사항을 명시한다.

<a id="update"></a>

## 업데이트: 새 패키지 준비 → 기존 설치에 적용

`update`는 **현재 실행 중인 CLI가 가진 번들**을 적용한다. GitHub나 npm에서 최신 버전을
찾아 다운로드하는 명령이 아니다. 이전 패키지로 실행하면 이전 번들이 적용될 수 있으므로
계획의 `fromVersions`(기록된 버전), `version`(적용할 버전), `digest`를 먼저 확인한다.
같은 빌드를 다시 적용해도 등록은 중복되지 않는다.

### 소스에서 사용하는 경우

소스로 설치했던 경우에도 아래 npm 명령으로 전환할 수 있다. 같은 사용자와 같은
`--state-dir`를 사용하면 기존 카탈로그 `agent-plugins`의 설치 기록을 이어 쓴다.

```bash
# 저장소 디렉터리에서 새 소스와 번들 준비
git pull --ff-only
npm ci
npm run check

# 기록된 모든 플러그인·하네스 조합을 확인한 뒤 한 번에 갱신
node bin/agent-plugins.mjs update --dry-run
node bin/agent-plugins.mjs update --yes
```

### 빌드된 tarball을 사용하는 경우

새 커밋의 CI artifact 또는 개발자가 제공한 새 tarball을 받는다. 아래 `NEW_PACKAGE.tgz`는
실제 받은 파일 경로로 바꾼다. 개발판 tarball의 이름이 같아도 커밋과 번들 digest는 다를 수 있다.

```bash
npx --yes --package ./NEW_PACKAGE.tgz agent-plugins update --dry-run
npx --yes --package ./NEW_PACKAGE.tgz agent-plugins update --yes
```

### 업데이트 범위

| 명령의 대상 부분 | 실제 갱신 범위 |
| --- | --- |
| `update` | 이 카탈로그의 설치 기록에 있는 모든 플러그인·하네스 조합 |
| `update eli5-visual` | 그 플러그인을 이미 등록한 하네스만 |
| `update --harness codex` | Codex에 이미 등록한 플러그인만 |
| `update eli5-visual --harness all` | 그 플러그인의 기존 설치 조합 전체. 새 하네스를 추가하지 않음 |

플러그인 이름과 `--harness`는 선택 필터이며, 생략해도 대상 선택 질문을 하지 않는다.
적용 확인은 별도다. `--yes`가 없으면 대화형 터미널에서 확인하고, 비대화형 실행에서는 중단한다.
기본 `update`에 설치 기록이 없으면 아무것도 만들지 않고 종료한다. 명시한 필터와 일치하는
기록이 없거나 이름이 잘못되면 오류를 낸다. 다른 카탈로그의 기록은 갱신하지 않는다.

처음에 `--state-dir`를 지정했다면 업데이트에도 **같은 경로**를 전달해야 한다.
OpenCode의 `--opencode-config`는 다시 전달하지 않아도 기록된 경로를 사용한다.
기록과 다른 경로를 지정하거나 기록끼리 경로가 충돌하면 자동 이전하지 않고 중단한다.

설치 기록의 `installing`/`failed` 항목도 재시도 대상이다. 아직 기록되지 않은 하네스까지
최초 설치를 마치려면 원래의 `install` 명령을 재실행한다. `removing` 상태는 업데이트로
되살리지 않으며, 해당 `remove`를 먼저 마쳐야 한다. 새 번들에서 사라진 플러그인은 자동
삭제하지 않는다. 기본 업데이트를 중단하므로 다른 플러그인만 명시하거나 제거 여부를 결정한다.

새 버전의 등록 단계가 성공한 뒤 이 설치기가 관리하던 이전 버전만 제거한다.
이는 실행 중 세션의 로딩 성공을 뜻하지 않는다. 적용 뒤 **새 하네스 세션**에서 확인한다.

### npm으로 업데이트하기

```bash
npx --yes @atototo/agent-plugins@latest update --dry-run
npx --yes @atototo/agent-plugins@latest update --yes
```

`@latest`를 생략하지 않는다. 최신 패키지 준비와 기존 하네스 갱신을 한 명령으로
묶지만, 백그라운드 자동 업데이트는 아니다. npm을 offline/prefer-offline 모드로
설정했다면 최신 버전 확인을 위해 온라인 모드로 실행한다. 특정 릴리스를 재현할
때는 `@latest` 대신 `@0.1.1`처럼 버전을 고정하고 적용 계획을 확인한다.

| 버전 | 올리는 때 |
| --- | --- |
| 플러그인 버전 (`plugins/<name>/plugin.json`) | 해당 플러그인의 스킬·MCP·동작을 변경할 때 |
| npm 배포 패키지 버전 (`package.json`) | 설치기 또는 포함된 플러그인을 새로 배포할 때 |

두 버전은 별개다. 위 표의 두 경우 모두 **새 배포 패키지를 받은 뒤 `update`를 실행할 때**
하네스에 적용된다. GitHub push, npm 게시, `npm update -g`만으로 기존 설치 스냅샷이
자동 교체되지는 않는다. 위 명령은 최신 CLI 실행과 `update --yes`를 한 번에 수행한다.
자동 배경 업데이트나 npm lifecycle을 통한 하네스 설치는 하지 않는다.

## 제거와 실패 복구

```bash
node bin/agent-plugins.mjs remove eli5-visual --harness all --dry-run
node bin/agent-plugins.mjs remove eli5-visual --harness all --yes
```

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
  Codex 플러그인 v0.1.1부터 이 변수를 MCP에 명시적으로 전달한다.
  설치 명령에만 변수를 설정하면 이후 실행하는 하네스에 유지되지 않는다.
  예: `AGENT_PLUGINS_OUTPUT_DIR="/absolute/path/my visuals" codex`.
  이미 실행 중인 앱에는 소급 적용되지 않으며, 변수가 없으면 기본 경로를 쓴다.
- OpenCode: 기존 `opencode.jsonc`/`opencode.json`을 사용한다. 둘 다 있거나 사용자
  지정 `OPENCODE_CONFIG`가 있으면 `--opencode-config`로 대상을 명확히 지정한다.
- 기존 설정·주석과 나중에 사용자가 추가한 항목은 보존한다. 관리하지 않는 플러그인,
  충돌하는 MCP 키, 심볼릭 링크, 손상된 JSONC는 덮어쓰지 않는다.
- npm lifecycle 스크립트에서 하네스를 설치하지 않는다. 브라우저 도구 설치·권한 변경,
  계정 로그인, 결과 공개도 자동으로 수행하지 않는다.
- MCP는 로컬 stdio 프로세스다. 단, 에이전트가 읽는 자료와 MCP 결과는 선택한 모델의
  제공자에게 전달될 수 있다. “로컬 MCP”가 “전체 작업이 오프라인”이라는 뜻은 아니다.

OpenCode 설정 루트는 `OPENCODE_CONFIG_DIR`와 `XDG_CONFIG_HOME`을 반영한다. 심볼릭 링크로 연결된 config/storage는 명시적인 실경로가 필요하다. 설정 내용 대조는 동시 수정 위험을 줄이지만 외부 프로그램과 공통 잠금을 쓰는 완전한 transaction은 아니다.

HTML 저장 뒤 권한·샌드박스 문제로 파일 읽기나 브라우저 검증이 막히면,
스킬은 생성된 HTML 링크와 실제 완료한 검사·미검증 항목을 구분해서 전달한다.
이 경우 파일 링크가 있다는 것만으로 렌더링 검증 완료를 뜻하지는 않는다.

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

v0.1 네이티브 설치기는 Linux/macOS 계열을 대상으로 작성했으며 실제 자동 검증 환경은 Linux다. Windows의 npm `.cmd` shim 실행과 프로젝트 범위 설치는 아직 지원하지 않는다. npm 공개 배포 패키지는 `@atototo/agent-plugins`이며 자체 코드·스킬은 MIT, 외부 코드는 원래 라이선스를 유지한다.
