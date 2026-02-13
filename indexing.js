(() => {
  const DEFAULT_INDEX_OPTIONS = {
    tokenize: "forward",
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
        "FlexSearch is not available. Make sure flexsearch.bundle.js is loaded first.",
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
    return new FlexSearch.Index({ ...DEFAULT_INDEX_OPTIONS, ...options });
  };

  const addEntry = (index, entry) => {
    if (!index || !entry || !Number.isInteger(entry.id)) {
      return;
    }
    index.add(entry.id, entryToText(entry));
  };

  const updateEntry = (index, entry) => {
    if (!index || !entry || !Number.isInteger(entry.id)) {
      return;
    }
    try {
      index.update(entry.id, entryToText(entry));
    } catch (error) {
      index.remove(entry.id);
      index.add(entry.id, entryToText(entry));
    }
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
    return index.search(String(query), limit);
  };

  const exportIndex = (index) =>
    new Promise((resolve) => {
      if (!index) {
        resolve({});
        return;
      }
      const data = {};
      index.export((key, value) => {
        if (key === null) {
          resolve(data);
          return;
        }
        data[key] = value;
      });
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
    globalRef.SearchMyHistoryIndexing = api;
  }
})();
