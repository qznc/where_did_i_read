(() => {
  const DB_NAME = "searchMyHistoryDb";
  const DB_VERSION = 1;
  const STORE_NAME = "kv";

  let dbPromise = null;

  const openDb = () => {
    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error("Failed to open IndexedDB"));
      };
    });

    return dbPromise;
  };

  const withStore = async (mode, callback) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);

      let result;
      try {
        result = callback(store);
      } catch (error) {
        reject(error);
        return;
      }

      tx.oncomplete = () => resolve(result);
      tx.onerror = () =>
        reject(tx.error || new Error("IndexedDB transaction failed"));
      tx.onabort = () =>
        reject(tx.error || new Error("IndexedDB transaction aborted"));
    });
  };

  const get = async (key) =>
    withStore("readonly", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error || new Error("IndexedDB get failed"));
      });
    });

  const getMany = async (keys) =>
    withStore("readonly", (store) => {
      return Promise.all(
        (keys || []).map(
          (key) =>
            new Promise((resolve, reject) => {
              const request = store.get(key);
              request.onsuccess = () => resolve([key, request.result]);
              request.onerror = () =>
                reject(request.error || new Error("IndexedDB get failed"));
            }),
        ),
      ).then((entries) => Object.fromEntries(entries));
    });

  const set = async (payload) =>
    withStore("readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const entries = payload && typeof payload === "object" ? payload : {};
        for (const [key, value] of Object.entries(entries)) {
          store.put(value, key);
        }
        resolve();
        store.transaction.onerror = () =>
          reject(store.transaction.error || new Error("IndexedDB set failed"));
      });
    });

  const remove = async (key) =>
    withStore("readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(request.error || new Error("IndexedDB delete failed"));
      });
    });

  const clear = async () =>
    withStore("readwrite", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () =>
          reject(request.error || new Error("IndexedDB clear failed"));
      });
    });

  const api = {
    get,
    getMany,
    set,
    remove,
    clear,
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
    globalRef.SearchMyHistoryStorage = api;
  }
})();
