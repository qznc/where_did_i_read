(() => {
  const storage = WDIR_Storage;

  const setStatus = (message, isError = false) => {
    const statusEl = document.getElementById("status");
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#b42318" : "#475467";
  };

  const bindWipeButton = () => {
    const wipeButton = document.getElementById("wipe-db");
    if (!wipeButton) {
      return;
    }

    wipeButton.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "This will permanently delete all saved history and index data. Continue?",
      );
      if (!confirmed) {
        return;
      }

      wipeButton.disabled = true;
      setStatus("Wiping database...");

      try {
        await storage.clear();
        setStatus("Database wiped successfully.");

        // Notify other extension pages (if open) so they can react to data reset.
        if (
          typeof browser !== "undefined" &&
          browser.runtime &&
          typeof browser.runtime.sendMessage === "function"
        ) {
          browser.runtime
            .sendMessage({ type: "WDIR_DATABASE_WIPED" })
            .catch(() => {});
        } else if (
          typeof chrome !== "undefined" &&
          chrome.runtime &&
          typeof chrome.runtime.sendMessage === "function"
        ) {
          chrome.runtime.sendMessage({ type: "WDIR_DATABASE_WIPED" }, () => {
            // Ignore runtime errors if no listener exists.
            void chrome.runtime.lastError;
          });
        }
      } catch (error) {
        console.error("Where Did I Read failed to wipe database", error);
        setStatus("Failed to wipe database.", true);
      } finally {
        wipeButton.disabled = false;
      }
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindWipeButton, { once: true });
  } else {
    bindWipeButton();
  }
})();
