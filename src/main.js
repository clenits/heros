import {
  GAMES,
  KEY_ALIAS,
  MOUSE_BUTTON,
  TOUCH_CONFIG,
  VIRTUAL_KEY_CODE,
} from "./config.js";
import {
  disableGameSelection,
  showGameArea,
  showSelectorArea,
  updatePlayAreaLayout,
} from "./layout.js";
import { createDos, extractGameZip } from "./runtime.js";

const state = {
  started: false,
  inputReady: false,
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

const touchState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  clientX: 0,
  clientY: 0,
  startedAt: 0,
  moved: false,
};

const refreshPlayAreaLayout = () =>
  updatePlayAreaLayout({ playArea, screen, mobileControls, canvas });

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
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

function createMouseEvent(type, button, clientX, clientY) {
  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const x = clientX ?? rect.left + rect.width / 2;
  const y = clientY ?? rect.top + rect.height / 2;
  const buttons =
    type === "mouseup" ? 0 : button === MOUSE_BUTTON.secondary ? 2 : 1;

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
  const event = createMouseEvent("mousemove", MOUSE_BUTTON.primary, clientX, clientY);
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
  sendMouseButton("mousedown", MOUSE_BUTTON.primary, clientX, clientY);
  sendMouseButton("mouseup", MOUSE_BUTTON.primary, clientX, clientY);
}

function consumeTouchPointerEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }
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
  state.inputReady = false;
  disableGameSelection(gameButtons, true);
  showGameArea({
    layout,
    selector,
    playArea,
    updateLayout: refreshPlayAreaLayout,
  });

  try {
    setStatus(`${game.name}: 에뮬레이터 로딩 중...`);
    blockAddEventListener();
    const { fs, main } = await createDos(canvas, setStatus);

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

    state.inputReady = true;
    refreshPlayAreaLayout();
    setStatus(`${game.name}: 실행됨`);
  } catch (error) {
    console.error(error);
    const reason =
      error instanceof Error && error.message
        ? error.message
        : "콘솔 로그를 확인하세요.";
    setStatus(`실패: ${reason}`);
    state.started = false;
    state.inputReady = false;
    state.selectedGameId = null;
    disableGameSelection(gameButtons, false);
    showSelectorArea({ layout, selector, playArea });
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

  canvas.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (!state.inputReady) {
        return;
      }
      if (event.pointerType !== "touch") {
        return;
      }
      if (touchState.pointerId !== null) {
        return;
      }

      consumeTouchPointerEvent(event);
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
    },
    { capture: true },
  );

  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (!state.inputReady) {
        return;
      }
      if (event.pointerType !== "touch") {
        return;
      }
      if (touchState.pointerId !== event.pointerId) {
        return;
      }

      consumeTouchPointerEvent(event);
      touchState.clientX = event.clientX;
      touchState.clientY = event.clientY;
      const movedDistance = distance(
        touchState.startX,
        touchState.startY,
        event.clientX,
        event.clientY,
      );
      if (movedDistance > TOUCH_CONFIG.tapMaxMovement) {
        touchState.moved = true;
      }
      if (movedDistance > TOUCH_CONFIG.cursorMoveThreshold) {
        sendMouseMove(event.clientX, event.clientY);
      }
    },
    { capture: true },
  );

  const releaseTouchPointer = (event) => {
    if (!state.inputReady) {
      return;
    }
    if (event.pointerType !== "touch") {
      return;
    }
    if (touchState.pointerId !== event.pointerId) {
      return;
    }

    consumeTouchPointerEvent(event);

    const isTap =
      !touchState.moved &&
      Date.now() - touchState.startedAt <= TOUCH_CONFIG.tapMaxDuration;

    if (isTap) {
      triggerLeftClickAt(event.clientX, event.clientY);
    }

    touchState.pointerId = null;
    touchState.moved = false;
  };

  const cancelTouchPointer = (event) => {
    if (!state.inputReady) {
      return;
    }
    if (event.pointerType !== "touch") {
      return;
    }
    if (touchState.pointerId !== event.pointerId) {
      return;
    }
    consumeTouchPointerEvent(event);
    touchState.pointerId = null;
    touchState.moved = false;
  };

  canvas.addEventListener("pointerup", releaseTouchPointer, { capture: true });
  canvas.addEventListener("pointercancel", cancelTouchPointer, { capture: true });
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

window.addEventListener("resize", refreshPlayAreaLayout);
window.addEventListener("orientationchange", refreshPlayAreaLayout);
document.addEventListener("fullscreenchange", refreshPlayAreaLayout);
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

refreshPlayAreaLayout();
