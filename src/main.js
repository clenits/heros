function resolveBaseUrl() {
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.BASE_URL
  ) {
    return import.meta.env.BASE_URL;
  }

  const path = window.location.pathname;
  const segments = path.split("/").filter(Boolean);
  if (segments.length > 0) {
    return `/${segments[0]}/`;
  }
  return "/";
}

const BASE_URL = resolveBaseUrl();
const LOCAL_JSDOS_URL = `${BASE_URL}static/js-dos/js-dos.js`;
const LOCAL_WDOSBOX_URL = `${BASE_URL}static/js-dos/wdosbox.js`;
const CDN_JSDOS_URL = "https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/js-dos.js";
const CDN_WDOSBOX_URL =
  "https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/wdosbox.js";

const GAMES = {
  heros: {
    name: "영걸전",
    zipPathCandidates: [
      `${BASE_URL}static/game/heros.zip`,
      `${BASE_URL}heros.zip`,
    ],
    commands: ["-c", "C:", "-c", "cd GAME", "-c", "HERO"],
  },
  sam4pk: {
    name: "삼국지4PK",
    zipPathCandidates: [
      `${BASE_URL}static/game/Sam4PK.zip`,
      `${BASE_URL}Sam4PK.zip`,
    ],
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

const VIRTUAL_KEY_CODE = {
  ArrowLeft: 100,
  ArrowUp: 104,
  ArrowRight: 102,
  ArrowDown: 98,
  Enter: 13,
};

const state = {
  started: false,
  selectedGameId: null,
  keydownHandlers: [],
  keyupHandlers: [],
  restoreAddEventListener: null,
};

const layout = document.querySelector(".layout");
const canvas = document.querySelector("#game-canvas");
const selector = document.querySelector("#selector");
const gameButtons = Array.from(document.querySelectorAll(".selector__button"));
const playArea = document.querySelector("#play-area");
const virtualButtons = Array.from(document.querySelectorAll(".vkey"));
const status = document.querySelector("#status");
const pressedVirtualButtons = new Map();

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
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
let wdosboxUrl = LOCAL_WDOSBOX_URL;

async function loadJsDos() {
  if (!dosScriptLoaded) {
    dosScriptLoaded = (async () => {
      try {
        await loadScript(LOCAL_JSDOS_URL);
        wdosboxUrl = LOCAL_WDOSBOX_URL;
      } catch (localError) {
        await loadScript(CDN_JSDOS_URL);
        wdosboxUrl = CDN_WDOSBOX_URL;
      }
    })().catch((error) => {
      dosScriptLoaded = null;
      throw error;
    });
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

    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("js-dos 준비 타임아웃"));
      }
    }, 20000);

    window
      .Dos(canvasEl, {
        wdosboxUrl,
      })
      .ready((fs, main) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      resolve({ fs, main });
      });
  });
}

function showGameArea() {
  if (layout) {
    layout.classList.add("layout--playing");
  }
  if (selector) {
    selector.classList.add("hidden");
  }
  if (playArea) {
    playArea.classList.remove("hidden");
  }
  updatePlayAreaLayout();
}

function disableGameSelection(disabled) {
  gameButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function updatePlayAreaLayout() {
  if (!playArea) {
    return;
  }
  const isLandscape = window.innerWidth > window.innerHeight;
  playArea.classList.toggle("play-area--landscape", isLandscape);
  playArea.classList.toggle("play-area--portrait", !isLandscape);
}

function createMouseEvent(type, button) {
  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const buttons = type === "mouseup" ? 0 : button === 2 ? 2 : 1;

  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    button,
    buttons,
    clientX,
    clientY,
  });
}

function sendMouseButton(type, button) {
  if (!canvas) {
    return;
  }
  const event = createMouseEvent(type, button);
  if (!event) {
    return;
  }
  canvas.dispatchEvent(event);
}

function pressVirtualButton(button) {
  if (button.dataset.action === "fullscreen") {
    button.classList.add("vkey--active");
    toggleFullscreen();
    window.setTimeout(() => {
      button.classList.remove("vkey--active");
    }, 120);
    return;
  }

  if (pressedVirtualButtons.has(button)) {
    return;
  }

  const keyName = button.dataset.key;
  if (keyName) {
    const code = VIRTUAL_KEY_CODE[keyName];
    if (!code) {
      return;
    }
    pressedVirtualButtons.set(button, {
      kind: "key",
      value: code,
    });
    button.classList.add("vkey--active");
    sendMappedKey("keydown", code);
    return;
  }

  const mouseName = button.dataset.mouse;
  if (mouseName) {
    const mouseButton = mouseName === "right" ? 2 : 0;
    pressedVirtualButtons.set(button, {
      kind: "mouse",
      value: mouseButton,
    });
    button.classList.add("vkey--active");
    sendMouseButton("mousedown", mouseButton);
  }
}

function releaseVirtualButton(button) {
  const payload = pressedVirtualButtons.get(button);
  if (!payload) {
    button.classList.remove("vkey--active");
    return;
  }

  if (payload.kind === "key") {
    sendMappedKey("keyup", payload.value);
  } else if (payload.kind === "mouse") {
    sendMouseButton("mouseup", payload.value);
  }

  pressedVirtualButtons.delete(button);
  button.classList.remove("vkey--active");
}

function releaseAllVirtualButtons() {
  Array.from(pressedVirtualButtons.keys()).forEach((button) => {
    releaseVirtualButton(button);
  });
}

async function extractGameZip(fs, pathCandidates) {
  let lastError = null;
  for (const path of pathCandidates) {
    try {
      await fs.extract(path);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error("게임 파일 경로를 찾지 못했습니다.");
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
    await extractGameZip(fs, game.zipPathCandidates);

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
    if (layout) {
      layout.classList.remove("layout--playing");
    }
    if (selector) {
      selector.classList.remove("hidden");
    }
    if (playArea) {
      playArea.classList.add("hidden");
    }
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

if (canvas) {
  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}
gameButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const gameId = button.dataset.gameId;
    if (!gameId) {
      return;
    }
    startGame(gameId);
  });
});

virtualButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (button.setPointerCapture) {
      button.setPointerCapture(event.pointerId);
    }
    pressVirtualButton(button);
  });

  const release = () => releaseVirtualButton(button);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

window.addEventListener("resize", updatePlayAreaLayout);
window.addEventListener("orientationchange", updatePlayAreaLayout);
window.addEventListener("blur", releaseAllVirtualButtons);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    releaseAllVirtualButtons();
  }
});

updatePlayAreaLayout();
