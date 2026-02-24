import "./style.css";

const BASE_URL = import.meta.env.BASE_URL;
const WDOSBOX_PATH = `${BASE_URL}static/js-dos/wdosbox.js`;
const GAMES = {
  heros: {
    name: "영걸전",
    zipPath: `${BASE_URL}static/game/heros.zip`,
    commands: ["-c", "C:", "-c", "cd GAME", "-c", "HERO"],
  },
  sam4pk: {
    name: "삼국지4PK",
    zipPath: `${BASE_URL}static/game/Sam4PK.zip`,
    commands: ["-c", "C:", "-c", "cd GAME", "-c", "sam4"],
  },
};

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
  selectedGameId: null,
  keydownHandlers: [],
  keyupHandlers: [],
  restoreAddEventListener: null,
};

const canvas = document.querySelector("#game-canvas");
const selector = document.querySelector("#selector");
const gameButtons = Array.from(document.querySelectorAll(".selector__button"));
const screen = document.querySelector("#screen");
const actions = document.querySelector("#actions");
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
    dosScriptLoaded = loadScript(`${BASE_URL}static/js-dos/js-dos.js`);
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

function showGameArea() {
  selector.classList.add("hidden");
  screen.classList.remove("hidden");
  actions.classList.remove("hidden");
}

function disableGameSelection(disabled) {
  gameButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

async function startGame(gameId) {
  const game = GAMES[gameId];
  if (!game) {
    setStatus("알 수 없는 게임입니다.");
    return;
  }
  if (state.started) {
    return;
  }
  state.selectedGameId = gameId;
  state.started = true;
  disableGameSelection(true);
  showGameArea();

  try {
    setStatus(`${game.name}: 에뮬레이터 로딩 중...`);
    blockAddEventListener();
    const { fs, main } = await createDos(canvas);

    setStatus(`${game.name}: 게임 파일 압축 해제 중...`);
    await fs.extract(game.zipPath);

    setStatus(`${game.name}: 게임 실행 중...`);
    await main(game.commands);

    if (state.restoreAddEventListener) {
      state.restoreAddEventListener();
      state.restoreAddEventListener = null;
    }

    document.addEventListener("keydown", onDocumentKeyDown);
    document.addEventListener("keyup", onDocumentKeyUp);

    setStatus(`${game.name}: 실행됨`);
  } catch (error) {
    console.error(error);
    setStatus("실패: 콘솔 로그를 확인하세요.");
    state.started = false;
    state.selectedGameId = null;
    disableGameSelection(false);
    selector.classList.remove("hidden");
    screen.classList.add("hidden");
    actions.classList.add("hidden");
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

fullscreenBtn.addEventListener("click", toggleFullscreen);
gameButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const gameId = button.dataset.gameId;
    if (!gameId) {
      return;
    }
    startGame(gameId);
  });
});
