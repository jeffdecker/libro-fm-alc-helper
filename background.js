chrome.action.onClicked.addListener(async (currentTab) => {
  const targetUrl = "https://libro.fm/"; 
  
  // If we're already at libro.fm, then open the extension's options page instead of opening a new tab
  if (currentTab.url && currentTab.url.includes("libro.fm")) {
    console.log("Already on Libro.fm, doing nothing.");
    //chrome.runtime.openOptionsPage();
    return;
  }

  // 2. Query Chrome to see if Libro.fm is open in ANY tab
  let existingTabs = await chrome.tabs.query({ url: "*://*.libro.fm/*" });

  if (existingTabs.length > 0) {
    // 3. If it is open somewhere, switch to that tab
    chrome.tabs.update(existingTabs[0].id, { active: true });
    
    // Also bring that specific Chrome window to the front (if you have multiple windows)
    chrome.windows.update(existingTabs[0].windowId, { focused: true });
  } else {
    // 4. If it's not open anywhere, create a new tab
    chrome.tabs.create({ url: targetUrl });
  }
});
