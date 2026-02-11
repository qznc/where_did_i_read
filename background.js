const HISTORY_KEY = "searchMyHistoryEntries";
const INDEX_KEY = "searchMyHistoryIndex";
const NEXT_ID_KEY = "searchMyHistoryNextId";
const MAX_ENTRIES = 10000;

const loadHistory = async () => {
  const result = await browser.storage.local.get(HISTORY_KEY);
  return Array.isArray(result[HISTORY_KEY]) ? result[HISTORY_KEY] : [];
};

const loadIndexState = async () => {
  const result = await browser.storage.local.get([INDEX_KEY, NEXT_ID_KEY]);
  const index = result[INDEX_KEY];
  const nextId = result[NEXT_ID_KEY];
  return {
    index: index && typeof index === "object" ? index : null,
    nextId: Number.isInteger(nextId) ? nextId : null,
  };
};

const tokenize = (text) => {
  const raw = String(text || "").toLowerCase();
  const parts = raw.split(/[^a-z0-9]+/);
  const tokens = new Set();
  for (const part of parts) {
    if (part.length >= 2) {
      tokens.add(part);
    }
  }
  return Array.from(tokens);
};

const indexEntry = (index, entry) => {
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
};

const removeEntryFromIndex = (index, entry) => {
  const tokens = tokenize(
    `${entry.title || ""} ${entry.url || ""} ${entry.content || ""}`,
  );
  for (const token of tokens) {
    const ids = index[token];
    if (!ids) {
      continue;
    }
    const nextIds = ids.filter((id) => id !== entry.id);
    if (nextIds.length === 0) {
      delete index[token];
    } else {
      index[token] = nextIds;
    }
  }
};

const normalizeEntry = ({ url, title, content, visitedAt }, id) => ({
  id,
  url,
  title: title || "",
  content: typeof content === "string" ? content : "",
  visitedAt: typeof visitedAt === "number" ? visitedAt : Date.now(),
});

const rebuildIndex = (history) => {
  let maxId = 0;
  const entries = history.map((entry) => {
    if (Number.isInteger(entry.id)) {
      if (entry.id > maxId) {
        maxId = entry.id;
      }
      return entry;
    }
    maxId += 1;
    return { ...entry, id: maxId };
  });

  const index = {};
  for (const entry of entries) {
    indexEntry(index, entry);
  }

  return {
    entries,
    index,
    nextId: maxId + 1,
  };
};

const ensureIndex = async (history) => {
  const state = await loadIndexState();
  const hasMissingIds = history.some((entry) => !Number.isInteger(entry.id));
  if (!state.index || !state.nextId || hasMissingIds) {
    return rebuildIndex(history);
  }

  return {
    entries: history,
    index: state.index,
    nextId: state.nextId,
  };
};

const saveState = async (entries, index, nextId) => {
  await browser.storage.local.set({
    [HISTORY_KEY]: entries,
    [INDEX_KEY]: index,
    [NEXT_ID_KEY]: nextId,
  });
};

const recordVisit = async (payload) => {
  if (!payload || typeof payload.url !== "string" || payload.url.length === 0) {
    return;
  }

  try {
    const history = await loadHistory();
    const state = await ensureIndex(history);

    const entry = normalizeEntry(payload, state.nextId);
    state.entries.push(entry);
    indexEntry(state.index, entry);

    if (state.entries.length > MAX_ENTRIES) {
      const removed = state.entries.splice(
        0,
        state.entries.length - MAX_ENTRIES,
      );
      for (const removedEntry of removed) {
        removeEntryFromIndex(state.index, removedEntry);
      }
    }

    await saveState(state.entries, state.index, entry.id + 1);
  } catch (error) {
    console.error("Search My History failed to persist history", error);
  }
};

browser.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "PAGE_VISITED") {
    return undefined;
  }

  return recordVisit(message);
});
