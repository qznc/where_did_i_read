const MAX_CONTENT_LENGTH = 1000000;
const SCHEME_ALLOWLIST = new Set(["http:", "https:"]);

const isSupportedUrl = (url) => {
  try {
    return SCHEME_ALLOWLIST.has(new URL(url).protocol);
  } catch (error) {
    return false;
  }
};

const sendVisit = () => {
  if (!isSupportedUrl(window.location.href)) {
    return;
  }

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
