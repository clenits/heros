# Heros DOS Web

`wan2land/unchartedwaters2`의 실행 구조를 기반으로, 로컬의 `heros.zip`을 브라우저에서 실행하도록 만든 프로젝트입니다.

## 참고 구현에서 가져온 핵심 방식

- `js-dos` 런타임(`js-dos.js`, `wdosbox.js`)을 정적 파일로 배포
- `fs.extract(zip)`으로 게임 압축 파일을 가상 파일시스템에 풀기
- `main(["-c", ...])` 형태로 DOS 부트 커맨드 실행
- 브라우저 키보드 입력을 숫자패드 키 코드로 재매핑(방향키, QWER)

## 실행 방법

1. 의존성 설치

```bash
npm install
```

2. 개발 서버 실행

```bash
npm run dev
```

3. 브라우저에서 출력된 주소 접속 후 `게임 시작` 클릭

## 빌드

```bash
npm run build
npm run preview
```

## 현재 부트 커맨드

`src/main.js`에서 아래 커맨드로 실행합니다.

```txt
C:
cd GAME
HERO
```

문제가 있으면 `COMMANDS` 배열을 수정해서 `MAIN.EXE` 등으로 바꿔 테스트할 수 있습니다.
# heros
