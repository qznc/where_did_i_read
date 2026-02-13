const HISTORY_KEY = "searchMyHistoryEntries";
const INDEX_KEY = "searchMyHistoryIndex";
const INDEX_VERSION_KEY = "searchMyHistoryIndexVersion";
const HISTORY_VERSION_KEY = "searchMyHistoryEntriesVersion";

const {
  createIndex,
  importIndex,
  searchIndex,
  buildIndexFromEntries,
  exportIndex,
} = SearchMyHistoryIndexing;
const api = typeof browser !== "undefined" ? browser : chrome;

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
    indexSize.textContent = String(state.indexSize || 0);
  }
};

const normalizeSearchResults = (result) => {
  if (!result) {
    return [];
  }
  if (Array.isArray(result)) {
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

    const title = document.createElement("a");
    title.className = "title";
    title.href = entry.url || "#";
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    title.textContent = entry.title || entry.url || "(untitled)";

    const url = document.createElement("a");
    url.className = "url";
    url.href = entry.url || "#";
    url.target = "_blank";
    url.rel = "noopener noreferrer";
    url.textContent = entry.url || "";

    const time = document.createElement("div");
    time.className = "time";
    time.textContent = formatTime(entry.visitedAt);

    item.appendChild(title);
    item.appendChild(url);
    item.appendChild(time);
    list.appendChild(item);
  }
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
  const result = await api.storage.local.get([
    HISTORY_KEY,
    INDEX_KEY,
    INDEX_VERSION_KEY,
    HISTORY_VERSION_KEY,
  ]);

  state.entries = Array.isArray(result[HISTORY_KEY]) ? result[HISTORY_KEY] : [];

  const rawIndex = deserializeIndex(result[INDEX_KEY]);
  const historyVersion = Number.isInteger(result[HISTORY_VERSION_KEY])
    ? result[HISTORY_VERSION_KEY]
    : 0;
  const indexVersion = Number.isInteger(result[INDEX_VERSION_KEY])
    ? result[INDEX_VERSION_KEY]
    : 0;
  const versionsMatch = historyVersion === indexVersion;
  const hasMissingIds = state.entries.some(
    (entry) => !Number.isInteger(entry.id),
  );
  const shouldUseStored =
    versionsMatch &&
    !hasMissingIds &&
    rawIndex &&
    Object.keys(rawIndex).length > 0;

  if (shouldUseStored) {
    const index = createIndex();
    importIndex(index, rawIndex);
    state.index = index;
    state.indexSize = Object.keys(rawIndex).length;
  } else if (state.entries.length > 0) {
    const index = buildIndexFromEntries(state.entries);
    state.index = index;
    state.indexSize = 0;

    exportIndex(index)
      .then((serializedIndex) => {
        state.indexSize = Object.keys(serializedIndex).length;

        if (!hasMissingIds) {
          const indexPayload = { __flexsearch: true, data: serializedIndex };
          return api.storage.local.set({
            [INDEX_KEY]: indexPayload,
            [INDEX_VERSION_KEY]: historyVersion,
          });
        }
        return undefined;
      })
      .then(() => {
        render();
      })
      .catch((error) => {
        console.error("Search My History failed to export index", error);
      });
  } else {
    state.index = null;
    state.indexSize = 0;
  }

  render();
};

const clearHistory = async () => {
  await api.storage.local.set({
    [HISTORY_KEY]: [],
    [INDEX_KEY]: { __flexsearch: true, data: {} },
    [INDEX_VERSION_KEY]: 0,
    [HISTORY_VERSION_KEY]: 0,
  });
  state.entries = [];
  state.index = null;
  state.indexSize = 0;
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

  const clearButton = document.getElementById("clear");
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      clearHistory();
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
    console.error("Search My History failed to load popup data", error);
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
