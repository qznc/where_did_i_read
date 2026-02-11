const HISTORY_KEY = "searchMyHistoryEntries";
const INDEX_KEY = "searchMyHistoryIndex";
const NEXT_ID_KEY = "searchMyHistoryNextId";
const { indexEntry, removeEntryFromIndex } = SearchMyHistoryIndexing;
const MAX_ENTRIES = 10000000;
const INDEX_VERSION_KEY = "searchMyHistoryIndexVersion";
const HISTORY_VERSION_KEY = "searchMyHistoryEntriesVersion";
const SAVE_DEBOUNCE_MS = 10000;
let pendingSaveTimeout = null;
let pendingSaveState = null;
let pendingSaveResolvers = [];

const flushPendingSave = async () => {
  if (!pendingSaveState) {
    pendingSaveTimeout = null;
    return;
  }

  const { entries, index, nextId, historyVersion, indexVersion } =
    pendingSaveState;
  pendingSaveState = null;
  const resolvers = pendingSaveResolvers;
  pendingSaveResolvers = [];
  pendingSaveTimeout = null;

  try {
    await browser.storage.local.set({
      [HISTORY_KEY]: entries,
      [INDEX_KEY]: index,
      [NEXT_ID_KEY]: nextId,
      [HISTORY_VERSION_KEY]: historyVersion,
      [INDEX_VERSION_KEY]: indexVersion,
    });
    for (const resolver of resolvers) {
      resolver.resolve();
    }
  } catch (error) {
    for (const resolver of resolvers) {
      resolver.reject(error);
    }
    throw error;
  }
};

const DOMAIN_BLACKLIST = new Set([
  "www.google.com",
  "www.bing.com",
  "www.ecosia.org",
]);

const SCHEME_ALLOWLIST = new Set(["http:", "https:"]);

const isSupportedUrl = (url) => {
  try {
    return SCHEME_ALLOWLIST.has(new URL(url).protocol);
  } catch (error) {
    return false;
  }
};

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_reader",
  "utm_name",
  "utm_cid",
  "utm_source_platform",
  "utm_creative_format",
  "utm_marketing_tactic",
  "gclid",
  "fbclid",
  "msclkid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
]);

const sanitizeUrl = (url) => {
  try {
    const parsed = new URL(url);
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch (error) {
    return null;
  }
};

const isBlacklistedUrl = (url) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const domain of DOMAIN_BLACKLIST) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return true;
      }
    }
  } catch (error) {
    return false;
  }
  return false;
};

const loadHistory = async () => {
  const result = await browser.storage.local.get(HISTORY_KEY);
  return Array.isArray(result[HISTORY_KEY]) ? result[HISTORY_KEY] : [];
};

const loadIndexState = async () => {
  const result = await browser.storage.local.get([
    INDEX_KEY,
    NEXT_ID_KEY,
    INDEX_VERSION_KEY,
    HISTORY_VERSION_KEY,
  ]);
  const index = result[INDEX_KEY];
  const nextId = result[NEXT_ID_KEY];
  const indexVersion = result[INDEX_VERSION_KEY];
  const historyVersion = result[HISTORY_VERSION_KEY];
  return {
    index: index && typeof index === "object" ? index : null,
    nextId: Number.isInteger(nextId) ? nextId : null,
    indexVersion: Number.isInteger(indexVersion) ? indexVersion : null,
    historyVersion: Number.isInteger(historyVersion) ? historyVersion : null,
  };
};

const normalizeEntry = ({ url, title, content, visitedAt }, id) => ({
  id,
  url,
  title: title || "",
  content: typeof content === "string" ? content : "",
  visitedAt: typeof visitedAt === "number" ? visitedAt : Date.now(),
});

const normalizeHistoryForUniqueUrls = (history) => {
  const byUrl = new Map();
  for (const entry of history) {
    if (!entry || typeof entry.url !== "string" || entry.url.length === 0) {
      continue;
    }
    const existing = byUrl.get(entry.url);
    if (!existing || (entry.visitedAt || 0) >= (existing.visitedAt || 0)) {
      byUrl.set(entry.url, entry);
    }
  }

  const entries = Array.from(byUrl.values()).sort(
    (a, b) => (a.visitedAt || 0) - (b.visitedAt || 0),
  );

  return {
    entries,
    changed: entries.length !== history.length,
  };
};

const rebuildIndex = (history, historyVersion = 0) => {
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
    historyVersion,
    indexVersion: historyVersion,
  };
};

const ensureIndex = async (history) => {
  const state = await loadIndexState();
  const hasMissingIds = history.some((entry) => !Number.isInteger(entry.id));
  const baseHistoryVersion = Number.isInteger(state.historyVersion)
    ? state.historyVersion
    : 0;
  const baseIndexVersion = Number.isInteger(state.indexVersion)
    ? state.indexVersion
    : 0;
  const versionsMatch = baseIndexVersion === baseHistoryVersion;

  if (!state.index || !state.nextId || hasMissingIds || !versionsMatch) {
    return rebuildIndex(history, baseHistoryVersion);
  }

  return {
    entries: history,
    index: state.index,
    nextId: state.nextId,
    historyVersion: baseHistoryVersion,
    indexVersion: baseIndexVersion,
  };
};

const saveState = (entries, index, nextId, historyVersion, indexVersion) => {
  pendingSaveState = { entries, index, nextId, historyVersion, indexVersion };
  return new Promise((resolve, reject) => {
    pendingSaveResolvers.push({ resolve, reject });

    if (pendingSaveTimeout) {
      return;
    }

    pendingSaveTimeout = setTimeout(() => {
      flushPendingSave().catch((error) => {
        console.error("Search My History failed to persist history", error);
      });
    }, SAVE_DEBOUNCE_MS);
  });
};

const trimToMaxEntries = (entries, index) => {
  if (entries.length <= MAX_ENTRIES) {
    return;
  }
  const removeCount = entries.length - MAX_ENTRIES;
  const removed = entries.splice(0, removeCount);
  for (const removedEntry of removed) {
    removeEntryFromIndex(index, removedEntry);
  }
};

const recordVisit = async (payload) => {
  if (!payload || typeof payload.url !== "string" || payload.url.length === 0) {
    return;
  }

  const sanitizedUrl = sanitizeUrl(payload.url);
  if (!sanitizedUrl) {
    return;
  }

  if (!isSupportedUrl(sanitizedUrl)) {
    return;
  }

  if (isBlacklistedUrl(sanitizedUrl)) {
    return;
  }

  try {
    const history = await loadHistory();
    const normalized = normalizeHistoryForUniqueUrls(history);
    const baseHistory = normalized.entries;
    const state = await ensureIndex(baseHistory);

    const sanitizedPayload = { ...payload, url: sanitizedUrl };

    const existingIndex = state.entries.findIndex(
      (entry) => entry.url === sanitizedUrl,
    );

    if (existingIndex >= 0) {
      const existing = state.entries[existingIndex];
      removeEntryFromIndex(state.index, existing);
      const updated = normalizeEntry(sanitizedPayload, existing.id);
      state.entries.splice(existingIndex, 1);
      state.entries.push(updated);
      indexEntry(state.index, updated);
    } else {
      const entry = normalizeEntry(sanitizedPayload, state.nextId);
      state.entries.push(entry);
      indexEntry(state.index, entry);
      state.nextId = entry.id + 1;
    }

    trimToMaxEntries(state.entries, state.index);

    const nextHistoryVersion = (state.historyVersion || 0) + 1;
    state.historyVersion = nextHistoryVersion;
    state.indexVersion = nextHistoryVersion;

    await saveState(
      state.entries,
      state.index,
      state.nextId,
      state.historyVersion,
      state.indexVersion,
    );
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

browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({ url: browser.runtime.getURL("history.html") });
});
