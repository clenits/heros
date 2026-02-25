import {
  CACHE_BUSTERS,
  DOS_ASSETS,
  JSDOS_CACHE,
  RUNTIME_TIMEOUTS,
} from "./config.js";

let dosScriptLoaded = null;
let usingCdnRuntime = false;

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
    }, RUNTIME_TIMEOUTS.scriptLoadTimeout);

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

async function loadJsDos() {
  if (!dosScriptLoaded) {
    dosScriptLoaded = (async () => {
      try {
        await loadScript(
          `${DOS_ASSETS.localJsDosUrl}?cb=${CACHE_BUSTERS.runtime}`,
        );
        usingCdnRuntime = false;
      } catch (localError) {
        await loadScript(`${DOS_ASSETS.cdnJsDosUrl}?cb=${CACHE_BUSTERS.runtime}`);
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
    `${DOS_ASSETS.localWdosboxUrl}?cb=${CACHE_BUSTERS.runtime}`,
    `${DOS_ASSETS.localWdosboxEmterpUrl}?cb=${CACHE_BUSTERS.runtime}`,
  ];
  const cdnCandidates = [
    `${DOS_ASSETS.cdnWdosboxUrl}?cb=${CACHE_BUSTERS.runtime}`,
    `${DOS_ASSETS.cdnWdosboxEmterpUrl}?cb=${CACHE_BUSTERS.runtime}`,
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

  const names = new Set([JSDOS_CACHE.knownDb]);
  if (typeof window.indexedDB.databases === "function") {
    try {
      const databases = await window.indexedDB.databases();
      databases.forEach((database) => {
        if (database.name && database.name.startsWith(JSDOS_CACHE.dbPrefix)) {
          names.add(database.name);
        }
      });
    } catch (error) {
      // keep fallback name only
    }
  }

  await Promise.all(Array.from(names).map((name) => deleteIndexedDb(name)));
}

function updateStatus(setStatus, message) {
  if (typeof setStatus === "function") {
    setStatus(message);
  }
}

async function createDosRuntime(canvasEl, runtimeUrl, setStatus) {
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
    }, RUNTIME_TIMEOUTS.dosReadyTimeout);

    const stallTimer = window.setInterval(() => {
      if (Date.now() - lastProgressAt > RUNTIME_TIMEOUTS.dosProgressStallTimeout) {
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
              updateStatus(setStatus, `에뮬레이터 로딩 중... ${percent}%`);
            } else {
              updateStatus(setStatus, "에뮬레이터 로딩 중...");
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

async function createDosWithCandidates(canvasEl, setStatus) {
  await loadJsDos();
  const candidates = getRuntimeCandidates();
  let lastError = null;
  const failedCandidates = [];

  for (const runtimeUrl of candidates) {
    try {
      return await createDosRuntime(canvasEl, runtimeUrl, setStatus);
    } catch (error) {
      lastError = error;
      const detail = error instanceof Error ? error.message : String(error);
      failedCandidates.push(`${runtimeUrl}: ${detail}`);
      console.warn("dos runtime candidate failed", runtimeUrl, error);
    }
  }

  if (failedCandidates.length > 0) {
    throw new Error(
      `사용 가능한 dos 런타임을 찾지 못했습니다. ${failedCandidates.join(" | ")}`,
    );
  }
  throw lastError || new Error("사용 가능한 dos 런타임을 찾지 못했습니다.");
}

export async function createDos(canvasEl, setStatus) {
  try {
    return await createDosWithCandidates(canvasEl, setStatus);
  } catch (firstError) {
    updateStatus(setStatus, "에뮬레이터 캐시 복구 중...");
    await clearJsDosRuntimeCache();
    dosScriptLoaded = null;
    return await createDosWithCandidates(canvasEl, setStatus);
  }
}

function appendCacheBuster(path, buster) {
  return `${path}${path.includes("?") ? "&" : "?"}cb=${buster}`;
}

export async function extractGameZip(fs, game) {
  const pathCandidates = [...(game.zipPathCandidates || [])];
  let lastError = null;

  for (const path of pathCandidates) {
    try {
      await fs.extract(appendCacheBuster(path, CACHE_BUSTERS.zip));
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
