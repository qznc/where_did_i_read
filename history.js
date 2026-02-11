const HISTORY_KEY = "searchMyHistoryEntries";
const api = typeof browser !== "undefined" ? browser : chrome;

const state = {
  entries: [],
  query: "",
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
};

const updateCounts = (filteredCount, totalCount) => {
  const meta = document.getElementById("meta");
  const count = document.getElementById("count");
  if (meta) {
    meta.textContent = `${filteredCount} matching`;
  }
  if (count) {
    count.textContent = String(totalCount);
  }
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

  const filtered = state.entries.filter((entry) => {
    const haystack = `${entry.title || ""} ${entry.url || ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  updateCounts(filtered.length, state.entries.length);

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No matching history entries.";
    list.appendChild(empty);
    return;
  }

  filtered
    .slice()
    .reverse()
    .slice(0, 20)
    .forEach((entry) => {
      const item = document.createElement("li");

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = entry.title || "(untitled)";

      const url = document.createElement("div");
      url.className = "url";
      url.textContent = entry.url || "";

      const time = document.createElement("div");
      time.className = "time";
      time.textContent = formatTime(entry.visitedAt);

      item.appendChild(title);
      item.appendChild(url);
      item.appendChild(time);
      list.appendChild(item);
    });
};

const loadHistory = async () => {
  const result = await api.storage.local.get(HISTORY_KEY);
  state.entries = Array.isArray(result[HISTORY_KEY]) ? result[HISTORY_KEY] : [];
  render();
};

const clearHistory = async () => {
  await api.storage.local.set({ [HISTORY_KEY]: [] });
  state.entries = [];
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
  loadHistory().catch((error) => {
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
