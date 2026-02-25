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

export const BASE_URL = resolveBaseUrl();

export const DOS_ASSETS = {
  localJsDosUrl: `${BASE_URL}static/js-dos/js-dos.js`,
  localWdosboxUrl: `${BASE_URL}static/js-dos/wdosbox.js`,
  localWdosboxEmterpUrl: `${BASE_URL}static/js-dos/wdosbox-emterp.js`,
  cdnJsDosUrl: "https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/js-dos.js",
  cdnWdosboxUrl: "https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/wdosbox.js",
  cdnWdosboxEmterpUrl:
    "https://cdn.jsdelivr.net/npm/js-dos@6.22.60/dist/wdosbox-emterp.js",
};

export const GAMES = {
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
    commands: ["-c", "C:", "-c", "sam4"],
  },
};

export const KEY_ALIAS = {
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

export const VIRTUAL_KEY_CODE = {
  ArrowLeft: 100,
  ArrowUp: 104,
  ArrowRight: 102,
  ArrowDown: 98,
  Enter: 13,
};

export const UI_LAYOUT = {
  gameAspect: 4 / 3,
  playPadding: 16,
  playGap: 12,
  fallbackControlsWidth: 180,
  fallbackControlsHeight: 120,
};

export const MOUSE_BUTTON = {
  primary: 0,
  secondary: 2,
};

export const TOUCH_CONFIG = {
  tapMaxMovement: 18,
  tapMaxDuration: 450,
  cursorMoveThreshold: 12,
  enableDragMove: false,
};

export const RUNTIME_TIMEOUTS = {
  scriptLoadTimeout: 12000,
  dosReadyTimeout: 45000,
  dosProgressStallTimeout: 15000,
};

export const CACHE_BUSTERS = {
  runtime: "runtime-v2",
  zip: "zip-v2",
};

export const JSDOS_CACHE = {
  dbPrefix: "js-dos-cache (",
  knownDb: "js-dos-cache (6.22.60 (c3627d34f97fcc6e98ceef7fbea6e090))",
};
