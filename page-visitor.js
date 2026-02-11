const MAX_CONTENT_LENGTH = 1000000;

const sendVisit = () => {
  const content =
    document.body && document.body.innerText
      ? document.body.innerText.trim().slice(0, MAX_CONTENT_LENGTH)
      : "";

  browser.runtime
    .sendMessage({
      type: "PAGE_VISITED",
      url: window.location.href,
      title: document.title,
      content,
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
