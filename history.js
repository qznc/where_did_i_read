const HISTORY_KEY = "searchMyHistoryEntries";
const INDEX_KEY = "searchMyHistoryIndex";
const NEXT_ID_KEY = "searchMyHistoryNextId";
const api = typeof browser !== "undefined" ? browser : chrome;

const state = {
  entries: [],
  index: {},
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
    indexSize.textContent = String(Object.keys(state.index || {}).length);
  }
};

const tokenize = (text) => {
  const raw = String(text || "").toLowerCase();
  const parts = raw.split(/[^a-z0-9]+/);
  const tokens = [];
  for (const part of parts) {
    if (part.length >= 2) {
      tokens.push(part);
    }
  }
  return tokens;
};

const buildIndexFromEntries = (entries) => {
  let maxId = 0;
  for (const entry of entries) {
    if (Number.isInteger(entry.id) && entry.id > maxId) {
      maxId = entry.id;
    }
  }

  for (const entry of entries) {
    if (!Number.isInteger(entry.id)) {
      maxId += 1;
      entry.id = maxId;
    }
  }

  const index = {};
  for (const entry of entries) {
    const tokens = tokenize(
      `${entry.title || ""} ${entry.url || ""} ${entry.content || ""}`,
    );
    for (const token of tokens) {
      if (!index[token]) {
        index[token] = [];
      }
      if (!index[token].includes(entry.id)) {
        index[token].push(entry.id);
      }
    }
  }

  return index;
};

const indexIsStale = (entries, index) => {
  if (!index || typeof index !== "object") {
    return true;
  }

  if (entries.length === 0) {
    return Object.keys(index).length > 0;
  }

  if (Object.keys(index).length === 0) {
    return true;
  }

  for (const entry of entries) {
    if (!Number.isInteger(entry.id)) {
      return true;
    }
    const tokens = tokenize(
      `${entry.title || ""} ${entry.url || ""} ${entry.content || ""}`,
    );
    for (const token of tokens) {
      const ids = index[token];
      if (!Array.isArray(ids) || !ids.includes(entry.id)) {
        return true;
      }
    }
  }

  return false;
};

const intersectIds = (lists) => {
  if (lists.length === 0) {
    return [];
  }
  const sorted = lists.slice().sort((a, b) => a.length - b.length);
  let result = new Set(sorted[0]);
  for (let i = 1; i < sorted.length; i += 1) {
    const next = new Set(sorted[i]);
    result = new Set([...result].filter((id) => next.has(id)));
    if (result.size === 0) {
      return [];
    }
  }
  return Array.from(result);
};

const render = () => {
  const list = document.getElementById("results");
  if (!list) {
    return;
  }
  list.innerHTML = "";

  const normalizedQuery = state.query.trim().toLowerCase();
  if (normalizedQuery.length < 2) {
    updateCounts(0, state.entries.length);
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Type at least 2 characters to search.";
    list.appendChild(empty);
    return;
  }

  const tokens = tokenize(normalizedQuery);
  if (tokens.length === 0) {
    updateCounts(0, state.entries.length);
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No searchable tokens found.";
    list.appendChild(empty);
    return;
  }

  const idLists = tokens
    .map((token) => state.index[token] || [])
    .filter((ids) => ids.length > 0);

  if (idLists.length !== tokens.length) {
    updateCounts(0, state.entries.length);
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No matching history entries.";
    list.appendChild(empty);
    return;
  }

  const matchingIds = intersectIds(idLists);
  updateCounts(matchingIds.length, state.entries.length);

  if (matchingIds.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No matching history entries.";
    list.appendChild(empty);
    return;
  }

  const entryMap = new Map(state.entries.map((entry) => [entry.id, entry]));
  const matches = matchingIds
    .map((id) => entryMap.get(id))
    .filter(Boolean)
    .sort((a, b) => (b.visitedAt || 0) - (a.visitedAt || 0))
    .slice(0, 20);

  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No matching history entries.";
    list.appendChild(empty);
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

const loadState = async () => {
  const result = await api.storage.local.get([HISTORY_KEY, INDEX_KEY]);
  state.entries = Array.isArray(result[HISTORY_KEY]) ? result[HISTORY_KEY] : [];
  const storedIndex =
    result[INDEX_KEY] && typeof result[INDEX_KEY] === "object"
      ? result[INDEX_KEY]
      : {};
  state.index = indexIsStale(state.entries, storedIndex)
    ? buildIndexFromEntries(state.entries)
    : storedIndex;
  render();
};

const clearHistory = async () => {
  await api.storage.local.set({
    [HISTORY_KEY]: [],
    [INDEX_KEY]: {},
    [NEXT_ID_KEY]: 1,
  });
  state.entries = [];
  state.index = {};
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
