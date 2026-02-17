(() => {
  // Centralized CDN URL for FlexSearch so it only needs to be updated here.
  const CDN_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/FlexSearch/0.8.2/flexsearch.es5.min.js";
  const GLOBAL_KEY = "WDIR_FlexSearchLoader";

  const globalRef =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof window !== "undefined"
        ? window
        : typeof self !== "undefined"
          ? self
          : {};

  const getDocument = () =>
    typeof document !== "undefined" ? document : globalRef.document || null;

  const getLoaderScript = (doc) => {
    if (!doc) {
      return null;
    }
    if (doc.currentScript) {
      return doc.currentScript;
    }
    const scripts = doc.querySelectorAll("script");
    return scripts[scripts.length - 1] || null;
  };

  const loadExternalScript = (doc, src) =>
    new Promise((resolve, reject) => {
      if (!doc || !doc.createElement) {
        reject(
          new Error("FlexSearch loader requires a document to inject scripts."),
        );
        return;
      }

      const existing = doc.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", resolve);
        existing.addEventListener("error", () =>
          reject(new Error(`Failed to load script: ${src}`)),
        );
        return;
      }

      const script = doc.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      (doc.head || doc.documentElement || doc.body).appendChild(script);
    });

  const loadFlexSearch = () => {
    if (globalRef.FlexSearch) {
      globalRef[GLOBAL_KEY] = Promise.resolve(globalRef.FlexSearch);
      return globalRef[GLOBAL_KEY];
    }

    if (globalRef[GLOBAL_KEY]) {
      return globalRef[GLOBAL_KEY];
    }

    const doc = getDocument();
    globalRef[GLOBAL_KEY] = loadExternalScript(doc, CDN_URL).then(
      () => globalRef.FlexSearch,
    );
    return globalRef[GLOBAL_KEY];
  };

  const loadPageScripts = async () => {
    const doc = getDocument();
    const loaderScript = getLoaderScript(doc);
    if (!loaderScript) {
      return;
    }

    const scriptList = loaderScript.getAttribute("data-wdir-scripts");
    if (!scriptList) {
      return;
    }

    const scripts = scriptList
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    for (const src of scripts) {
      await loadExternalScript(doc, src);
    }
  };

  loadFlexSearch()
    .then(loadPageScripts)
    .catch((error) => {
      console.error(
        "Where Did I Read failed to load FlexSearch dependencies",
        error,
      );
    });
})();
