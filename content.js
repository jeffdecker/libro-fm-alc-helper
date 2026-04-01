// === CONFIGURATION ===
const ALC_PAGE_URL_PART = "/playlists/alc"; 
const LIBRARY_URL = "https://libro.fm/user/library"; 
const MAX_TEST_PAGES = 999; 

// CSS Selectors
const SELECTORS = {
    libraryBookContainer: '.account-list-item',
    libraryBookTitle: '.account-item-info h3',     
    libraryBookLink: 'a.book', 
    alcBookContainer: '.detailed-list-item',       
    alcBookTitle: 'h2',                             
    alcBookLink: 'a[href^="/audiobooks/"]',
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

// Listen for the Options page clearing the cache
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        // Check if either cache was removed (newValue will be undefined)
        const libraryCleared = changes.libro_owned_books_cache && !changes.libro_owned_books_cache.newValue;
        const genresCleared = changes.libro_genres_cache && !changes.libro_genres_cache.newValue;

        if (libraryCleared || genresCleared) {
            DebugLogger.log("[ALC Helper] Cache clear detected from external source.");
            
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
    
    document.querySelectorAll('.already-owned-alc').forEach(el => el.classList.remove('already-owned-alc'));
    document.querySelectorAll('.alc-genre-container').forEach(el => el.remove());
    
    if (overlayEl) {
        updateOverlay("Resetting...", 0);
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
    
    // Updated button text to "Settings"
    overlayEl.innerHTML = `
        <div class="status-text">Initializing...</div>
        <div class="count-text">Loaded: 0 books</div>
        <div class="genre-text"></div>
        <button id="alc-reload-btn" class="reload-btn" title="Force refresh library cache">↻ Refresh Library</button>
        <button id="alc-settings-btn" class="settings-btn" title="Open Extension Settings">⚙️ Settings</button>
    `;
    document.body.appendChild(overlayEl);

    // Existing Reload Button Listener
    document.getElementById('alc-reload-btn').addEventListener('click', async () => {
        DebugLogger.log("[ALC Helper] Manual refresh triggered by user.");
        await removeStorage(['libro_owned_books_cache', 'libro_genres_cache']); 
    });

    // NEW: Settings Button Listener
    document.getElementById('alc-settings-btn').addEventListener('click', () => {
        DebugLogger.log("[ALC Helper] User opened settings page from overlay.");
        chrome.runtime.sendMessage({ action: "openOptionsPage" }); 
        // Note: We still send "openOptionsPage" because that's what Chrome calls the API!
    });
}

function updateOverlay(status, count, isComplete = false, genreStatus = "") {
    if (!overlayEl) return;
    
    overlayEl.querySelector('.status-text').textContent = status;
    if (genreStatus) {
        overlayEl.querySelector('.genre-text').textContent = genreStatus;
    }
    
    if (isComplete) {
        overlayEl.querySelector('.count-text').textContent = `Library: ${count} books`;
        overlayEl.querySelector('.reload-btn').style.display = 'block'; 
    } else {
        overlayEl.querySelector('.count-text').textContent = `Loaded: ${count} books`;
        overlayEl.querySelector('.reload-btn').style.display = 'none'; 
    }
}
// ----------------------------

async function init() {
    if (isProcessing) return; // Lock to prevent double-running
    isProcessing = true;
    
    try {
        DebugLogger.log("[ALC Helper] Starting up...");
        createOverlay();
        
        // 1. Get library
        const ownedBooksMap = await fetchAllLibraryBooks();
        const ownedCount = Object.keys(ownedBooksMap).length;
        
        if (ownedCount === 0) {
            updateOverlay("Error: No Books Found", 0, true);
            return; 
        }

        // 2. Scan ALC page, grey out owned books, and gather URLs for genre fetching
        const alcBooksData = processALCBooks(ownedBooksMap);
        updateOverlay("Loading Complete", ownedCount, true, "Fetching genres...");

        // 3. Fetch and inject genres in the background
        await loadAndInjectGenres(alcBooksData);
        updateOverlay("Loading Complete", ownedCount, true, "All genres loaded!");
        
    } finally {
        // Unlock when finished so it can run again later if needed
        isProcessing = false; 
    }
}

async function fetchAllLibraryBooks() {
    const cache = await getStorage('libro_owned_books_cache');
    
    if (cache) {
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (cache.books && (Date.now() - cache.timestamp < twentyFourHours)) {
            const cachedCount = Object.keys(cache.books).length;
            DebugLogger.log(`[ALC Helper] Loaded ${cachedCount} owned books from fast cache.`);
            updateOverlay("Loading from Cache...", cachedCount);
            return cache.books;
        }
    }

    DebugLogger.log("[ALC Helper] Fetching library from Libro.fm...");
    updateOverlay("Loading Library...", 0);
    
    let allBooksMap = {}; 
    let currentPage = 1;
    let hasNextPage = true;
    
    // 1. ADD THE FLAG HERE
    let fetchSuccessful = true;

    while (hasNextPage) {
        if (currentPage > MAX_TEST_PAGES) {
            DebugLogger.log(`[ALC Helper] Testing limit reached: Stopping after ${MAX_TEST_PAGES} pages.`);
            break;
        }

        try {
            DebugLogger.log(`[ALC Helper] Fetching library page ${currentPage}...`);
            const response = await fetch(`${LIBRARY_URL}?page=${currentPage}`);
            
            if (!response.ok) {
                DebugLogger.error(`[ALC Helper] Failed to fetch page ${currentPage}.`);
                fetchSuccessful = false; // 2. MARK AS FAILED BEFORE BREAKING
                break; 
            }

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const libraryItems = doc.querySelectorAll(SELECTORS.libraryBookContainer);
            
            if (libraryItems.length === 0) {
                DebugLogger.log(`[ALC Helper] No more books found. Reached end of library.`);
                hasNextPage = false;
            } else {
                let booksFoundOnPage = 0;

                libraryItems.forEach(item => {
                    const titleEl = item.querySelector(SELECTORS.libraryBookTitle);
                    const linkEl = item.querySelector(SELECTORS.libraryBookLink);
                    
                    let title = titleEl ? titleEl.textContent.trim().toLowerCase() : 'Unknown Title';
                    let isbn = null;

                    if (linkEl) {
                        const href = linkEl.getAttribute('href');
                        const match = href.match(/\/audiobooks\/(\d+)/);
                        if (match) {
                            isbn = match[1];
                        }
                    }

                    if (isbn) {
                        allBooksMap[isbn] = title;
                        booksFoundOnPage++;
                    } else {
                        DebugLogger.warn(`[ALC Helper] Skipping book (No ISBN found): ${title}`);
                    }
                });
                
                const totalBooksFoundSoFar = Object.keys(allBooksMap).length;
                DebugLogger.log(`[ALC Helper] Extracted ${booksFoundOnPage} books on page ${currentPage}.`);
                updateOverlay("Loading Library...", totalBooksFoundSoFar);
                
                currentPage++;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            // Check if the error is due to the browser cutting off the fetch (navigation)
            // Note: Fixed 'pageNum' to 'currentPage' here!
            if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
                DebugLogger.warn(`Fetch interrupted on library page ${currentPage}. User likely navigated away.`);
            } else {
                // It's a real error, log it as usual
                DebugLogger.error(`Error fetching library page ${currentPage}: ${error.toString()}`);
            }
            
            fetchSuccessful = false; // 3. MARK AS FAILED BEFORE BREAKING
            break; 
        }
    }

    // 4. ONLY SAVE TO CACHE IF IT WAS 100% SUCCESSFUL
    if (fetchSuccessful) {
        const cacheData = {
            timestamp: Date.now(),
            books: allBooksMap
        };
        
        await setStorage('libro_owned_books_cache', cacheData);
        DebugLogger.log(`[ALC Helper] SUCCESS! Saved ${Object.keys(allBooksMap).length} books to cache.`);
    } else {
        DebugLogger.warn(`[ALC Helper] Fetch aborted. Cache was NOT updated to prevent saving incomplete data.`);
    }

    // We still return whatever books we managed to find before the interruption.
    // They won't be cached, but the script can use them for the current split-second before the new page loads.
    return allBooksMap;
}

function processALCBooks(ownedBooksMap) {
    const alcBooks = document.querySelectorAll(SELECTORS.alcBookContainer);
    const booksToProcess = []; 

    alcBooks.forEach((bookNode) => {
        const linkNode = bookNode.querySelector(SELECTORS.alcBookLink);
        
        let isbn = null;
        let bookUrl = null;

        if (linkNode) {
            bookUrl = linkNode.href; 
            const match = linkNode.getAttribute('href').match(/\/audiobooks\/(\d+)/);
            if (match) isbn = match[1];
        }

        let isOwned = false;
        if (isbn && ownedBooksMap[isbn]) {
            isOwned = true;
            DebugLogger.log(`[ALC Helper] 📚 ALC Match! Greyed out ISBN: ${isbn} (Library Title: "${ownedBooksMap[isbn]}")`);
        }

        if (isOwned) {
            bookNode.classList.add('already-owned-alc');
        }

        if (isbn && bookUrl) {
            booksToProcess.push({ isbn: isbn, bookUrl: bookUrl, element: bookNode, bookNode: bookNode });
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
                    await saveGenreCache(genreCache);
                }
                
                await new Promise(r => setTimeout(r, 400));
            } catch (err) {
                DebugLogger.error(`[ALC Helper] Failed to fetch genres for ${book.isbn}`, err);
                genres = [];
            }
        }

        fetchedCount++;
        
        const libraryCache = await getStorage('libro_owned_books_cache');
        const libraryCount = libraryCache ? Object.keys(libraryCache.books || {}).length : 0;
        updateOverlay("Loading Complete", libraryCount, true, `Genres loaded: ${fetchedCount}/${booksData.length}`);

        if (genres && genres.length > 0) {
            let currentBookElement = book.element;
            if (!currentBookElement) {
                const bookLink = document.querySelector(`a[href*="${book.isbn}"]`);
                if (bookLink) {
                    currentBookElement = bookLink.closest(SELECTORS.alcBookContainer);
                }
            }

            if (!currentBookElement) continue; 
            const target = currentBookElement.querySelector(SELECTORS.alcPillTarget);
            if (!target) continue;

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

                target.after(pillContainer); 
            }
        }
    }
}
