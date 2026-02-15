# Where Did I Read - a Firefox extension

Indexes every page you visit and provides a search for you.

[Install it from addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/where-did-i-read/).

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
- This is directly inspired from [Hister](https://hister.org/) but completely lives inside your browser.

## License

This project is licensed under GPL v3. See `LICENSE`.
