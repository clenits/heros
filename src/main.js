import "./style.css";

const GAME_ZIP_PATH = "/static/game/heros.zip";
const WDOSBOX_PATH = "/static/js-dos/wdosbox.js";
const COMMANDS = ["-c", "C:", "-c", "cd GAME", "-c", "HERO"];

const KEY_ALIAS = {
  KeyR: 107, // +
  KeyE: 109, // -
  KeyW: 106, // *
  KeyQ: 111, // /
  Enter: 13,
  ArrowLeft: 100,
  ArrowUp: 104,
  ArrowRight: 102,
  ArrowDown: 98,
};

const state = {
  started: false,
  keydownHandlers: [],
  keyupHandlers: [],
  restoreAddEventListener: null,
};

const canvas = document.querySelector("#game-canvas");
const startBtn = document.querySelector("#start-btn");
const fullscreenBtn = document.querySelector("#fullscreen-btn");
const status = document.querySelector("#status");

function setStatus(message) {
  status.textContent = message;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`스크립트 로드 실패: ${src}`));
    document.head.append(script);
  });
}

let dosScriptLoaded = null;

async function loadJsDos() {
  if (!dosScriptLoaded) {
    dosScriptLoaded = loadScript("/static/js-dos/js-dos.js");
  }
  return dosScriptLoaded;
}

function blockAddEventListener() {
  state.keydownHandlers = [];
  state.keyupHandlers = [];
  const origin = document.addEventListener;
  state.restoreAddEventListener = () => {
    document.addEventListener = origin;
  };
  document.addEventListener = function addEventListener(event, handler) {
    if (event === "keydown") {
      state.keydownHandlers.push(handler);
      return;
    }
    if (event === "keyup") {
      state.keyupHandlers.push(handler);
      return;
    }
    if (event === "keypress") {
      return;
    }
    return origin.apply(this, arguments);
  };
}

function createKeyboardEvent(type, keyCode) {
  const event = document.createEvent("KeyboardEvent");
  Object.defineProperties(event, {
    type: { get: () => type },
    keyCode: { get: () => keyCode },
    which: { get: () => keyCode },
  });
  return event;
}

function sendMappedKey(type, code) {
  const event = createKeyboardEvent(type, code);
  const handlers =
    type === "keydown" ? state.keydownHandlers : state.keyupHandlers;
  handlers.forEach((handler) => handler(event));
}

function onDocumentKeyDown(event) {
  const mapped = KEY_ALIAS[event.code];
  if (mapped) {
    event.preventDefault();
  }
  const code = mapped ?? event.keyCode;
  sendMappedKey("keydown", code);
}

function onDocumentKeyUp(event) {
  const mapped = KEY_ALIAS[event.code];
  if (mapped) {
    event.preventDefault();
  }
  const code = mapped ?? event.keyCode;
  sendMappedKey("keyup", code);
}

async function createDos(canvasEl) {
  await loadJsDos();
  return new Promise((resolve, reject) => {
    if (!window.Dos) {
      reject(new Error("js-dos 초기화 실패"));
      return;
    }
    window
      .Dos(canvasEl, {
        wdosboxUrl: WDOSBOX_PATH,
      })
      .ready((fs, main) => resolve({ fs, main }));
  });
}

async function startGame() {
  if (state.started) {
    return;
  }
  state.started = true;
  startBtn.disabled = true;

  try {
    setStatus("에뮬레이터 로딩 중...");
    blockAddEventListener();
    const { fs, main } = await createDos(canvas);

    setStatus("게임 파일 압축 해제 중...");
    await fs.extract(GAME_ZIP_PATH);

    setStatus("게임 실행 중...");
    await main(COMMANDS);

    if (state.restoreAddEventListener) {
      state.restoreAddEventListener();
      state.restoreAddEventListener = null;
    }

    document.addEventListener("keydown", onDocumentKeyDown);
    document.addEventListener("keyup", onDocumentKeyUp);

    setStatus("실행됨");
  } catch (error) {
    console.error(error);
    setStatus("실패: 콘솔 로그를 확인하세요.");
    state.started = false;
    startBtn.disabled = false;
    if (state.restoreAddEventListener) {
      state.restoreAddEventListener();
      state.restoreAddEventListener = null;
    }
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    return;
  }
  document.exitFullscreen();
}

startBtn.addEventListener("click", startGame);
fullscreenBtn.addEventListener("click", toggleFullscreen);
