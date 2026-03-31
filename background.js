/**
 * Extension Icon Click Handler
 * Opens the Options page whenever the user clicks the extension icon in the toolbar.
 * NOTE: Icon is not enabled by default
 */
chrome.action.onClicked.addListener((tab) => {
    // Open the options page natively
    chrome.runtime.openOptionsPage(() => {
        if (typeof DebugLogger !== 'undefined') {
            DebugLogger.log('Opened Options page via toolbar icon click.');
        } else {
            console.log('Opened Options page via toolbar icon click.');
        }
    });
});

// Listen for the options message from the overlay on the page from content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openOptionsPage") {
        // This opens the options.html page you set in your manifest
        chrome.runtime.openOptionsPage();
    }
});