// === CONFIGURATION ===
const ALC_PAGE_URL_PART = "/playlists/alc"; 
const LIBRARY_URL = "https://libro.fm/user/library"; 
const MAX_TEST_PAGES = 999; // Set to 999 to load the whole library

// CSS Selectors
const SELECTORS = {
    libraryBookContainer: '.account-list-item',
    libraryBookTitle: '.account-item-info h3',     
    libraryBookLink: 'a.book', // Contains the ISBN in the href
    alcBookContainer: '.detailed-list-item',       
    alcBookTitle: 'h2',                             
    alcBookLink: 'a[href^="/audiobooks/"]' // Links starting with /audiobooks/ contain the ISBN
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
        <button id="alc-reload-btn" class="reload-btn" title="Force refresh library cache">↻ Refresh Library</button>
    `;
    document.body.appendChild(overlayEl);

    document.getElementById('alc-reload-btn').addEventListener('click', () => {
        console.log("[ALC Checker] Manual refresh triggered by user.");
        localStorage.removeItem('libro_owned_books_cache');
        
        document.querySelectorAll('.already-owned-alc').forEach(el => {
            el.classList.remove('already-owned-alc');
        });
        
        init();
    });
}

function updateOverlay(status, count, isComplete = false) {
    if (!overlayEl) return;
    
    overlayEl.querySelector('.status-text').textContent = status;
    
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
    
    // 1. Get the complete hash map of books you own { "isbn": "title" }
    const ownedBooksMap = await fetchAllLibraryBooks();
    const ownedCount = Object.keys(ownedBooksMap).length;
    
    if (ownedCount === 0) {
        console.log("[ALC Checker] No books found in library or not logged in.");
        updateOverlay("Error: No Books Found", 0, true);
        return; 
    }

    // 2. Scan the ALC page and grey out matches
    greyOutOwnedBooks(ownedBooksMap);
    
    // 3. Update overlay to success state
    updateOverlay("Loading Complete", ownedCount, true);
}

async function fetchAllLibraryBooks() {
    // Check local storage cache first
    const cacheStr = localStorage.getItem('libro_owned_books_cache');
    if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        // Ensure the cache has the new 'books' object structure, not the old 'titles' array
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
                    
                    let title = titleEl ? titleEl.textContent.trim().toLowerCase() : '';
                    let isbn = null;

                    // Extract ISBN from URL
                    if (linkEl) {
                        const href = linkEl.getAttribute('href');
                        const match = href.match(/\/audiobooks\/(\d+)/);
                        if (match) {
                            isbn = match[1];
                        }
                    }

                    // Add to Hash Table
                    if (isbn) {
                        allBooksMap[isbn] = title;
                        booksFoundOnPage++;
                    } else if (title) {
                        // Fallback: If no ISBN, store title as key
                        allBooksMap[`fallback_${title}`] = title;
                        booksFoundOnPage++;
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

function greyOutOwnedBooks(ownedBooksMap) {
    const alcBooks = document.querySelectorAll(SELECTORS.alcBookContainer);
    
    console.log(`[ALC Checker] Found ${alcBooks.length} book containers on the ALC page.`);

    // Pre-calculate an array of titles for our fallback check
    // Doing this outside the loop saves processing power!
    const fallbackTitlesArray = Object.values(ownedBooksMap);

    alcBooks.forEach((bookNode) => {
        const titleNode = bookNode.querySelector(SELECTORS.alcBookTitle);
        const linkNode = bookNode.querySelector(SELECTORS.alcBookLink);
        
        let title = titleNode ? titleNode.textContent.trim().toLowerCase() : '';
        let isbn = null;

        // Extract ISBN from ALC URL
        if (linkNode) {
            const href = linkNode.getAttribute('href');
            const match = href.match(/\/audiobooks\/(\d+)/);
            if (match) {
                isbn = match[1];
            }
        }

        let isOwned = false;

        // 1. Fast Hash Table Match via exact ISBN
        if (isbn && ownedBooksMap[isbn]) {
            isOwned = true;
            console.log(`[ALC Checker] ISBN Match: ${title} (${isbn})`);
        } 
        // 2. Fallback Match via Title (if ISBN is missing/mismatched)
        else if (title && fallbackTitlesArray.includes(title)) {
            isOwned = true;
            console.log(`[ALC Checker] Title Fallback Match: ${title}`);
        }

        if (isOwned) {
            bookNode.classList.add('already-owned-alc');
        }
    });
}
