(() => {
  const DEFAULT_INDEX_OPTIONS = {
    document: {
      id: "id",
      index: [
        { field: "title", weight: 4 },
        { field: "url", weight: 2 },
        { field: "content", weight: 1 },
      ],
    },
    tokenize: "full",
    cache: 100,
    resolution: 9,
    depth: 3,
    optimize: true,
  };

  const getFlexSearch = () => {
    const globalRef =
      typeof globalThis !== "undefined"
        ? globalThis
        : typeof window !== "undefined"
          ? window
          : typeof self !== "undefined"
            ? self
            : {};
    return globalRef.FlexSearch;
  };

  const assertFlexSearch = () => {
    const FlexSearch = getFlexSearch();
    if (!FlexSearch) {
      throw new Error(
        "FlexSearch is not available. Make sure the FlexSearch CDN script is loaded first.",
      );
    }
    return FlexSearch;
  };

  const normalizeText = (text) => String(text || "").toLowerCase();

  const entryToText = (entry) =>
    normalizeText(
      `${entry.title || ""} ${entry.url || ""} ${entry.content || ""}`,
    );

  const createIndex = (options = {}) => {
    const FlexSearch = assertFlexSearch();
    return new FlexSearch.Document({ ...DEFAULT_INDEX_OPTIONS, ...options });
  };

  const addEntry = (index, entry) => {
    if (!index || !entry || !Number.isInteger(entry.id)) {
      return;
    }
    index.add(entry);
  };

  const updateEntry = (index, entry) => {
    if (!index || !entry || !Number.isInteger(entry.id)) {
      return;
    }
    index.update(entry);
  };

  const removeEntry = (index, entryOrId) => {
    if (!index) {
      return;
    }
    const id =
      typeof entryOrId === "number" ? entryOrId : entryOrId && entryOrId.id;
    if (!Number.isInteger(id)) {
      return;
    }
    index.remove(id);
  };

  const buildIndexFromEntries = (entries, options = {}) => {
    const index = createIndex(options);
    const normalizedEntries = Array.isArray(entries) ? entries : [];
    let maxId = 0;
    for (const entry of normalizedEntries) {
      if (Number.isInteger(entry.id) && entry.id > maxId) {
        maxId = entry.id;
      }
    }
    for (const entry of normalizedEntries) {
      if (!Number.isInteger(entry.id)) {
        maxId += 1;
        entry.id = maxId;
      }
      addEntry(index, entry);
    }
    return index;
  };

  const searchIndex = (index, query, limit = 20) => {
    if (!index || !query || String(query).trim().length < 2) {
      return [];
    }
    const result = index.search(String(query), { limit, suggest: true });
    let ids = [];
    if (Array.isArray(result)) {
      if (
        result.length > 0 &&
        result[0] &&
        typeof result[0] === "object" &&
        Array.isArray(result[0].result)
      ) {
        ids = result.flatMap((entry) => entry.result);
      } else if (result.length > 0 && Array.isArray(result[0])) {
        ids = result.flat();
      } else {
        ids = result;
      }
    } else if (
      result &&
      typeof result === "object" &&
      Array.isArray(result.result)
    ) {
      ids = result.result;
    }
    if (Array.isArray(ids)) {
      ids = ids.flatMap((entry) => {
        if (entry && typeof entry === "object") {
          if (Array.isArray(entry.result)) {
            return entry.result;
          }
          if ("id" in entry) {
            return [entry.id];
          }
          return [];
        }
        return entry;
      });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    const seen = new Set();
    const normalized = [];
    for (const id of ids) {
      const numericId = Number(id);
      if (!Number.isInteger(numericId) || seen.has(numericId)) {
        continue;
      }
      seen.add(numericId);
      normalized.push(numericId);
    }
    return normalized;
  };

  const exportIndex = (index) =>
    new Promise((resolve) => {
      if (!index) {
        resolve({});
        return;
      }
      const data = {};
      let callbackCount = 0;
      let finished = false;
      const idleTimeoutMs = 200;
      let idleTimer = null;

      const finalize = (reason) => {
        if (finished) {
          return;
        }
        finished = true;
        if (idleTimer) {
          clearTimeout(idleTimer);
        }

        resolve(data);
      };

      const scheduleIdleFinalize = () => {
        if (idleTimer) {
          clearTimeout(idleTimer);
        }
        idleTimer = setTimeout(() => {
          finalize("idle-timeout");
        }, idleTimeoutMs);
      };

      index.export((key, value) => {
        callbackCount += 1;
        if (key == null || key === "") {
          finalize("explicit-completion");
          return;
        }

        data[key] = value;
        scheduleIdleFinalize();
      });

      scheduleIdleFinalize();
    });

  const importIndex = (index, data) => {
    if (!index || !data) {
      return;
    }
    for (const [key, value] of Object.entries(data)) {
      index.import(key, value);
    }
  };

  const api = {
    DEFAULT_INDEX_OPTIONS,
    createIndex,
    addEntry,
    updateEntry,
    removeEntry,
    buildIndexFromEntries,
    searchIndex,
    exportIndex,
    importIndex,
    entryToText,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    const globalRef =
      typeof globalThis !== "undefined"
        ? globalThis
        : typeof window !== "undefined"
          ? window
          : typeof self !== "undefined"
            ? self
            : {};
    globalRef.WDIR_Indexing = api;
  }
})();
