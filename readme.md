# Libro.fm ALC Helper 🎧📚

A lightweight Google Chrome extension that automatically checks the Libro.fm ALC (Advanced Listener Copy) pages for the current month and visually greys out the audiobooks you already own in your library.

No more accidentally clicking on books you've already claimed!

## ✨ Features
* **Automatic Detection:** Scans your Libro.fm library in the background and compares it to the ALC page.
* **Visual Badge:** Greys out owned audiobooks and overlays a highly visible "Already in Library" badge so you can easily skip them.
* **Smart Caching:** Saves your library data locally for 24 hours so the extension runs instantly without spamming Libro.fm's servers.
* **Manual Refresh:** Includes a convenient on-screen "↻ Refresh Library" button to force a new sync immediately after you claim a new book.
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
4. **First Run:** It will quickly page through your library to build a cache. Once complete, owned books will instantly turn grey with an "Already in Library" badge.
5. **Updating:** If you claim a new audiobook, simply click the **↻ Refresh Library** button in the top right status box to update your cache.

## 🛠️ Technical Details
* **Manifest V3:** Built using the latest modern Chrome Extension standards.
* **Permissions:** Only requires `*://*.libro.fm/*` permissions. It does not read data from any other websites.
* **Vanilla JS:** Built with pure JavaScript and CSS. No heavy frameworks or dependencies.

### Helpful Debug Web Console Commands

These snippets can be directly pasted into the Developer Tools Console to help with debugging.

* Clear the local cache of loaded library books
```js
localStorage.removeItem('libro_owned_books_cache');
```

* Output library titles stored in cache

```
let cacheStr = localStorage.getItem('libro_owned_books_cache');
if (cacheStr) {
    let cacheData = JSON.parse(cacheStr);
    console.log("Cache Timestamp:", new Date(cacheData.timestamp).toLocaleString());
    console.log("Total Books:", Object.keys(cacheData.books).length);
    console.table(cacheData.books);
} else {
    console.log("No cache found! Make sure the extension has run at least once.");
}
```

* Clear the recently loaded ALCs and their genres
```
localStorage.removeItem('libro_genres_cache');
```

* Output the recently loaded ALCs and their genres
```
console.table(JSON.parse(localStorage.getItem('libro_genres_cache') || '{}'));
```

## 🤝 Contributing
Feel free to open an issue or submit a pull request if you have ideas for improvements, better CSS styling, or bug fixes!

## 🤖 Acknowledgments
* This extension was developed with the coding assistance of Google's **Gemini Pro** AI, which helped with the Chrome Manifest V3 setup, DOM traversal logic, and CSS styling.
