const sendVisit = () => {
  browser.runtime
    .sendMessage({
      type: "PAGE_VISITED",
      url: window.location.href,
      title: document.title,
      visitedAt: Date.now(),
    })
    .catch((error) => {
      console.error("Search My History failed to record visit", error);
    });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", sendVisit, { once: true });
} else {
  sendVisit();
}
