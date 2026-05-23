// === CONFIGURATION ===
const ALC_PAGE_URL_PART = "/pub-list/bookseller-alcs"; 
const MAX_TEST_PAGES = 999; 

// CSS Selectors
const SELECTORS = {
    alcBookContainer: '.book-grid-item',       
    alcBookTitle: 'h2',                             
    alcBookLink: 'a.book',
    alcPillTarget: 'p.margin-top', 
    detailPageGenreLinks: '.audiobook-genres a' 
};

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
        this._record('LOG', message, data);
        console.log(`[LibroALC LOG] ${message}`, data ? data : '');
    },

    info: function(message, data = null) {
        this._record('INFO', message, data);
        console.info(`[LibroALC INFO] ${message}`, data ? data : '');
    },

    warn: function(message, data = null) {
        this._record('WARN', message, data);
        console.warn(`[LibroALC WARN] ${message}`, data ? data : '');
    },

    error: function(message, data = null) {
        this._record('ERROR', message, data);
        console.error(`[LibroALC ERROR] ${message}`, data ? data : '');
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
            DebugLogger.log("[ALC Helper] Storage change detected (style toggle or genre cache clear).");
            
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
        DebugLogger.log("[ALC Helper] Tab became visible. Triggering queued refresh...");
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
        <div class="status-text">ALC Helper</div>
        <div class="genre-text">Initializing...</div>
        <button id="alc-settings-btn" class="settings-btn" title="Open Extension Settings">⚙️ Settings</button>
    `;
    document.body.appendChild(overlayEl);

    // Settings Button Listener
    document.getElementById('alc-settings-btn').addEventListener('click', () => {
        DebugLogger.log("[ALC Helper] User opened settings page from overlay.");
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
        DebugLogger.log("[ALC Helper] Starting up...");
        createOverlay();
        
        // Retrieve the custom styling toggle setting (default to true)
        const customStylingEnabled = await getStorage('libro_custom_owned_style') !== false;

        // Clear previous UI elements before processing new data
        document.querySelectorAll('.already-owned-alc').forEach(el => el.classList.remove('already-owned-alc'));
        document.querySelectorAll('.alc-owned-badge').forEach(el => el.remove());
        document.querySelectorAll('.alc-genre-container').forEach(el => el.remove());

        // Scan ALC page, apply dimming/badges conditionally, and gather URLs for genre fetching
        const alcBooksData = processALCBooks(customStylingEnabled);
        updateOverlay("ALC Helper", "Fetching genres...");

        // Fetch and inject genres in the background
        await loadAndInjectGenres(alcBooksData);
        updateOverlay("ALC Helper", "All genres loaded!");
        
    } finally {
        // Unlock when finished so it can run again later if needed
        isProcessing = false; 
    }
}

function processALCBooks(customStylingEnabled) {
    const alcBooks = document.querySelectorAll(SELECTORS.alcBookContainer);
    const booksToProcess = []; 

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
                DebugLogger.log(`[ALC Helper] 📚 ALC Match! Applying custom owned styling for ISBN: ${isbn}`);
                
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
    let fetchedCount = 0;

    for (const book of booksData) {
        // If the process was restarted, stop the old loop from continuing
        if (!isProcessing) return;

        let genres = genreCache[book.isbn];

        if (!genres) {
            try {
                DebugLogger.log(`[ALC Helper] Fetching genres for ISBN: ${book.isbn}...`);
                const response = await fetch(book.bookUrl);
                if (response.ok) {
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    
                    const genreNodes = doc.querySelectorAll(SELECTORS.detailPageGenreLinks);
                    genres = Array.from(genreNodes)
                        .map(n => n.textContent.trim())
                        .filter(text => text.length > 0);
                    
                    genreCache[book.isbn] = genres;
                }
                
                await new Promise(r => setTimeout(r, 400));
            } catch (err) {
                DebugLogger.error(`[ALC Helper] Failed to fetch genres for ${book.isbn}`, err);
                genres = [];
            }
        }

        fetchedCount++;
        updateOverlay("ALC Helper", `Genres loaded: ${fetchedCount}/${booksData.length}`);

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

    // Save the updated cache at the end, merging with any concurrent updates
    const latestCache = await getGenreCache();
    Object.assign(latestCache, genreCache);
    await setStorage('libro_genres_cache', latestCache);
}
