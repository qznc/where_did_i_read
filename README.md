# Search My History - a Firefox extension

Indexes every page you visit and provides a search for you.

## What it does

- Records page visits (URL, title, timestamp).
- Captures page text content (truncated for storage) and indexes it for search.
- Provides a popup search UI.
- Persists history and index data in extension storage.

## Usage

1. Install/load the extension in Firefox.
2. Browse as usual.
3. Click the extension icon to open the popup.
4. Type at least 2 characters to search.

## Notes

- The content index is built from title, URL, and page text.
- Page text is truncated to avoid excessive storage growth.

## ToDO

- [ ] use IndexedDB instead of localStorage
- [ ] auto-completion for search
- [x] use flexsearch  https://github.com/nextapps-de/flexsearch
- [x] update flexsearch to 0.8.2  https://github.com/nextapps-de/flexsearch/archive/refs/tags/0.8.2.tar.gz
