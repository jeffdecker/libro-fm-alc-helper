// === CONFIGURATION ===
const ALC_PAGE_URL_PART = "/pub-list/bookseller-alcs";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// CSS Selectors
const SELECTORS = {
    alcBookContainer: '.book-grid-item',
    alcBookTitle: 'h2',
    alcBookLink: 'a.book',
    detailPageGenreLinks: '.audiobook-genres a'
};

// Get the version from the manifest
const version = `v${chrome.runtime.getManifest().version}`;

// === CHROME STORAGE PROMISE WRAPPERS ===
function getStorage(key) {
    return new Promise(resolve => {
        chrome.storage.local.get([key], result => resolve(result[key]));
    });
}
function setStorage(key, value) {
    return new Promise(resolve => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}
function removeStorage(keys) {
    return new Promise(resolve => {
        chrome.storage.local.remove(keys, resolve);
    });
}
// =======================================

// --- CUSTOM LOGGER ---
const DebugLogger = {
    logs: [],
    maxLogs: 500, // Prevent storage overflow

    // Internal method to format and store the log
    _record: function(level, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(), // Explicitly saves the level (LOG, WARN, ERROR)
            message: message,
            data: data
        };

        // Add to array and enforce limits
        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift(); 
        }

        // Save to storage asynchronously so the Options page can access it
        chrome.storage.local.set({ libro_debug_logs: this.logs });
    },

    // Public Methods
    log: function(message, data = null) {
        message = `[ALC Helper LOG] ${version} ${message}`;
        this._record('LOG', message, data);
        console.log(message, data ? data : '');
    },

    info: function(message, data = null) {
        message = `[ALC Helper INFO] ${version} ${message}`;
        this._record('INFO', message, data);
        console.info(message, data ? data : '');
    },

    warn: function(message, data = null) {
        message = `[ALC Helper WARN] ${version} ${message}`;
        this._record('WARN', message, data);
        console.warn(message, data ? data : '');
    },

    error: function(message, data = null) {
        message = `[ALC Helper ERROR] ${version} ${message}`;
        this._record('ERROR', message, data);
        console.error(message, data ? data : '');
    },

    clear: function() {
        this.logs = [];
        chrome.storage.local.remove('libro_debug_logs');
    }
};

// === SMART RELOAD LOGIC ===
let needsRefresh = false;
let isProcessing = false;

// Listen for the Options page changing preferences or clearing cache
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        const styleChanged = changes.libro_custom_owned_style !== undefined;
        const genresCleared = changes.libro_genres_cache && !changes.libro_genres_cache.newValue;

        if (styleChanged || genresCleared) {
            DebugLogger.log("Storage change detected (style toggle or genre cache clear).");
            
            // If the tab is currently visible, reload immediately. 
            // If hidden, flag it to reload when the user comes back.
            if (document.visibilityState === 'visible') {
                resetAndReload();
            } else {
                needsRefresh = true;
            }
        }
    }
});

// Wait for the user to switch back to the Libro.fm tab before fetching
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && needsRefresh) {
        DebugLogger.log("Tab became visible. Triggering queued refresh...");
        needsRefresh = false;
        resetAndReload();
    }
});

// Helper function to clean the UI and restart
function resetAndReload() {
    if (isProcessing) return; // Prevent double-triggers

    document.querySelectorAll('[data-alc-processed]').forEach(el => el.removeAttribute('data-alc-processed'));

    if (overlayEl) {
        updateOverlay("Resetting...");
    }
    
    init();
}
// ==========================

if (window.location.href.includes(ALC_PAGE_URL_PART)) {
    window.addEventListener('load', init);
}

// --- UI Overlay Functions ---
let overlayEl = null;

function createOverlay() {
    if (overlayEl) {
        overlayEl.remove();
    }
    
    overlayEl = document.createElement('div');
    overlayEl.id = 'alc-checker-overlay';
    
    overlayEl.innerHTML = `
        <div class="status-text">ALC Helper ${version}</div>
        <div class="genre-text">Initializing...</div>
        <button id="alc-settings-btn" class="settings-btn" title="Open Extension Settings">⚙️ Settings</button>
    `;
    document.body.appendChild(overlayEl);

    // Settings Button Listener
    document.getElementById('alc-settings-btn').addEventListener('click', () => {
        DebugLogger.log("User opened settings page from overlay.");
        chrome.runtime.sendMessage({ action: "openOptionsPage" }); 
    });
}

function updateOverlay(status, genreStatus = "") {
    if (!overlayEl) return;
    
    if (status) {
        overlayEl.querySelector('.status-text').textContent = status;
    }
    if (genreStatus) {
        overlayEl.querySelector('.genre-text').textContent = genreStatus;
    }
}
// ----------------------------

async function init() {
    if (isProcessing) return; // Lock to prevent double-running
    isProcessing = true;
    
    try {
        DebugLogger.log("Starting up...");
        createOverlay();
        
        // Retrieve the custom styling toggle setting (default to true)
        const customStylingEnabled = await getStorage('libro_custom_owned_style') !== false;

        // Clear previous UI elements before processing new data
        document.querySelectorAll('.already-owned-alc').forEach(el => el.classList.remove('already-owned-alc'));
        document.querySelectorAll('.alc-owned-badge').forEach(el => el.remove());
        document.querySelectorAll('.alc-genre-container').forEach(el => el.remove());

        // Scan ALC page, apply dimming/badges conditionally, and gather URLs for genre fetching
        const alcBooksData = processALCBooks(customStylingEnabled);
        updateOverlay(`ALC Helper ${version}`, "Fetching genres...");

        // Fetch and inject genres in the background
        await loadAndInjectGenres(alcBooksData);
        updateOverlay(`ALC Helper ${version}`, "All genres loaded!");
        
    } finally {
        // Unlock when finished so it can run again later if needed
        isProcessing = false; 
    }
}

function processALCBooks(customStylingEnabled) {
    const alcBooks = document.querySelectorAll(SELECTORS.alcBookContainer);
    const booksToProcess = [];
    let ownedCount = 0;

    alcBooks.forEach((bookNode) => {
        // 1. Idempotency: Skip if we've already processed this exact book
        if (bookNode.dataset.alcProcessed === 'true') {
            return;
        }

        // 2. Smart Link Selection:
        const linkNode = bookNode.matches('a') ? bookNode : bookNode.querySelector(SELECTORS.alcBookLink);

        let isbn = null;
        let bookUrl = null;

        if (linkNode) {
            bookUrl = linkNode.href; // Absolute URL for genre fetching

            // Primary ISBN extraction (Regex from href)
            const hrefAttr = linkNode.getAttribute('href') || '';
            const match = hrefAttr.match(/\/audiobooks\/(\d+)/);

            if (match && match[1]) {
                isbn = match[1];
            } else {
                // BACKUP: grab it from the Quick Look button
                const quickLookBtn = bookNode.querySelector('button[data-open^="book-"]');
                if (quickLookBtn) {
                    const btnMatch = quickLookBtn.getAttribute('data-open').match(/book-(\d+)/);
                    if (btnMatch) isbn = btnMatch[1];
                }
            }
        }

        // Only process if we successfully parsed an ISBN
        if (isbn && bookUrl) {
            // Check if the book is owned (detected via native site class)
            const isOwned = bookNode.classList.contains('book-grid-item--alc-owned');

            if (isOwned && customStylingEnabled) {
                ownedCount++;

                // Add dimming class to the outermost wrapper (.book-grid-item)
                bookNode.classList.add('already-owned-alc');

                // Inject the UI Badge safely
                if (!bookNode.querySelector('.alc-owned-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'alc-owned-badge';
                    badge.textContent = 'Already in Library';
                    bookNode.appendChild(badge);
                }
            }

            // Queue up for Genre Fetching
            booksToProcess.push({ isbn, bookUrl, bookNode });

            // Mark this node as processed so we don't process it again on scroll/DOM mutation
            bookNode.dataset.alcProcessed = 'true';
        }
    });

    DebugLogger.log(`Page scan complete: ${booksToProcess.length} books found, ${ownedCount} already owned.`);

    return booksToProcess;
}

// Helper function to generate consistent colors based on the genre name
function getGenreColor(genre) {
    const colorMap = {
        "Fiction": "#2c3e50",
        "Fiction - Literary": "#8e44ad",
        "Fantasy": "#27ae60",
        "Sci-Fi": "#2980b9",
        "Mystery": "#8e44ad",
        "Thriller": "#c0392b",
        "Nonfiction": "#d35400",
        "Biography": "#16a085",
        "Romance": "#e74c3c",
        "Young Adult": "#f39c12",
        "History": "#7f8c8d"
    };

    if (colorMap[genre]) return colorMap[genre];
    
    let hash = 0;
    for (let i = 0; i < genre.length; i++) {
        hash = genre.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 40%)`; 
}

async function getGenreCache() {
    const cache = await getStorage('libro_genres_cache');
    return cache ? cache : {};
}

async function saveGenreCache(cacheData) {
    await setStorage('libro_genres_cache', cacheData);
}

async function loadAndInjectGenres(booksData) {
    let genreCache = await getGenreCache();
    let processedCount = 0;
    let fetchedCount = 0;

    for (const book of booksData) {
        // If the process was restarted, stop the old loop from continuing
        if (!isProcessing) return;

        const cachedEntry = genreCache[book.isbn];
        // Old format is a plain array — treat as expired so it gets re-fetched and migrated
        const isFresh = cachedEntry && !Array.isArray(cachedEntry) && (Date.now() - cachedEntry.cachedAt) < CACHE_TTL_MS;
        let genres = isFresh ? cachedEntry.genres : null;

        if (!genres) {
            try {
                const response = await fetch(book.bookUrl);
                if (response.ok) {
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    const genreNodes = doc.querySelectorAll(SELECTORS.detailPageGenreLinks);
                    genres = Array.from(genreNodes)
                        .map(n => n.textContent.trim())
                        .filter(text => text.length > 0);

                    genreCache[book.isbn] = { genres, cachedAt: Date.now() };
                    fetchedCount++;
                }

                await new Promise(r => setTimeout(r, 400));
            } catch (err) {
                DebugLogger.warn(`Failed to fetch genres for ${book.isbn}`, err);
                genres = [];
            }
        }

        processedCount++;
        updateOverlay(`ALC Helper ${version}`, `Genres loaded: ${processedCount}/${booksData.length}`);

        if (genres && genres.length > 0) {
            let currentBookElement = book.bookNode;
            if (!currentBookElement) {
                const bookLink = document.querySelector(`a[href*="${book.isbn}"]`);
                if (bookLink) {
                    currentBookElement = bookLink.closest(SELECTORS.alcBookContainer);
                }
            }

            if (!currentBookElement) continue; 

            // Safely inject if the container doesn't already have genres
            if (!currentBookElement.querySelector('.alc-genre-container')) {
                const pillContainer = document.createElement('div');
                pillContainer.className = 'alc-genre-container';
                
                genres.forEach(genre => {
                    const pill = document.createElement('span');
                    pill.className = 'alc-genre-pill';
                    pill.textContent = genre;
                    pill.style.backgroundColor = getGenreColor(genre);
                    pillContainer.appendChild(pill);
                });

                // Try to find the book-info div to place genres right underneath it
                const bookInfo = currentBookElement.querySelector('.book-info');
                
                if (bookInfo) {
                    // Puts the container right below the title/author block
                    bookInfo.after(pillContainer); 
                } else {
                    // Fallback: Put it at the bottom of the link tag
                    const bookLink = currentBookElement.querySelector('a.book, a[href*="/audiobooks/"]');
                    if (bookLink) {
                        bookLink.appendChild(pillContainer);
                    } else {
                        currentBookElement.appendChild(pillContainer);
                    }
                }
            }
        }
    }

    DebugLogger.log(`Genre fetch complete: ${fetchedCount} fetched from network, ${processedCount - fetchedCount} served from cache, out of ${booksData.length} total books.`);

    // Save the updated cache at the end, merging with any concurrent updates
    const latestCache = await getGenreCache();
    Object.assign(latestCache, genreCache);
    await setStorage('libro_genres_cache', latestCache);
}
