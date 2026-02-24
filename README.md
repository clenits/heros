# Heros DOS Web

`wan2land/unchartedwaters2`의 실행 구조를 기반으로, DOS 게임 ZIP을 브라우저에서 실행하도록 구성한 프로젝트입니다.

## 참고 구현에서 가져온 핵심 방식

- `js-dos` 런타임(`js-dos.js`, `wdosbox.js`) 정적 배포
- `fs.extract(zip)`으로 선택한 게임 압축 해제
- `main(["-c", ...])` 부트 커맨드 실행
- 브라우저 키 입력을 숫자패드 코드로 매핑(방향키, Q/W/E/R)

## 로컬 실행

```bash
npm install
npm run dev
```

첫 화면에서 게임을 선택하면 해당 게임이 바로 실행됩니다.

- `영걸전` -> `heros.zip` (`HERO` 실행)
- `삼국지4PK` -> `Sam4PK.zip` (`sam4` 실행)

## 빌드

```bash
npm run build
npm run preview
```

## GitHub Pages 배포 (커스텀 도메인 없이)

- 기본 `base`는 `/`이며, Pages용 빌드에서는 `VITE_BASE`를 사용합니다.
- 예: 저장소 이름이 `heros`면 `VITE_BASE=/heros/ npm run build`
- 이 저장소에는 GitHub Actions 배포 워크플로우가 포함되어 있어 `main` 푸시 시 자동 배포됩니다.

## 현재 부트 커맨드

`/Users/dawoonlee/Documents/Github/heros/src/main.js`의 `COMMANDS`:

```txt
C:
cd GAME
HERO
```

실행 문제가 있으면 `HERO`를 `MAIN.EXE` 등으로 바꿔 테스트하면 됩니다.
