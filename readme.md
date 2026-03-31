# Libro.fm ALC Helper 🎧📚

A lightweight Google Chrome extension (Manifest V3) that automatically checks the Libro.fm ALC (Advanced Listener Copy) pages for the current month, visually greys out the audiobooks you already own, and injects **color-coded genre tags** directly onto the page.

No more accidentally clicking on books you've already claimed, and easily spot the genres you love at a glance!

## ✨ Features
* **Automatic Detection:** Scans your Libro.fm library in the background and uses an ultra-fast O(1) ISBN Hash Table to compare it to the ALC page.
* **Visual Badge:** Greys out owned audiobooks and overlays a highly visible "Already in Library" badge so you can easily skip them.
* **Color-Coded Genres:** Asynchronously fetches and injects genre tags for every book on the ALC page, uniquely color-coded for quick visual sorting.
* **Options Dashboard:** Simply click the extension icon in your Chrome toolbar to open a dedicated Options page to manage your cache, get support, or export diagnostic data.
* **Smart Caching & Sync:** Saves your library data locally (`chrome.storage.local`) for 24 hours. Automatically syncs changes across all open Libro.fm tabs without needing manual page refreshes.
* **Support Export System:** Having issues? Generate a `.json` diagnostic file containing extension logs and cache states with a single click on the Options page.
* **Privacy First:** 100% local. No data is sent to external servers. It only uses your active, logged-in Libro.fm session.

## 🚀 Installation (Developer Mode)

Because this extension is not currently listed in the Chrome Web Store, you can install it locally in just a few steps:

1. **Download the code:** Click the green **Code** button at the top of this repository and select **Download ZIP**. (Or clone the repo via Git).
2. **Extract the ZIP:** Unzip the folder somewhere on your computer.
3. **Open Chrome Extensions:** Open Google Chrome and type `chrome://extensions/` into your URL bar.
4. **Enable Developer Mode:** Turn on the **Developer mode** toggle switch in the top right corner.
5. **Load Unpacked:** Click the **Load unpacked** button in the top left corner.
6. **Select the folder:** Choose the extracted `libro-alc-checker` folder.

The extension is now installed! 

## 📖 How to Use
1. Log into your account on [Libro.fm](https://libro.fm).
2. Navigate to an ALC playlist page (e.g., `https://libro.fm/playlists/alc`).
3. A small status box will appear in the top right corner. 
4. **First Run:** It will quickly page through your library to build a cache. Once complete, owned books will instantly turn grey, and genre tags will pop in below the book titles.
5. **Updating:** If you claim a new audiobook, simply click the **↻ Refresh Library** button in the on-screen overlay to update your cache.
6. **Settings:** Click the Libro.fm ALC Helper icon in your Chrome Extensions toolbar at any time to open the Options page.

## 🛠️ Technical Details
* **Manifest V3:** Built using the latest modern Chrome Extension standards including Service Workers.
* **Permissions:** Requires `tabs` and `storage` permissions. It does not read data from any other websites outside of Libro.fm.
* **Polite Fetching:** Built-in 400ms delays when fetching genres to ensure Libro.fm's servers are respected and never spammed.
* **Custom Logger:** Captures up to 500 extension-specific background events locally to assist with easy debugging.

### 🎛️ Extension Options & Troubleshooting
Instead of relying on developer console commands, everything you need to manage and troubleshoot the extension is built right into the Options page! Simply click the extension icon in your Chrome toolbar to access:

* **Clear Library Cache:** Forces the extension to forget your owned books, triggering a completely fresh scan of your library the next time you visit Libro.fm.
* **Clear Genre Cache:** Wipes the locally stored genres, forcing the extension to re-fetch the latest genre tags from the audiobook pages.
* **Download Data for Support:** Having issues? Click this button to instantly generate a `.json` diagnostic file containing your local cache states and custom extension logs. You can attach this file when reaching out for help.
* **Quick Navigation:** Jump straight back to Libro.fm or access community support links.

## 🤝 Community & Support
If you run into any issues, you can easily download your diagnostic data from the Options page and reach out for help:
* ✉️ **Email Support:** support@celestialwake.com
* 💬 **Discord:** [Join the Support Discord](https://discord.gg/yn36ZHGY8C)
* ☕ **Support the Developer:** [Buy Me a Coffee](https://buymeacoffee.com/celestialwake)

Feel free to open an issue or submit a pull request if you have ideas for improvements, better CSS styling, or bug fixes!

## 🤖 Acknowledgments
* This extension was developed with the coding assistance of Google's **Gemini Pro** AI, which assisted with the Manifest V3 Service Worker setup, ISBN Hash Table implementation, DOM traversal logic, asynchronous polite fetching, and custom data export systems.
