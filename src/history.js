const HISTORY_KEY = "WDIR_Entries";
const INDEX_KEY = "WDIR_Index";
const INDEX_VERSION_KEY = "WDIR_IndexVersion";
const INDEX_FORMAT_VERSION_KEY = "WDIR_IndexFormatVersion";
const INDEX_FORMAT_VERSION = 2;
const HISTORY_VERSION_KEY = "WDIR_EntriesVersion";

const {
  createIndex,
  importIndex,
  searchIndex,
  buildIndexFromEntries,
  exportIndex,
  removeEntry,
} = WDIR_Indexing;
const storage = WDIR_Storage;

const state = {
  entries: [],
  index: null,
  indexSize: 0,
  query: "",
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
};

const getIndexSizeBytes = (indexData) => {
  try {
    const json = JSON.stringify(indexData ?? {});
    let bytes = 0;
    if (typeof TextEncoder !== "undefined") {
      bytes = new TextEncoder().encode(json).length;
    } else if (typeof Blob !== "undefined") {
      bytes = new Blob([json]).size;
    } else {
      bytes = unescape(encodeURIComponent(json)).length;
    }
    return bytes;
  } catch (error) {
    console.log("Where Did I Read index size calculation failed", error);
    return 0;
  }
};

const formatIndexSizeMiB = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MiB";
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

const updateEcosiaLink = (query) => {
  const link = document.getElementById("ecosia-link");
  if (!link) {
    return;
  }
  const trimmed = (query || "").trim();
  if (trimmed.length < 2) {
    link.hidden = true;
    return;
  }
  link.href = `https://www.ecosia.org/search?q=${encodeURIComponent(trimmed)}`;
  link.hidden = false;
};

const updateCounts = (filteredCount, totalCount) => {
  const meta = document.getElementById("meta");
  const count = document.getElementById("count");
  const indexSize = document.getElementById("index-size");
  if (meta) {
    meta.textContent = `${filteredCount} matching`;
  }
  if (count) {
    count.textContent = String(totalCount);
  }
  if (indexSize) {
    indexSize.textContent = formatIndexSizeMiB(state.indexSize);
  }
};

const normalizeSearchResults = (result) => {
  if (!result) {
    return [];
  }
  if (Array.isArray(result)) {
    if (
      result.length > 0 &&
      result[0] &&
      typeof result[0] === "object" &&
      Array.isArray(result[0].result)
    ) {
      return result.flatMap((entry) => entry.result);
    }
    if (result.length > 0 && Array.isArray(result[0])) {
      return result.flat();
    }
    return result;
  }
  if (typeof result === "object" && Array.isArray(result.result)) {
    return result.result;
  }
  return [];
};

const renderEmpty = (list, message) => {
  updateCounts(0, state.entries.length);
  const empty = document.createElement("div");
  empty.className = "empty";
  empty.textContent = message;
  list.appendChild(empty);
};

const render = () => {
  const list = document.getElementById("results");
  if (!list) {
    return;
  }
  list.innerHTML = "";

  const normalizedQuery = state.query.trim().toLowerCase();
  updateEcosiaLink(state.query);
  if (normalizedQuery.length < 2) {
    renderEmpty(list, "Type at least 2 characters to search.");
    return;
  }

  if (!state.index) {
    renderEmpty(list, "Search index is not available.");
    return;
  }

  const rawMatches = searchIndex(state.index, normalizedQuery, 50);
  const matchingIds = normalizeSearchResults(rawMatches);

  updateCounts(matchingIds.length, state.entries.length);

  if (matchingIds.length === 0) {
    renderEmpty(list, "No matching history entries.");
    return;
  }

  const entryMap = new Map(state.entries.map((entry) => [entry.id, entry]));
  const matches = matchingIds
    .map((id) => entryMap.get(id))
    .filter(Boolean)
    .slice(0, 20);

  if (matches.length === 0) {
    renderEmpty(list, "No matching history entries.");
    return;
  }

  for (const entry of matches) {
    const item = document.createElement("li");

    const titleRow = document.createElement("div");
    titleRow.className = "title-row";

    const title = document.createElement("a");
    title.className = "title";
    title.href = entry.url || "#";
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = entry.title || entry.url || "(untitled)";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.title = "Remove from history";
    deleteBtn.addEventListener("click", () => deleteEntry(entry.id));

    titleRow.appendChild(title);
    titleRow.appendChild(deleteBtn);

    const url = document.createElement("a");
    url.className = "url";
    url.href = entry.url || "#";
    url.target = "_blank";
    url.rel = "noopener noreferrer";
    url.textContent = entry.url || "";

    const time = document.createElement("div");
    time.className = "time";
    time.textContent = formatTime(entry.visitedAt);

    item.appendChild(titleRow);
    item.appendChild(url);
    item.appendChild(time);
    list.appendChild(item);
  }
};

const deleteEntry = async (id) => {
  const idx = state.entries.findIndex((e) => e.id === id);
  if (idx === -1) {
    return;
  }

  state.entries.splice(idx, 1);
  removeEntry(state.index, id);

  try {
    const serializedIndex = await exportIndex(state.index);
    const indexPayload = { __flexsearch: true, data: serializedIndex };
    state.indexSize = getIndexSizeBytes(indexPayload);

    const historyVersion = ((await storage.get(HISTORY_VERSION_KEY)) || 0) + 1;

    await storage.set({
      [HISTORY_KEY]: state.entries,
      [INDEX_KEY]: indexPayload,
      [HISTORY_VERSION_KEY]: historyVersion,
      [INDEX_VERSION_KEY]: historyVersion,
      [INDEX_FORMAT_VERSION_KEY]: INDEX_FORMAT_VERSION,
    });
  } catch (error) {
    console.error("Where Did I Read failed to delete entry", error);
  }

  render();
};

const deserializeIndex = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  if (!payload.__flexsearch) {
    return null;
  }
  if (payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  return {};
};

const loadState = async () => {
  const result = await storage.getMany([
    HISTORY_KEY,
    INDEX_KEY,
    INDEX_VERSION_KEY,
    HISTORY_VERSION_KEY,
    INDEX_FORMAT_VERSION_KEY,
  ]);

  state.entries = Array.isArray(result[HISTORY_KEY]) ? result[HISTORY_KEY] : [];

  const storedIndexPayload = result[INDEX_KEY];
  const rawIndex = deserializeIndex(storedIndexPayload);
  const historyVersion = Number.isInteger(result[HISTORY_VERSION_KEY])
    ? result[HISTORY_VERSION_KEY]
    : 0;
  const indexVersion = Number.isInteger(result[INDEX_VERSION_KEY])
    ? result[INDEX_VERSION_KEY]
    : 0;
  const formatVersion = Number.isInteger(result[INDEX_FORMAT_VERSION_KEY])
    ? result[INDEX_FORMAT_VERSION_KEY]
    : 0;
  const versionsMatch = historyVersion === indexVersion;
  const formatMatches = formatVersion === INDEX_FORMAT_VERSION;
  const hasMissingIds = state.entries.some(
    (entry) => !Number.isInteger(entry.id),
  );
  const shouldUseStored =
    versionsMatch &&
    formatMatches &&
    !hasMissingIds &&
    rawIndex &&
    Object.keys(rawIndex).length > 0;

  if (shouldUseStored) {
    const index = createIndex();
    importIndex(index, rawIndex);
    state.index = index;
    state.indexSize = getIndexSizeBytes(storedIndexPayload);
  } else if (state.entries.length > 0) {
    const index = buildIndexFromEntries(state.entries);
    state.index = index;
    state.indexSize = 0;

    exportIndex(index)
      .then((serializedIndex) => {
        const indexPayload = { __flexsearch: true, data: serializedIndex };
        state.indexSize = getIndexSizeBytes(indexPayload);

        if (!hasMissingIds) {
          return storage.set({
            [INDEX_KEY]: indexPayload,
            [INDEX_VERSION_KEY]: historyVersion,
            [INDEX_FORMAT_VERSION_KEY]: INDEX_FORMAT_VERSION,
          });
        }
        return undefined;
      })
      .then(() => {
        render();
      })
      .catch((error) => {
        console.error("Where Did I Read failed to export index", error);
      });
  } else {
    state.index = null;
    state.indexSize = 0;
  }

  render();
};

const bindEvents = () => {
  const queryInput = document.getElementById("query");
  if (queryInput) {
    queryInput.addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      render();
    });
  }
};

const init = () => {
  bindEvents();
  loadState().catch((error) => {
    const meta = document.getElementById("meta");
    if (meta) {
      meta.textContent = "Failed to load history.";
    }
    updateCounts(0, 0);
    console.error("Where Did I Read failed to load popup data", error);
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
