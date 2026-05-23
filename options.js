document.addEventListener('DOMContentLoaded', () => {
    
    // --- Elements ---
    const toggleCustomStyling = document.getElementById('toggle-custom-styling');
    const viewGenreBtn = document.getElementById('viewGenreBtn');
    const clearGenreBtn = document.getElementById('clearGenreBtn');
    const genreDisplay = document.getElementById('genreDisplay');
  
    // --- Constants ---
    const GENRE_CACHE_KEY = 'libro_genres_cache';
    const CUSTOM_STYLING_KEY = 'libro_custom_owned_style';
  
    // ==========================================
    // PREFERENCES LOGIC
    // ==========================================
    
    // Load existing preference or default to true
    chrome.storage.local.get([CUSTOM_STYLING_KEY], (result) => {
      const isEnabled = result[CUSTOM_STYLING_KEY] !== false; // Default to true
      toggleCustomStyling.checked = isEnabled;
    });

    // Save preference on change
    toggleCustomStyling.addEventListener('change', () => {
      chrome.storage.local.set({ [CUSTOM_STYLING_KEY]: toggleCustomStyling.checked });
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
        'libro_genres_cache',
        'libro_debug_logs' // Grab our new logs!
    ]);

    // Format the export object
    const exportObject = {
        exportDate: new Date().toISOString(),
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

});