// === CONFIGURATION ===
const ALC_PAGE_URL_PART = "/playlists/alc"; 
const LIBRARY_URL = "https://libro.fm/user/library"; 
const MAX_TEST_PAGES = 999; // Set to 999 to load the whole library

// CSS Selectors
const SELECTORS = {
    libraryBookTitle: '.account-item-info h3',     
    alcBookContainer: '.detailed-list-item',       
    alcBookTitle: 'h2'                             
};
// =====================

if (window.location.href.includes(ALC_PAGE_URL_PART)) {
    window.addEventListener('load', init);
}

// --- UI Overlay Functions ---
let overlayEl = null;

function createOverlay() {
    // If an overlay already exists (like when we hit refresh), remove it first
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

    // Listen for clicks on the new Refresh button
    document.getElementById('alc-reload-btn').addEventListener('click', () => {
        console.log("[ALC Checker] Manual refresh triggered by user.");
        
        // 1. Clear the saved cache
        localStorage.removeItem('libro_owned_books_cache');
        
        // 2. Remove the grey-out effect from all books on the page so we start fresh visually
        document.querySelectorAll('.already-owned-alc').forEach(el => {
            el.classList.remove('already-owned-alc');
        });
        
        // 3. Restart the entire checking process!
        init();
    });
}

function updateOverlay(status, count, isComplete = false) {
    if (!overlayEl) return;
    
    overlayEl.querySelector('.status-text').textContent = status;
    
    if (isComplete) {
        overlayEl.querySelector('.count-text').textContent = `Library: ${count} books`;
        overlayEl.querySelector('.reload-btn').style.display = 'block'; // Show the button!
    } else {
        overlayEl.querySelector('.count-text').textContent = `Loaded: ${count} books`;
        overlayEl.querySelector('.reload-btn').style.display = 'none'; // Hide while loading
    }
}
// ----------------------------

async function init() {
    console.log("[ALC Checker] Starting up...");
    createOverlay();
    
    // 1. Get the complete list of books you own
    const ownedTitles = await fetchAllLibraryBooks();
    
    if (ownedTitles.length === 0) {
        console.log("[ALC Checker] No books found in library or not logged in.");
        updateOverlay("Error: No Books Found", 0, true);
        return; 
    }

    // 2. Scan the ALC page and grey out matches
    greyOutOwnedBooks(ownedTitles);
    
    // 3. Update overlay to success state and reveal the refresh button
    updateOverlay("Loading Complete", ownedTitles.length, true);
}

async function fetchAllLibraryBooks() {
    // Check local storage cache first
    const cacheStr = localStorage.getItem('libro_owned_books_cache');
    if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        const twentyFourHours = 24 * 60 * 60 * 1000;
        if (Date.now() - cache.timestamp < twentyFourHours) {
            console.log(`[ALC Checker] Loaded ${cache.titles.length} owned books from fast cache.`);
            updateOverlay("Loading from Cache...", cache.titles.length);
            return cache.titles;
        }
    }

    console.log("[ALC Checker] Fetching library from Libro.fm...");
    updateOverlay("Loading Library...", 0);
    
    let allTitles = [];
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
            
            const titleElements = doc.querySelectorAll(SELECTORS.libraryBookTitle);
            
            if (titleElements.length === 0) {
                console.log(`[ALC Checker] No more books found. Reached end of library.`);
                hasNextPage = false;
            } else {
                const titlesOnPage = Array.from(titleElements).map(el => el.textContent.trim().toLowerCase());
                allTitles = allTitles.concat(titlesOnPage);
                
                console.log(`[ALC Checker] Found ${titlesOnPage.length} books on page ${currentPage}.`);
                updateOverlay("Loading Library...", allTitles.length);
                
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
        titles: allTitles
    };
    localStorage.setItem('libro_owned_books_cache', JSON.stringify(cacheData));
    
    console.log(`[ALC Checker] SUCCESS! Total books found so far: ${allTitles.length}. Saved to cache.`);
    return allTitles;
}

function greyOutOwnedBooks(ownedTitles) {
    const alcBooks = document.querySelectorAll(SELECTORS.alcBookContainer);
    
    console.log(`[ALC Checker] Found ${alcBooks.length} book containers on the ALC page.`);

    alcBooks.forEach((bookNode, index) => {
        const titleNode = bookNode.querySelector(SELECTORS.alcBookTitle);
        
        if (titleNode) {
            const title = titleNode.textContent.trim().toLowerCase();
            if (ownedTitles.includes(title)) {
                bookNode.classList.add('already-owned-alc');
            }
        }
    });
}
