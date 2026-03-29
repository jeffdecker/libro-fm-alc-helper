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
    
    // NEW: Where to inject the pills, and how to find them on the detail page
    alcPillTarget: 'p.margin-top', 
    detailPageGenreLinks: '.audiobook-genres a' // <--- UPDATED HERE
};

// =====================

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
        <div class="status-text">Initializing...</div>
        <div class="count-text">Loaded: 0 books</div>
        <div class="genre-text" style="font-size: 11px; color: #666; margin-top: 4px;"></div>
        <button id="alc-reload-btn" class="reload-btn" title="Force refresh library cache">↻ Refresh Library</button>
    `;
    document.body.appendChild(overlayEl);

    document.getElementById('alc-reload-btn').addEventListener('click', () => {
        console.log("[ALC Checker] Manual refresh triggered by user.");
        localStorage.removeItem('libro_owned_books_cache');
        localStorage.removeItem('libro_genres_cache'); // Clear genres too!
        
        document.querySelectorAll('.already-owned-alc').forEach(el => el.classList.remove('already-owned-alc'));
        document.querySelectorAll('.alc-genre-container').forEach(el => el.remove());
        
        init();
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
    console.log("[ALC Checker] Starting up...");
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
}

async function fetchAllLibraryBooks() {
    // Check local storage cache first
    const cacheStr = localStorage.getItem('libro_owned_books_cache');
    if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        // Ensure the cache has the new 'books' object structure
        if (cache.books && (Date.now() - cache.timestamp < twentyFourHours)) {
            const cachedCount = Object.keys(cache.books).length;
            console.log(`[ALC Checker] Loaded ${cachedCount} owned books from fast cache.`);
            updateOverlay("Loading from Cache...", cachedCount);
            return cache.books;
        }
    }

    console.log("[ALC Checker] Fetching library from Libro.fm...");
    updateOverlay("Loading Library...", 0);
    
    let allBooksMap = {}; // Our Hash Table: { "isbn": "title" }
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        if (currentPage > MAX_TEST_PAGES) {
            console.log(`[ALC Checker] Testing limit reached: Stopping after ${MAX_TEST_PAGES} pages.`);
            break;
        }

        try {
            console.log(`[ALC Checker] Fetching library page ${currentPage}...`);
            const response = await fetch(`${LIBRARY_URL}?page=${currentPage}`);
            
            if (!response.ok) {
                console.error(`[ALC Checker] Failed to fetch page ${currentPage}.`);
                break; 
            }

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const libraryItems = doc.querySelectorAll(SELECTORS.libraryBookContainer);
            
            if (libraryItems.length === 0) {
                console.log(`[ALC Checker] No more books found. Reached end of library.`);
                hasNextPage = false;
            } else {
                let booksFoundOnPage = 0;

                libraryItems.forEach(item => {
                    const titleEl = item.querySelector(SELECTORS.libraryBookTitle);
                    const linkEl = item.querySelector(SELECTORS.libraryBookLink);
                    
                    let title = titleEl ? titleEl.textContent.trim().toLowerCase() : 'Unknown Title';
                    let isbn = null;

                    // Extract ISBN from URL
                    if (linkEl) {
                        const href = linkEl.getAttribute('href');
                        const match = href.match(/\/audiobooks\/(\d+)/);
                        if (match) {
                            isbn = match[1];
                        }
                    }

                    // STRICT MATCHING: Only add to Hash Table if we have an ISBN.
                    // We store the title as the value for debugging/CSV exports.
                    if (isbn) {
                        allBooksMap[isbn] = title;
                        booksFoundOnPage++;
                    } else {
                        console.warn(`[ALC Checker] Skipping book (No ISBN found): ${title}`);
                    }
                });
                
                const totalBooksFoundSoFar = Object.keys(allBooksMap).length;
                console.log(`[ALC Checker] Extracted ${booksFoundOnPage} books on page ${currentPage}.`);
                updateOverlay("Loading Library...", totalBooksFoundSoFar);
                
                currentPage++;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error(`[ALC Checker] Error fetching library page ${currentPage}:`, error);
            hasNextPage = false; 
        }
    }

    const cacheData = {
        timestamp: Date.now(),
        books: allBooksMap
    };
    localStorage.setItem('libro_owned_books_cache', JSON.stringify(cacheData));
    
    console.log(`[ALC Checker] SUCCESS! Saved to cache.`);
    return allBooksMap;
}

function processALCBooks(ownedBooksMap) {
    const alcBooks = document.querySelectorAll(SELECTORS.alcBookContainer);
    const booksToProcess = []; // Store data for the genre fetcher

    alcBooks.forEach((bookNode) => {
        const linkNode = bookNode.querySelector(SELECTORS.alcBookLink);
        
        let isbn = null;
        let bookUrl = null;

        if (linkNode) {
            bookUrl = linkNode.href; // Get absolute URL for fetching
            const match = linkNode.getAttribute('href').match(/\/audiobooks\/(\d+)/);
            if (match) isbn = match[1];
        }

        // STRICT ISBN MATCHING ONLY. No title fallbacks.
        let isOwned = false;
        if (isbn && ownedBooksMap[isbn]) {
            isOwned = true;
            // Log it so you can see exactly what matched in the console
            console.log(`[ALC Checker] 📚 ALC Match! Greyed out ISBN: ${isbn} (Library Title: "${ownedBooksMap[isbn]}")`);
        }

        if (isOwned) {
            bookNode.classList.add('already-owned-alc');
        }

        // Save node and info for the genre fetcher
        if (isbn && bookUrl) {
            // Check if it's using the old 'element' or new 'bookNode' syntax for the genre fetcher
            booksToProcess.push({ isbn: isbn, bookUrl: bookUrl, element: bookNode, bookNode: bookNode });
        }
    });

    return booksToProcess;
}

function greyOutOwnedBooks(ownedBooksMap) {
    const alcBooks = document.querySelectorAll(SELECTORS.alcBookContainer);
    const fallbackTitlesArray = Object.values(ownedBooksMap);
    const booksToProcess = []; // Store data for the genre fetcher

    alcBooks.forEach((bookNode) => {
        const titleNode = bookNode.querySelector(SELECTORS.alcBookTitle);
        const linkNode = bookNode.querySelector(SELECTORS.alcBookLink);
        
        let title = titleNode ? titleNode.textContent.trim().toLowerCase() : '';
        let isbn = null;
        let bookUrl = null;

        if (linkNode) {
            bookUrl = linkNode.href; // Get absolute URL for fetching
            const match = linkNode.getAttribute('href').match(/\/audiobooks\/(\d+)/);
            if (match) isbn = match[1];
        }

        let isOwned = false;
        if (isbn && ownedBooksMap[isbn]) {
            isOwned = true;
        } else if (title && fallbackTitlesArray.includes(title)) {
            isOwned = true;
        }

        if (isOwned) {
            bookNode.classList.add('already-owned-alc');
        }

        // Save node and info for the genre fetcher
        if (isbn && bookUrl) {
            booksToProcess.push({ isbn, bookUrl, bookNode });
        }
    });

    return booksToProcess;
}

// --- NEW GENRE LOGIC ---

// Helper function to generate consistent colors based on the genre name
function getGenreColor(genre) {
    // Some predefined colors for common genres
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

    // Return the specific color, or a generated hash color if not in the map
    if (colorMap[genre]) return colorMap[genre];
    
    // Generate a consistent color for unknown genres
    let hash = 0;
    for (let i = 0; i < genre.length; i++) {
        hash = genre.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 40%)`; // Nice readable muted colors
}

function getGenreCache() {
    const cacheStr = localStorage.getItem('libro_genres_cache');
    return cacheStr ? JSON.parse(cacheStr) : {};
}

function saveGenreCache(cacheData) {
    localStorage.setItem('libro_genres_cache', JSON.stringify(cacheData));
}

async function loadAndInjectGenres(booksData) {
    let genreCache = getGenreCache(); // Ensure you have this function defined elsewhere
    let fetchedCount = 0;

    for (const book of booksData) {
        let genres = genreCache[book.isbn];

        // If not in cache, fetch it from the detail page
        if (!genres) {
            try {
                console.log(`[ALC Checker] Fetching genres for ISBN: ${book.isbn}...`);
                const response = await fetch(book.bookUrl);
                if (response.ok) {
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    
                    // Find genre links and extract text
                    const genreNodes = doc.querySelectorAll(SELECTORS.detailPageGenreLinks);
                    genres = Array.from(genreNodes)
                        .map(n => n.textContent.trim())
                        .filter(text => text.length > 0);
                    
                    // Save to cache
                    genreCache[book.isbn] = genres;
                    saveGenreCache(genreCache); // Ensure you have this function defined elsewhere
                }
                
                // Be polite to the server: wait 400ms before the next request
                await new Promise(r => setTimeout(r, 400));
            } catch (err) {
                console.error(`[ALC Checker] Failed to fetch genres for ${book.isbn}`, err);
                genres = [];
            }
        }

        fetchedCount++;
        
        // Safely update overlay
        const libraryCacheStr = localStorage.getItem('libro_owned_books_cache');
        const libraryCount = libraryCacheStr ? Object.keys(JSON.parse(libraryCacheStr).books || {}).length : 0;
        updateOverlay("Loading Complete", libraryCount, true, `Genres loaded: ${fetchedCount}/${booksData.length}`);

        // Inject the pills into the UI
        if (genres && genres.length > 0) {
            
            // 1. Find the book element. We look for the ISBN inside the href attribute 
            // because Libro.fm might use relative links (/audiobooks/978...) instead of full URLs.
            let currentBookElement = book.element;
            if (!currentBookElement) {
                const bookLink = document.querySelector(`a[href*="${book.isbn}"]`);
                if (bookLink) {
                    currentBookElement = bookLink.closest(SELECTORS.alcBookContainer); // .detailed-list-item
                }
            }

            // DEBUG CHECK 1
            if (!currentBookElement) {
                console.warn(`[ALC Checker] ❌ Could not find the main book container (.detailed-list-item) for ISBN: ${book.isbn}`);
                continue; // Skip to the next book
            }

            // 2. Find the target paragraph to inject after
            const target = currentBookElement.querySelector(SELECTORS.alcPillTarget); // p.margin-top

            // DEBUG CHECK 2
            if (!target) {
                console.warn(`[ALC Checker] ❌ Could not find the <p class="margin-top"> target for ISBN: ${book.isbn}`);
                continue; // Skip to the next book
            }

            // 3. Inject the pills
            // Check if we already injected them to avoid duplicates
            if (!currentBookElement.querySelector('.alc-genre-container')) {
                console.log(`[ALC Checker] ✅ Injecting pills for ${book.isbn}`);
                
                const pillContainer = document.createElement('div');
                pillContainer.className = 'alc-genre-container';
                
                // Loop through genres and create pills
                genres.forEach(genre => {
                    const pill = document.createElement('span');
                    pill.className = 'alc-genre-pill';
                    pill.textContent = genre;
                    pill.style.backgroundColor = getGenreColor(genre);
                    pillContainer.appendChild(pill);
                });

                // INJECT AFTER THE <p class="margin-top"> TAG
                target.after(pillContainer); 
            }
        }
    }
}