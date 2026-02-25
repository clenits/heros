import { UI_LAYOUT } from "./config.js";

export function disableGameSelection(gameButtons, disabled) {
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

export function updatePlayAreaLayout({ playArea, screen, mobileControls, canvas }) {
  if (!playArea || !screen || !mobileControls || !canvas) {
    return;
  }

  const isLandscape = window.innerWidth > window.innerHeight;
  playArea.classList.toggle("play-area--landscape", isLandscape);
  playArea.classList.toggle("play-area--portrait", !isLandscape);

  const viewportWidth = Math.max(1, window.innerWidth);
  const viewportHeight = Math.max(1, window.innerHeight);

  let availableWidth = viewportWidth - UI_LAYOUT.playPadding * 2;
  let availableHeight = viewportHeight - UI_LAYOUT.playPadding * 2;

  if (isLandscape) {
    const controlsWidth = Math.max(
      UI_LAYOUT.fallbackControlsWidth,
      Math.ceil(mobileControls.getBoundingClientRect().width || 0),
    );
    availableWidth =
      viewportWidth - UI_LAYOUT.playPadding * 2 - UI_LAYOUT.playGap - controlsWidth;
  } else {
    const controlsHeight = Math.max(
      UI_LAYOUT.fallbackControlsHeight,
      Math.ceil(mobileControls.getBoundingClientRect().height || 0),
    );
    availableHeight =
      viewportHeight - UI_LAYOUT.playPadding * 2 - UI_LAYOUT.playGap - controlsHeight;
  }

  const fit = fitRect(
    Math.max(120, availableWidth),
    Math.max(120, availableHeight),
    UI_LAYOUT.gameAspect,
  );

  screen.style.width = `${fit.width}px`;
  screen.style.height = `${fit.height}px`;
  canvas.style.width = `${fit.width}px`;
  canvas.style.height = `${fit.height}px`;
}

export function showGameArea({ layout, selector, playArea, updateLayout }) {
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
  if (typeof updateLayout === "function") {
    updateLayout();
  }
}

export function showSelectorArea({ layout, selector, playArea }) {
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
}
