const HISTORY_KEY = "searchMyHistoryEntries";
const MAX_ENTRIES = 10000;

const loadHistory = async () => {
  const result = await browser.storage.local.get(HISTORY_KEY);
  return Array.isArray(result[HISTORY_KEY]) ? result[HISTORY_KEY] : [];
};

const saveHistory = async (entries) => {
  await browser.storage.local.set({ [HISTORY_KEY]: entries });
};

const normalizeEntry = ({ url, title, visitedAt }) => ({
  url,
  title: title || "",
  visitedAt: typeof visitedAt === "number" ? visitedAt : Date.now(),
});

const recordVisit = async (payload) => {
  if (!payload || typeof payload.url !== "string" || payload.url.length === 0) {
    return;
  }

  try {
    const entry = normalizeEntry(payload);
    const history = await loadHistory();

    history.push(entry);

    if (history.length > MAX_ENTRIES) {
      history.splice(0, history.length - MAX_ENTRIES);
    }

    await saveHistory(history);
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
