# npm 배포 체크리스트

배포 패키지는 `@atototo/agent-plugins`, 카탈로그는 `agent-plugins`다.
카탈로그 이름과 설치 기록 경로는 유지한다. npm 이름과 하네스의 설치 추적 키는 다르다.

## 새 버전 준비

1. 플러그인 동작·스킬을 바꿨다면 `plugins/<name>/plugin.json` 버전을 올린다.
2. 포함된 플러그인 또는 설치기를 새로 배포할 때는 루트 `package.json`과
   `package-lock.json`의 패키지 버전을 함께 올린다. 이미 게시한 버전은 재사용하지 않는다.
3. 검증 범위와 사용 안내를 갱신한다. 소스와 lockfile을 커밋해 GitHub에도 반영한다.

## 검증한 tarball 게시

```bash
npm ci
npm run check
npm run test:browser
npm pack --ignore-scripts
```

`npm run check`는 빌드·번들 해시·설치기 회귀·실제 MCP·npm 포함 파일 검사를 실행한다.
브라우저 환경 준비는 [사용 가이드](USAGE.md#browser-check)를 따른다.
tarball의 파일 목록에 자격 증명, `.npmrc`, `.test-output`, 개발 환경 파일이 없어야 한다.

```bash
# VERSION은 실제 준비한 버전으로 바꾼다.
npx --yes --package ./atototo-agent-plugins-VERSION.tgz agent-plugins validate
npm whoami
npm publish ./atototo-agent-plugins-VERSION.tgz --access public --ignore-scripts
```

이 게시 명령은 **바로 앞에서 검증한 tarball만** 사용한다. `--ignore-scripts`를
검증 생략 수단으로 사용하지 않는다. 소스 디렉터리에서 직접 게시할 경우에는
`npm publish --access public --ignore-scripts=false`로 `prepublishOnly` 검사를 실행한다.
프로젝트의 npm 설정이 lifecycle 실행을 꺼둘 수 있으므로 암묵적인 실행에 의존하지 않는다.

인증은 npm CLI의 공식 브라우저 로그인/게시 승인 절차로 수행한다. 토큰·비밀번호를
소스, 로그, 채팅에 넣거나 2FA를 해제하지 않는다. 게시 승인 방식은
[npm 공식 안내](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)를 따른다.

## 게시 후 확인

```bash
npm view @atototo/agent-plugins@latest version dist.integrity
npx --yes @atototo/agent-plugins@latest validate
npx --yes @atototo/agent-plugins@latest update --dry-run
```

레지스트리의 버전·무결성과 로컬에서 검증한 tarball을 대조한다. 새 캐시에서
실행되는지도 확인한다. 사용자에게는 아래 한 줄을 안내한다:

```bash
npx --yes @atototo/agent-plugins@latest update --yes
```

기존 설치 조합만 갱신하며, 사용자 지정 `--state-dir`가 있었다면 동일하게 전달한다.
업데이트 후 새 하네스 세션이 필요하다. 최초 배포만으로 자동 릴리스나 자동 배경
업데이트가 생기지는 않는다.
