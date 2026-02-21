(() => {
  const SCHEME_ALLOWLIST = new Set(["http:", "https:"]);

  const api = {
    HISTORY_KEY: "WDIR_Entries",
    INDEX_KEY: "WDIR_Index",
    NEXT_ID_KEY: "WDIR_NextId",
    INDEX_VERSION_KEY: "WDIR_IndexVersion",
    INDEX_FORMAT_VERSION_KEY: "WDIR_IndexFormatVersion",
    HISTORY_VERSION_KEY: "WDIR_EntriesVersion",
    INDEX_FORMAT_VERSION: 2,

    isSupportedUrl: (url) => {
      try {
        return SCHEME_ALLOWLIST.has(new URL(url).protocol);
      } catch (error) {
        return false;
      }
    },
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
    globalRef.WDIR_Constants = api;
  }
})();
