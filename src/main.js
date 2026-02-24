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
const LOCAL_WDOSBOX_EMTERP_URL = `${BASE_URL}static/js-dos/wdosbox-emterp.js`;
const CDN_JSDOS_URL = "https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/js-dos.js";
const CDN_WDOSBOX_URL =
  "https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/wdosbox.js";
const CDN_WDOSBOX_EMTERP_URL =
  "https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/wdosbox-emterp.js";

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
const screen = document.querySelector("#screen");
const mobileControls = document.querySelector("#mobile-controls");
const virtualButtons = Array.from(document.querySelectorAll(".vkey"));
const status = document.querySelector("#status");
const pressedVirtualButtons = new Map();

const GAME_ASPECT = 4 / 3;
const PLAY_PADDING = 16;
const PLAY_GAP = 12;
const FALLBACK_CONTROLS_WIDTH = 180;
const FALLBACK_CONTROLS_HEIGHT = 120;
const PRIMARY_MOUSE_BUTTON = 0;
const SECONDARY_MOUSE_BUTTON = 2;
const TAP_MAX_MOVEMENT = 18;
const TAP_MAX_DURATION = 450;
const SCRIPT_LOAD_TIMEOUT = 12000;
const DOS_READY_TIMEOUT = 45000;
const DOS_PROGRESS_STALL_TIMEOUT = 15000;

const touchState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  clientX: 0,
  clientY: 0,
  startedAt: 0,
  moved: false,
};

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      script.remove();
      reject(new Error(`스크립트 로드 타임아웃: ${src}`));
    }, SCRIPT_LOAD_TIMEOUT);

    script.src = src;
    script.async = true;
    script.onload = () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      resolve();
    };
    script.onerror = () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      reject(new Error(`스크립트 로드 실패: ${src}`));
    };
    document.head.append(script);
  });
}

let dosScriptLoaded = null;
let usingCdnRuntime = false;
// Bump this string only when runtime cache must be invalidated across deployments.
const RUNTIME_CACHE_BUSTER = "runtime-v1";
const JSDOS_CACHE_DB_PREFIX = "js-dos-cache (";
const KNOWN_JSDOS_CACHE_DB = "js-dos-cache (6.22.60 (c3627d34f97fcc6e98ceef7fbea6e090))";

async function loadJsDos() {
  if (!dosScriptLoaded) {
    dosScriptLoaded = (async () => {
      try {
        await loadScript(`${LOCAL_JSDOS_URL}?cb=${RUNTIME_CACHE_BUSTER}`);
        usingCdnRuntime = false;
      } catch (localError) {
        await loadScript(`${CDN_JSDOS_URL}?cb=${RUNTIME_CACHE_BUSTER}`);
        usingCdnRuntime = true;
      }
    })().catch((error) => {
      dosScriptLoaded = null;
      throw error;
    });
  }
  return dosScriptLoaded;
}

function getRuntimeCandidates() {
  const localCandidates = [
    `${LOCAL_WDOSBOX_URL}?cb=${RUNTIME_CACHE_BUSTER}`,
    `${LOCAL_WDOSBOX_EMTERP_URL}?cb=${RUNTIME_CACHE_BUSTER}`,
  ];
  const cdnCandidates = [
    `${CDN_WDOSBOX_URL}?cb=${RUNTIME_CACHE_BUSTER}`,
    `${CDN_WDOSBOX_EMTERP_URL}?cb=${RUNTIME_CACHE_BUSTER}`,
  ];

  if (usingCdnRuntime) {
    return [...cdnCandidates, ...localCandidates];
  }
  return [...localCandidates, ...cdnCandidates];
}

function deleteIndexedDb(name) {
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch (error) {
      resolve();
    }
  });
}

async function clearJsDosRuntimeCache() {
  if (!window.indexedDB) {
    return;
  }

  const names = new Set([KNOWN_JSDOS_CACHE_DB]);
  if (typeof window.indexedDB.databases === "function") {
    try {
      const databases = await window.indexedDB.databases();
      databases.forEach((database) => {
        if (database.name && database.name.startsWith(JSDOS_CACHE_DB_PREFIX)) {
          names.add(database.name);
        }
      });
    } catch (error) {
      // keep fallback name only
    }
  }

  await Promise.all(Array.from(names).map((name) => deleteIndexedDb(name)));
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

async function createDosRuntime(canvasEl, runtimeUrl) {
  return new Promise((resolve, reject) => {
    if (!window.Dos) {
      reject(new Error("js-dos 초기화 실패"));
      return;
    }

    let settled = false;
    let lastProgressAt = Date.now();

    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      window.clearInterval(stallTimer);
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const timeout = window.setTimeout(() => {
      fail(new Error("js-dos 준비 타임아웃"));
    }, DOS_READY_TIMEOUT);

    const stallTimer = window.setInterval(() => {
      if (Date.now() - lastProgressAt > DOS_PROGRESS_STALL_TIMEOUT) {
        fail(new Error("js-dos 로딩 진행 멈춤"));
      }
    }, 1000);

    try {
      window
      .Dos(canvasEl, {
        wdosboxUrl: runtimeUrl,
        onprogress: (stage, total, loaded) => {
          lastProgressAt = Date.now();
          if (total > 0) {
            const percent = Math.max(
              0,
              Math.min(99, Math.floor((loaded / total) * 100)),
            );
            setStatus(`에뮬레이터 로딩 중... ${percent}%`);
          } else {
            setStatus("에뮬레이터 로딩 중...");
          }
        },
        onerror: (message) => {
          fail(new Error(`js-dos 오류: ${message}`));
        },
      })
      .ready((fs, main) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        window.clearInterval(stallTimer);
        resolve({ fs, main });
      });
    } catch (error) {
      fail(error);
    }
  });
}

async function createDosWithCandidates(canvasEl) {
  await loadJsDos();
  const candidates = getRuntimeCandidates();
  let lastError = null;

  for (const runtimeUrl of candidates) {
    try {
      return await createDosRuntime(canvasEl, runtimeUrl);
    } catch (error) {
      lastError = error;
      console.warn("dos runtime candidate failed", runtimeUrl, error);
    }
  }

  throw lastError || new Error("사용 가능한 dos 런타임을 찾지 못했습니다.");
}

async function createDos(canvasEl) {
  try {
    return await createDosWithCandidates(canvasEl);
  } catch (firstError) {
    setStatus("에뮬레이터 캐시 복구 중...");
    await clearJsDosRuntimeCache();
    dosScriptLoaded = null;
    return await createDosWithCandidates(canvasEl);
  }
}

function showGameArea() {
  if (layout) {
    layout.classList.add("layout--playing");
  }
  document.body.classList.add("playing");
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

function fitRect(maxWidth, maxHeight, aspect) {
  let width = maxWidth;
  let height = width / aspect;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }

  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
  };
}

function updatePlayAreaLayout() {
  if (!playArea || !screen || !mobileControls || !canvas) {
    return;
  }

  const isLandscape = window.innerWidth > window.innerHeight;
  playArea.classList.toggle("play-area--landscape", isLandscape);
  playArea.classList.toggle("play-area--portrait", !isLandscape);

  const viewportWidth = Math.max(1, window.innerWidth);
  const viewportHeight = Math.max(1, window.innerHeight);

  let availableWidth = viewportWidth - PLAY_PADDING * 2;
  let availableHeight = viewportHeight - PLAY_PADDING * 2;

  if (isLandscape) {
    const controlsWidth = Math.max(
      FALLBACK_CONTROLS_WIDTH,
      Math.ceil(mobileControls.getBoundingClientRect().width || 0),
    );
    availableWidth = viewportWidth - PLAY_PADDING * 2 - PLAY_GAP - controlsWidth;
  } else {
    const controlsHeight = Math.max(
      FALLBACK_CONTROLS_HEIGHT,
      Math.ceil(mobileControls.getBoundingClientRect().height || 0),
    );
    availableHeight = viewportHeight - PLAY_PADDING * 2 - PLAY_GAP - controlsHeight;
  }

  const fit = fitRect(
    Math.max(120, availableWidth),
    Math.max(120, availableHeight),
    GAME_ASPECT,
  );

  screen.style.width = `${fit.width}px`;
  screen.style.height = `${fit.height}px`;
  canvas.style.width = `${fit.width}px`;
  canvas.style.height = `${fit.height}px`;
}

function createMouseEvent(type, button, clientX, clientY) {
  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const x = clientX ?? rect.left + rect.width / 2;
  const y = clientY ?? rect.top + rect.height / 2;
  const buttons = type === "mouseup" ? 0 : button === 2 ? 2 : 1;

  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    button,
    buttons,
    clientX: x,
    clientY: y,
  });
}

function sendMouseButton(type, button, clientX, clientY) {
  if (!canvas) {
    return;
  }
  const event = createMouseEvent(type, button, clientX, clientY);
  if (!event) {
    return;
  }
  canvas.dispatchEvent(event);
}

function sendMouseMove(clientX, clientY) {
  if (!canvas) {
    return;
  }
  const event = createMouseEvent("mousemove", PRIMARY_MOUSE_BUTTON, clientX, clientY);
  if (!event) {
    return;
  }
  canvas.dispatchEvent(event);
}

function distance(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function triggerLeftClickAt(clientX, clientY) {
  sendMouseMove(clientX, clientY);
  sendMouseButton("mousedown", PRIMARY_MOUSE_BUTTON, clientX, clientY);
  sendMouseButton("mouseup", PRIMARY_MOUSE_BUTTON, clientX, clientY);
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

async function isZipCandidateAvailable(path) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(path, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);
    if (!response.ok) {
      return false;
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html")) {
      return false;
    }

    return true;
  } catch (error) {
    window.clearTimeout(timeoutId);
    return false;
  }
}

function resolveZipCandidates(game) {
  const candidates = [...game.zipPathCandidates];

  // Source-branch Pages mode often uses CDN js-dos and root-level zip files.
  if (usingCdnRuntime) {
    return candidates.reverse();
  }

  return candidates;
}

async function extractGameZip(fs, game) {
  const pathCandidates = resolveZipCandidates(game);
  let lastError = null;
  for (const path of pathCandidates) {
    const canUse = await isZipCandidateAvailable(path);
    if (!canUse) {
      continue;
    }

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
    await extractGameZip(fs, game);

    setStatus(`${game.name}: 게임 실행 중...`);
    await main(game.commands);

    if (state.restoreAddEventListener) {
      state.restoreAddEventListener();
      state.restoreAddEventListener = null;
    }

    document.addEventListener("keydown", onDocumentKeyDown);
    document.addEventListener("keyup", onDocumentKeyUp);

    updatePlayAreaLayout();
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
    document.body.classList.remove("playing");
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

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }
    if (touchState.pointerId !== null) {
      return;
    }

    event.preventDefault();
    touchState.pointerId = event.pointerId;
    touchState.startX = event.clientX;
    touchState.startY = event.clientY;
    touchState.clientX = event.clientX;
    touchState.clientY = event.clientY;
    touchState.startedAt = Date.now();
    touchState.moved = false;

    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }

    canvas.focus?.();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "touch") {
      return;
    }
    if (touchState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    touchState.clientX = event.clientX;
    touchState.clientY = event.clientY;
    if (
      distance(
        touchState.startX,
        touchState.startY,
        event.clientX,
        event.clientY,
      ) > TAP_MAX_MOVEMENT
    ) {
      touchState.moved = true;
    }
    sendMouseMove(event.clientX, event.clientY);
  });

  const releaseTouchPointer = (event) => {
    if (event.pointerType !== "touch") {
      return;
    }
    if (touchState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const isTap =
      !touchState.moved && Date.now() - touchState.startedAt <= TAP_MAX_DURATION;

    if (isTap) {
      triggerLeftClickAt(event.clientX, event.clientY);
    }

    touchState.pointerId = null;
    touchState.moved = false;
  };

  const cancelTouchPointer = (event) => {
    if (event.pointerType !== "touch") {
      return;
    }
    if (touchState.pointerId !== event.pointerId) {
      return;
    }
    touchState.pointerId = null;
    touchState.moved = false;
  };

  canvas.addEventListener("pointerup", releaseTouchPointer);
  canvas.addEventListener("pointercancel", cancelTouchPointer);
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
document.addEventListener("fullscreenchange", updatePlayAreaLayout);
window.addEventListener("blur", releaseAllVirtualButtons);
window.addEventListener("blur", () => {
  if (touchState.pointerId !== null) {
    touchState.pointerId = null;
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    releaseAllVirtualButtons();
    if (touchState.pointerId !== null) {
      touchState.pointerId = null;
    }
  }
});

updatePlayAreaLayout();
