document.addEventListener('DOMContentLoaded', () => {
    
    // --- Elements ---
    const viewLibraryBtn = document.getElementById('viewLibraryBtn');
    const clearLibraryBtn = document.getElementById('clearLibraryBtn');
    const libraryDisplay = document.getElementById('libraryDisplay');
  
    const viewGenreBtn = document.getElementById('viewGenreBtn');
    const clearGenreBtn = document.getElementById('clearGenreBtn');
    const genreDisplay = document.getElementById('genreDisplay');
  
    // --- Constants ---
    const LIBRARY_CACHE_KEY = 'libro_owned_books_cache';
    const GENRE_CACHE_KEY = 'libro_genres_cache';
  
    // ==========================================
    // LIBRARY DATA LOGIC
    // ==========================================
    
    viewLibraryBtn.addEventListener('click', () => {
      chrome.storage.local.get([LIBRARY_CACHE_KEY], (result) => {
        const data = result[LIBRARY_CACHE_KEY];
        
        if (data) {
          // Data from chrome.storage might be an object already, or a JSON string
          let parsedData = data;
          if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch(e) {}
          }
          libraryDisplay.value = JSON.stringify(parsedData, null, 2); 
        } else {
          libraryDisplay.value = "No library data found in cache. Visit Libro.fm to generate it.";
        }
      });
    });
  
    clearLibraryBtn.addEventListener('click', () => {
      chrome.storage.local.remove([LIBRARY_CACHE_KEY], () => {
        libraryDisplay.value = "Library cache successfully cleared.\n\nThe extension will re-sync your library the next time you visit a Libro.fm ALC page.";
      });
    });
  
    // ==========================================
    // GENRE DATA LOGIC
    // ==========================================
  
    viewGenreBtn.addEventListener('click', () => {
      chrome.storage.local.get([GENRE_CACHE_KEY], (result) => {
        const data = result[GENRE_CACHE_KEY];
        
        if (data) {
          let parsedData = data;
          if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch(e) {}
          }
          genreDisplay.value = JSON.stringify(parsedData, null, 2);
        } else {
          genreDisplay.value = "No genre data found in cache. Visit a Libro.fm ALC page to generate it.";
        }
      });
    });
  
    clearGenreBtn.addEventListener('click', () => {
      chrome.storage.local.remove([GENRE_CACHE_KEY], () => {
        genreDisplay.value = "Genre cache successfully cleared.\n\nThe extension will fetch fresh genres the next time you visit an ALC page.";
      });
    });
  
  });

// ==========================================
// SUPPORT & DEBUGGING: Download JSON
// ==========================================
document.getElementById('download-btn').addEventListener('click', async () => {
    // Get all your data from storage
    const data = await chrome.storage.local.get([
        'libro_owned_books_cache', 
        'libro_genres_cache',
        'libro_debug_logs' // Grab our new logs!
    ]);

    // Format the export object
    const exportObject = {
        exportDate: new Date().toISOString(),
        libraryData: data.libro_owned_books_cache || {},
        genreData: data.libro_genres_cache || {},
        consoleAndNetworkLogs: data.libro_debug_logs || []
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(exportObject, null, 2);

    // Create a Blob and trigger download
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `LibroALCHelper_Export_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

document.addEventListener('DOMContentLoaded', () => {
    
    // --- AUTOMATIC VERSION NUMBER ---
    const manifestData = chrome.runtime.getManifest();
    const versionElement = document.getElementById('extension-version');
    if (versionElement) {
        // This automatically reads "version": "1.0.x" from manifest.json
        versionElement.textContent = `Libro.fm ALC Helper v${manifestData.version}`;
    }

    // ... (rest of your existing options.js code for buttons) ...

});