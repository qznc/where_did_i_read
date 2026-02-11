(() => {
  const DEFAULT_NGRAM_SIZE = 3;

  const normalizeText = (text) => String(text || "").toLowerCase();

  const splitWords = (text) => normalizeText(text).split(/[^a-z0-9]+/);

  const tokenize = (text, ngramSize = DEFAULT_NGRAM_SIZE) => {
    const parts = splitWords(text);
    const tokens = new Set();
    for (const part of parts) {
      if (part.length < 2) {
        continue;
      }
      tokens.add(part);
      if (part.length >= ngramSize) {
        for (let i = 0; i <= part.length - ngramSize; i += 1) {
          tokens.add(part.slice(i, i + ngramSize));
        }
      }
    }
    return Array.from(tokens);
  };

  const tokenizeWords = (text) =>
    splitWords(text).filter((part) => part.length >= 2);

  const tokenizeQuery = (text, ngramSize = DEFAULT_NGRAM_SIZE) => {
    const parts = splitWords(text);
    const tokens = new Set();
    for (const part of parts) {
      if (part.length < 2) {
        continue;
      }
      if (part.length < ngramSize) {
        tokens.add(part);
        continue;
      }
      for (let i = 0; i <= part.length - ngramSize; i += 1) {
        tokens.add(part.slice(i, i + ngramSize));
      }
    }
    return Array.from(tokens);
  };

  const indexEntry = (index, entry, ngramSize = DEFAULT_NGRAM_SIZE) => {
    const tokens = tokenize(
      `${entry.title || ""} ${entry.url || ""} ${entry.content || ""}`,
      ngramSize,
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

  const removeEntryFromIndex = (index, entry, ngramSize = DEFAULT_NGRAM_SIZE) => {
    const tokens = tokenize(
      `${entry.title || ""} ${entry.url || ""} ${entry.content || ""}`,
      ngramSize,
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

  const buildIndexFromEntries = (entries, ngramSize = DEFAULT_NGRAM_SIZE) => {
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
      indexEntry(index, entry, ngramSize);
    }
    return index;
  };

  const api = {
    DEFAULT_NGRAM_SIZE,
    tokenize,
    tokenizeWords,
    tokenizeQuery,
    indexEntry,
    removeEntryFromIndex,
    buildIndexFromEntries,
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
