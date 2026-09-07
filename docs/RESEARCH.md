# 조사 근거

확인일: 2026-09-05. 공개 문서·소스는 변경될 수 있다. 여기의 요약은 구현 결정의
근거이며, 원문 전체를 복제하거나 하네스의 모든 기능을 공통 지원한다고 약속하지 않는다.

| 쟁점 | 1차 출처 | 적용 |
| --- | --- | --- |
| Codex 패키징 | [공식 패키징](https://developers.openai.com/plugins/build/plugins) | `.codex-plugin/plugin.json`과 repo marketplace |
| Codex local stdio cwd | [MCP 파서](https://github.com/openai/codex/blob/459a79eb85400af759e9220c7bafb4429ae07516/codex-rs/codex-mcp/src/plugin_config.rs) | `cwd: "."`가 plugin root 기준으로 해석됨. 존재하지 않는 CODEX_PLUGIN_ROOT 변수는 사용하지 않음 |
| Claude marketplace | [공식 문서](https://code.claude.com/docs/en/plugin-marketplaces) | marketplace root 기준 상대 source 경로, native CLI 등록 |
| Claude MCP/제거 | [공식 reference](https://code.claude.com/docs/en/plugins-reference) | CLAUDE_PLUGIN_ROOT 기반 실행 경로, qualified selector, keep-data |
| OpenCode plugin | [공식 문서](https://opencode.ai/docs/plugins/) · [hook 타입](https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts) | 실제 config hook을 내보내는 JS 모듈 |
| OpenCode MCP | [공식 문서](https://opencode.ai/docs/mcp-servers/) | local command 배열과 enabled 설정 |
| OpenCode skills | [공식 문서](https://opencode.ai/docs/skills/) | SKILL.md 폴더와 명시적 skill discovery 경로 |
| 외부 시각화 MCP | [MCP README](https://github.com/nicobailon/visual-explainer/blob/main/plugins/visual-explainer/mcp/README.md) · [구현](https://github.com/nicobailon/visual-explainer/blob/main/plugins/visual-explainer/mcp/server.mjs) | stdio, 전체 HTML 저장, 별도 quick JSON renderer, LLM 호출 없음 |
| Codex Browser | [공식 문서](https://learn.chatgpt.com/docs/browser) | 지원되는 desktop Browser 우선; CLI에서 존재한다고 가정하지 않음 |
| Claude 브라우저 | [Desktop](https://code.claude.com/docs/en/desktop#preview-your-app) · [Chrome](https://code.claude.com/docs/en/chrome) | 연결된 native 경로 사용, 확장/로그인 조건 구분 |
| OpenCode 기본 도구 | [공식 문서](https://opencode.ai/docs/tools/) · [등록 코드](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/registry.ts) | 웹 검색/조회와 화면 렌더링은 다른 기능 |
| Playwright 선택 | [공식 CLI](https://github.com/microsoft/playwright-cli) · [공식 MCP](https://github.com/microsoft/playwright-mcp) | MCP 강제 의존성 없음. 로컬/CI 테스트는 라이브러리로 실행 |
| native inline 호환성 | [Visualizations](https://learn.chatgpt.com/docs/visualizations) · [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) | 일반 MCP 연결과 채팅 UI 렌더링 지원을 구분 |

2026-09-05 로컬 확인: Codex CLI 0.153.4의 plugin add/remove/list 및 marketplace 명령
도움말, JSON 응답 구조. 설치/제거 명령 자체는 사용자 설정에 실행하지 않았다.

2026-09-06 보완: 실제 Codex 설치·MCP 호출에서 출력 경로 환경변수가 전달되지
않는 것을 재현했다. [공식 MCP 설정 문서](https://learn.chatgpt.com/docs/extend/mcp)와
[플러그인 파서](https://github.com/openai/codex/blob/ac192cd7937b0d73edc6dffe009940ae53782dd4/codex-rs/codex-mcp/src/plugin_config.rs)를
확인해 Codex용 `.mcp.json`에 `env_vars: ["AGENT_PLUGINS_OUTPUT_DIR"]`를 추가했다.
빌드 시 환경변수 값을 저장하지 않고, 하네스 실행 시 이 변수만 추가 전달한다.
`skills/list`에서 확인한 스킬 이름은 `eli5-visual:eli5-visual`이다.
실제 검사 범위와 제약은 [검증 기록](VALIDATION.md)에 구분해서 남긴다.

`npm view visual-explainer@0.11.0`에서 실제 배포와 MCP binary를 확인했고, lockfile은
해당 패키지의 npm integrity를 기록한다. 자체 시각화 MCP를 새로 구현하지 않는다.
