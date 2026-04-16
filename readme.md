# Libro.fm ALC Helper 🎧📚

A lightweight Google Chrome extension (Manifest V3) that automatically checks the Libro.fm ALC (Advanced Listener Copy) pages for the current month, visually greys out the audiobooks you already own (or have on pre-order), and injects **color-coded genre tags** directly onto the page.

No more accidentally clicking on books you've already claimed, and easily spot the genres you love at a glance!

## ✨ Features
* **Automatic Detection:** Scans your Libro.fm library and pre-orders in the background, using an ultra-fast O(1) ISBN Hash Table to compare against the ALC page.
* **Pre-order Support:** Now seamlessly checks your active pre-orders alongside your standard library.
* **Visual Badge:** Greys out owned audiobooks and overlays a highly visible "Already in Library" badge centered on the cover so you can easily skip them. Hovering over a book smoothly reveals the cover underneath.
* **Color-Coded Genres:** Asynchronously fetches and injects genre tags for every book on the ALC page, uniquely color-coded for quick visual sorting.
* **Smart Caching & Sync:** Saves your library data locally (`chrome.storage.local`) for 24 hours. Features interrupted-fetch protection to prevent partial cache bugs.
* **Options Dashboard:** Click the extension icon in your Chrome toolbar to open a dedicated Options page to manage your cache, get support, or export diagnostic data.
* **Privacy First:** 100% local. No data is sent to external servers. It only uses your active, logged-in Libro.fm session.

## 🚀 Installation 

### Option 1: Chrome Web Store (Recommended)
*(Note: Currently pending Web Store approval - link coming soon!)*
1. Visit the **Libro.fm ALC Helper** page on the Chrome Web Store.
2. Click **Add to Chrome**.
3. Pin the extension to your toolbar for easy access to the Settings page.

### Option 2: Manual Installation (Developer Mode)
If you prefer to load the extension directly from the source code:
1. **Download the code:** Click the green **Code** button at the top of this repository and select **Download ZIP**. (Or clone the repo via Git).
2. **Extract the ZIP:** Unzip the folder somewhere on your computer.
3. **Open Chrome Extensions:** Open Google Chrome and type `chrome://extensions/` into your URL bar.
4. **Enable Developer Mode:** Turn on the **Developer mode** toggle switch in the top right corner.
5. **Load Unpacked:** Click the **Load unpacked** button in the top left corner.
6. **Select the folder:** Choose the extracted `libro-alc-checker` folder.

## 📖 How to Use
1. Log into your account on [Libro.fm](https://libro.fm).
2. Navigate to an ALC playlist page (e.g., `https://libro.fm/playlists/alc`).
3. A small status box will appear at the top of the screen. 
4. **First Run:** It will quickly page through your library to build a cache. Once complete, owned books will instantly turn grey, and genre tags will pop in below the book titles.
5. **Updating:** If you claim a new audiobook, simply click the **↻ Refresh Library** button in the on-screen overlay to update your cache.
6. **Settings:** Click the Libro.fm ALC Helper icon in your Chrome Extensions toolbar at any time to open the Options page.

## 🛠️ Technical Details
* **Manifest V3:** Built using the latest modern Chrome Extension standards including Service Workers.
* **Strict Least-Privilege Permissions:** Only requires `storage` and host permissions for `https://libro.fm/*`.
* **Rich Data Mapping:** The cache maps ISBNs to specific book titles and sources (e.g., "Library Page 2" or "Preorder") for highly accurate debugging.
* **Polite Fetching:** Built-in 400ms delays when fetching genres to ensure Libro.fm's servers are respected and never spammed.
* **Custom Logger:** Captures up to 500 extension-specific background events locally to assist with easy debugging.

### 💻 Development & Building from Source
If you'd like to contribute to the code or build the production-ready ZIP file yourself, this project uses Node.js for its build and testing pipeline.

**Prerequisites:**
* [Node.js](https://nodejs.org/) (We recommend using [Volta](https://volta.sh/) to automatically respect the pinned Node version in `package.json`).

**Setup & Testing:**
1. Clone the repository.
2. Run `npm install` to install development dependencies (Jest, Bestzip, etc.).
3. Run `npm test` to execute the Jest test suite and ensure all components are functioning correctly.

**Building the Extension:**
To generate a production-ready package for the Chrome Web Store:
```bash
npm run build

### 🎛️ Extension Options & Troubleshooting
Instead of relying on developer console commands, everything you need to manage and troubleshoot the extension is built right into the Options page! 

* **Clear Library Cache:** Forces the extension to forget your owned books, triggering a completely fresh scan of your library the next time you visit Libro.fm.
* **Clear Genre Cache:** Wipes the locally stored genres, forcing the extension to re-fetch the latest genre tags from the audiobook pages.
* **Download Data for Support:** Having issues? Click this button to instantly generate a `.json` diagnostic file containing your local cache states and custom extension logs. You can attach this file when reaching out for help.

## 🤝 Community & Support
If you run into any issues, you can easily download your diagnostic data from the Options page and reach out for help:
* ✉️ **Email Support:** support@celestialwake.com
* 💬 **Discord:** [Join the Support Discord](https://discord.gg/yn36ZHGY8C)
* ☕ **Support the Developer:** [Buy Me a Coffee](https://buymeacoffee.com/celestialwake)

Feel free to open an issue or submit a pull request if you have ideas for improvements, better CSS styling, or bug fixes!

## 🤖 Acknowledgments
* This extension was developed with the coding assistance of Google's **Gemini Pro** AI, which assisted with the Manifest V3 Service Worker setup, ISBN Hash Table implementation, DOM traversal logic, asynchronous polite fetching, custom data export systems, and automated build pipelines.
